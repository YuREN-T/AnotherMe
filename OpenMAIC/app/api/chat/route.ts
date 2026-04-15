/**
 * Stateless Chat API Endpoint
 *
 * POST /api/chat - Send message, receive SSE stream
 *
 * This endpoint:
 * 1. Receives full state from client (messages + storeState)
 * 2. Runs single-pass generation
 * 3. Streams events as SSE (text deltas + tool calls)
 *
 * Fully stateless: interruption is handled by the client aborting
 * the fetch request, which triggers req.signal on the server side.
 */

import { NextRequest } from 'next/server';
import { statelessGenerate } from '@/lib/orchestration/stateless-generate';
import type { StatelessChatRequest, StatelessEvent } from '@/lib/types/chat';
import type { ThinkingConfig } from '@/lib/types/provider';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import {
  createGatewayAIMessage,
  createGatewayAISession,
} from '@/lib/server/anotherme2-gateway';
const log = createLogger('Chat API');

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  const maybeContent = (message as { content?: unknown }).content;
  if (typeof maybeContent === 'string' && maybeContent.trim()) {
    return maybeContent.trim();
  }

  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return '';

  const text = parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const t = (part as { text?: unknown }).text;
      return typeof t === 'string' ? t : '';
    })
    .join('')
    .trim();

  return text;
}

function extractLatestUserMessage(messages: unknown): { messageId: string; content: string } | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    if (role !== 'user') continue;
    const content = extractTextFromMessage(item);
    if (!content) continue;

    const rawId = (item as { id?: unknown }).id;
    const messageId =
      typeof rawId === 'string' && rawId.trim() ? rawId.trim() : `fallback-user-${i}`;
    return { messageId, content };
  }
  return null;
}

/**
 * POST /api/chat
 * Send a message and receive SSE stream of generation events
 *
 * Request body: StatelessChatRequest
 * {
 *   messages: UIMessage[],
 *   storeState: { stage, scenes, currentSceneId, mode },
 *   config: { agentIds, sessionType? },
 *   apiKey: string,
 *   baseUrl?: string,
 *   model?: string
 * }
 *
 * Response: SSE stream of StatelessEvent
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let chatModel: string | undefined;
  let chatMessageCount: number | undefined;

  try {
    const body: StatelessChatRequest = await req.json();
    chatModel = body.model;
    chatMessageCount = body.messages?.length;

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: messages');
    }

    if (!body.storeState) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: storeState');
    }

    if (!body.config || !body.config.agentIds || body.config.agentIds.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: config.agentIds');
    }

    const { model: languageModel, apiKey: resolvedApiKey } = resolveModel({
      modelString: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      providerType: body.providerType,
      requiresApiKey: body.requiresApiKey,
    });

    if (!resolvedApiKey && body.requiresApiKey !== false) {
      return apiError('MISSING_API_KEY', 401, 'API Key is required');
    }

    log.info('Processing request');
    log.info(
      `Agents: ${body.config.agentIds.join(', ')}, Messages: ${body.messages.length}, Turn: ${body.directorState?.turnCount ?? 0}`,
    );

    let persistenceSessionId: string | undefined;
    const persistenceUserId = body.persistence?.enabled ? body.persistence.userId?.trim() : '';
    const latestUserMessage = extractLatestUserMessage(body.messages);

    if (body.persistence?.enabled && persistenceUserId) {
      try {
        persistenceSessionId = body.persistence.sessionId;
        if (!persistenceSessionId) {
          const created = await createGatewayAISession({
            userId: persistenceUserId,
            title: (body.persistence.title || '课堂对话').trim() || '课堂对话',
            source: body.persistence.source || '课堂互动',
            subject: body.persistence.subject,
            linkedClassroomId: body.persistence.linkedClassroomId,
            linkedConversationId: body.persistence.linkedConversationId,
          });
          persistenceSessionId = created.session_id;
        }

        if (latestUserMessage) {
          await createGatewayAIMessage({
            sessionId: persistenceSessionId,
            role: 'user',
            userId: persistenceUserId,
            content: latestUserMessage.content,
            contentType: 'text',
            requestId: `chat-user-${persistenceSessionId}-${latestUserMessage.messageId}`,
          });
        }
      } catch (error) {
        log.warn('Chat persistence setup failed, continue without persistence:', error);
      }
    }

    // Use the native request signal for abort propagation
    const signal = req.signal;

    // Create SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Stream generation in background with heartbeat to prevent connection timeout
    const HEARTBEAT_INTERVAL_MS = 15_000;
    (async () => {
      // Heartbeat: periodically send SSE comments to keep the connection alive.
      // Proxies / browsers may close idle SSE connections after 30-120s of silence.
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      const startHeartbeat = () => {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
          try {
            writer.write(encoder.encode(`:heartbeat\n\n`)).catch(() => stopHeartbeat());
          } catch {
            stopHeartbeat();
          }
        }, HEARTBEAT_INTERVAL_MS);
      };
      const stopHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      try {
        startHeartbeat();

        let assistantText = '';
        let wasAborted = false;

        const generator = statelessGenerate(
          {
            ...body,
            apiKey: resolvedApiKey,
          },
          signal,
          languageModel,
          { enabled: false } satisfies ThinkingConfig,
        );

        for await (const event of generator) {
          if (signal.aborted) {
            log.info('Request was aborted');
            wasAborted = true;
            break;
          }

          if (event.type === 'text_delta') {
            const delta = event.data?.content;
            if (typeof delta === 'string' && delta) {
              assistantText += delta;
            }
          }

          const data = `data: ${JSON.stringify(event)}\n\n`;
          await writer.write(encoder.encode(data));
        }

        if (!wasAborted && persistenceSessionId && assistantText.trim()) {
          try {
            await createGatewayAIMessage({
              sessionId: persistenceSessionId,
              role: 'assistant',
              userId: persistenceUserId,
              content: assistantText.trim(),
              contentType: 'text',
              modelName: body.model,
              requestId: `chat-assistant-${persistenceSessionId}-${latestUserMessage?.messageId || 'none'}-turn-${body.directorState?.turnCount ?? 0}`,
            });
          } catch (error) {
            log.warn('Failed to persist assistant response after stream:', error);
          }
        }

        stopHeartbeat();
        await writer.close();
      } catch (error) {
        stopHeartbeat();

        // If aborted, just close the writer silently
        if (signal.aborted) {
          log.info('Request aborted during streaming');
          try {
            await writer.close();
          } catch {
            /* already closed */
          }
          return;
        }

        log.error(
          `Chat stream error [model=${body.model ?? 'unknown'}, agents=${body.config?.agentIds?.length ?? 0}, messages=${body.messages?.length ?? 0}]:`,
          error,
        );

        // Try to send error event
        try {
          const errorEvent: StatelessEvent = {
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : String(error),
            },
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...(persistenceSessionId ? { 'x-ai-session-id': persistenceSessionId } : {}),
      },
    });
  } catch (error) {
    log.error(
      `Chat request failed [model=${chatModel ?? 'unknown'}, messages=${chatMessageCount ?? 0}]:`,
      error,
    );
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to process request',
    );
  }
}
