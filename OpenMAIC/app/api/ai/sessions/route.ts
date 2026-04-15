import { NextRequest } from 'next/server';
import {
  createGatewayAISession,
  DEFAULT_CHAT_USER_ID,
  isAnotherMe2GatewayError,
  listGatewayAISessions,
} from '@/lib/server/anotherme2-gateway';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || DEFAULT_CHAT_USER_ID;
    const limit = Number(request.nextUrl.searchParams.get('limit') || '50');
    const linkedConversationId = request.nextUrl.searchParams.get('conversationId') || undefined;

    const sessions = await listGatewayAISessions({
      userId,
      limit: Number.isFinite(limit) ? limit : 50,
      linkedConversationId,
    });
    return apiSuccess({ sessions });
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to list ai sessions',
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      title?: string;
      source?: string;
      subject?: string;
      linkedClassroomId?: string;
      linkedConversationId?: string;
    };

    const title = (body.title || '').trim();
    if (!title) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'title is required');
    }

    const session = await createGatewayAISession({
      userId: (body.userId || DEFAULT_CHAT_USER_ID).trim(),
      title,
      source: body.source,
      subject: body.subject,
      linkedClassroomId: body.linkedClassroomId,
      linkedConversationId: body.linkedConversationId,
    });

    return apiSuccess({ session }, 201);
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to create ai session',
    );
  }
}
