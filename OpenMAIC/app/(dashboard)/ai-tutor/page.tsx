'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Sparkles, Loader2 } from 'lucide-react';
import { getCurrentModelConfig } from '@/lib/utils/model-config';

type TutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatApiEvent = {
  type: string;
  data?: Record<string, unknown>;
};

type ChatRequestMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
};

function parseSSEChunk(buffer: string) {
  const events: string[] = [];
  let rest = buffer;

  while (true) {
    const separatorIndex = rest.indexOf('\n\n');
    if (separatorIndex < 0) break;
    const one = rest.slice(0, separatorIndex);
    rest = rest.slice(separatorIndex + 2);
    events.push(one);
  }

  return { events, rest };
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; details?: string };
    return payload.error || payload.details || '';
  } catch {
    return await response.text();
  }
}

export default function AITutorPage() {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorText, setErrorText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const toRequestMessages = (list: TutorMessage[]): ChatRequestMessage[] => {
    return list.map((item) => ({
      id: item.id,
      role: item.role,
      parts: [{ type: 'text', text: item.content }],
    }));
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantPlaceholder: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    const nextMessages = [...messages, userMessage, assistantPlaceholder];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);
    setErrorText('');

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const modelConfig = getCurrentModelConfig();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: toRequestMessages(nextMessages.slice(0, -1)),
          storeState: {
            stage: null,
            scenes: [],
            currentSceneId: null,
            mode: 'autonomous',
            whiteboardOpen: false,
          },
          config: {
            agentIds: ['default-1'],
            sessionType: 'qa',
          },
          apiKey: modelConfig.apiKey || '',
          baseUrl: modelConfig.baseUrl || undefined,
          model: modelConfig.modelString || undefined,
          providerType: modelConfig.providerType || undefined,
          requiresApiKey: modelConfig.requiresApiKey,
        }),
      });

      if (!response.ok) {
        const errText = await parseApiError(response);
        throw new Error(errText || 'AI 导师服务暂时不可用。');
      }

      if (!response.body) {
        throw new Error('AI 导师服务未返回可读取的流。');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = '';
      let assistantContent = '';

      const processEventBlocks = (blocks: string[]) => {
        for (const block of blocks) {
          const dataLines = block
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'));

          for (const line of dataLines) {
            const payloadText = line.replace(/^data:\s*/, '');
            if (!payloadText) continue;

            let event: ChatApiEvent;
            try {
              event = JSON.parse(payloadText) as ChatApiEvent;
            } catch {
              continue;
            }

            if (event.type === 'text_delta') {
              const delta = typeof event.data?.content === 'string' ? event.data.content : '';
              if (!delta) continue;
              assistantContent += delta;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: assistantContent } : msg)),
              );
            }

            if (event.type === 'text_end') {
              const fullText = typeof event.data?.content === 'string' ? event.data.content : assistantContent;
              assistantContent = fullText;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: fullText } : msg)),
              );
            }

            if (event.type === 'error') {
              const message =
                typeof event.data?.message === 'string' ? event.data.message : 'AI 导师返回错误。';
              throw new Error(message);
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEChunk(rawBuffer);
        rawBuffer = parsed.rest;
        processEventBlocks(parsed.events);
      }

      rawBuffer += decoder.decode();
      const tailParsed = parseSSEChunk(rawBuffer);
      processEventBlocks(tailParsed.events);

      if (!assistantContent.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: '收到请求，但当前没有返回文本结果。请检查模型配置后重试。',
                }
              : msg,
          ),
        );
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'AI 导师请求失败。');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: '请求失败，请检查后端模型配置是否可用。',
              }
            : msg,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 shrink-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">AI 专属导师</h2>
            <p className="text-[10px] text-gray-500 font-medium">已接入真实后端流式对话服务 /api/chat</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[#FAFAFA]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="h-16 w-16 bg-black rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg">
              <Bot className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">今天想学习什么数学知识？</h1>
            <p className="text-sm text-gray-500 mb-12 text-center">你发出的每条问题都会调用真实后端，并返回流式回答。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {['帮我复习二次函数', '解释一下勾股定理', '出一道相似三角形练习题', '如何提高解题速度'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 pb-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">你</div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center text-white shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className={`max-w-[80%] text-[15px] leading-relaxed ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className="font-bold text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                    {msg.role === 'user' ? '你' : 'AI 导师'}
                  </div>
                  <div className={`inline-block px-5 py-3.5 shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#111827] text-white rounded-2xl rounded-tr-sm' : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'}`}>
                    {msg.content || (isTyping && msg.role === 'assistant' ? '思考中...' : '')}
                  </div>
                </div>
              </div>
            ))}
            {isTyping ? (
              <div className="flex gap-2 items-center text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在接收流式回复...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        {errorText ? <p className="text-xs text-red-600 mb-2">{errorText}</p> : null}
        <div className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                handleSend(input);
              }
            }}
            placeholder="输入你的数学问题..."
            className="w-full bg-[#F4F3F0] border-none pl-4 pr-14 py-4 rounded-xl text-[15px] outline-none placeholder:text-gray-400"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="p-2 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
