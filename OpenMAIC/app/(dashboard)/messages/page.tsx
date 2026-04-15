'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Edit, Send, Loader2, MessageSquare } from 'lucide-react';

type ConversationSummary = {
  conversation_id: string;
  type: string;
  name: string;
  creator_id: string;
  last_message_id?: string | null;
  last_message_time?: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type ConversationMessage = {
  message_id: string;
  conversation_id: string;
  seq: number;
  sender_id: string;
  message_type: string;
  content: string;
  source_type: string;
  source_ref_id?: string | null;
  created_at: string;
};

type AIChatSession = {
  session_id: string;
  user_id: string;
  title: string;
};

type AIChatMessage = {
  message_id: string;
};

type ChatMessage = {
  id: string;
  sender: string;
  role: 'assistant' | 'student';
  text: string;
  time: string;
};

type ConversationsResponse = {
  success: boolean;
  conversations?: ConversationSummary[];
  error?: string;
};

type ConversationResponse = {
  success: boolean;
  conversation?: ConversationSummary;
  error?: string;
};

type MessagesResponse = {
  success: boolean;
  messages?: ConversationMessage[];
  error?: string;
};

type MessageResponse = {
  success: boolean;
  message?: ConversationMessage;
  error?: string;
};

type AISessionsResponse = {
  success: boolean;
  sessions?: AIChatSession[];
  error?: string;
};

type AISessionResponse = {
  success: boolean;
  session?: AIChatSession;
  error?: string;
};

type AIMessageResponse = {
  success: boolean;
  message?: AIChatMessage;
  error?: string;
};

type SearchResponse = {
  success: boolean;
  answer?: string;
  sources?: Array<{ title: string; url: string }>;
  error?: string;
};

const USER_ID = 'openmaic-default-user';
const ASSISTANT_ID = 'system-assistant';

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapBackendMessage(message: ConversationMessage): ChatMessage {
  const isUser = message.sender_id === USER_ID;
  return {
    id: message.message_id,
    sender: isUser ? '你' : '系统助手',
    role: isUser ? 'student' : 'assistant',
    text: message.content,
    time: formatTime(message.created_at),
  };
}

export default function MessagesPage() {
  const [contacts, setContacts] = useState<ConversationSummary[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [aiSessionByConversation, setAiSessionByConversation] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState('');

  const selectedContact = useMemo(() => {
    return contacts.find((contact) => contact.conversation_id === selectedContactId);
  }, [contacts, selectedContactId]);

  const activeMessages = useMemo(() => {
    if (!selectedContactId) return [];
    return threads[selectedContactId] || [];
  }, [threads, selectedContactId]);

  const fetchConversations = async (preferredId?: string) => {
    const response = await fetch(`/api/messages/conversations?userId=${encodeURIComponent(USER_ID)}&limit=30`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json()) as ConversationsResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '加载会话失败。');
    }

    let list = payload.conversations || [];
    if (list.length === 0) {
      const created = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          type: 'single',
          name: '系统助手',
          creatorId: USER_ID,
          memberIds: [ASSISTANT_ID],
        }),
      });

      const createdPayload = (await created.json()) as ConversationResponse;
      if (!created.ok || !createdPayload.success || !createdPayload.conversation) {
        throw new Error(createdPayload.error || '创建默认会话失败。');
      }
      list = [createdPayload.conversation];
    }

    setContacts(list);
    const nextSelected = preferredId || selectedContactId || list[0]?.conversation_id || '';
    if (nextSelected) {
      setSelectedContactId(nextSelected);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    const response = await fetch(`/api/messages/${conversationId}/messages?limit=200`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json()) as MessagesResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '加载消息失败。');
    }

    const mapped = (payload.messages || []).map(mapBackendMessage);
    setThreads((prev) => ({
      ...prev,
      [conversationId]: mapped,
    }));

    await fetch(`/api/messages/${conversationId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID }),
    });
  };

  const ensureAiSession = async (conversationId: string, conversationName?: string) => {
    const cached = aiSessionByConversation[conversationId];
    if (cached) return cached;

    const listResponse = await fetch(
      `/api/ai/sessions?userId=${encodeURIComponent(USER_ID)}&conversationId=${encodeURIComponent(conversationId)}&limit=1`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    );
    const listPayload = (await listResponse.json()) as AISessionsResponse;
    if (!listResponse.ok || !listPayload.success) {
      throw new Error(listPayload.error || '查询 AI 会话失败。');
    }

    const existing = listPayload.sessions?.[0];
    if (existing) {
      setAiSessionByConversation((prev) => ({ ...prev, [conversationId]: existing.session_id }));
      return existing.session_id;
    }

    const created = await fetch('/api/ai/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: USER_ID,
        title: `${conversationName || '系统助手'}会话`,
        source: '课后答疑',
        linkedConversationId: conversationId,
      }),
    });
    const createdPayload = (await created.json()) as AISessionResponse;
    if (!created.ok || !createdPayload.success || !createdPayload.session) {
      throw new Error(createdPayload.error || '创建 AI 会话失败。');
    }

    setAiSessionByConversation((prev) => ({ ...prev, [conversationId]: createdPayload.session!.session_id }));
    return createdPayload.session.session_id;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await fetchConversations();
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '加载消息页面失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedContactId) return;
    if (threads[selectedContactId]) return;

    let cancelled = false;
    (async () => {
      try {
        await loadConversationMessages(selectedContactId);
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '加载会话消息失败。');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !selectedContactId) return;

    const conversationId = selectedContactId;
    const conversationName = selectedContact?.name || '系统助手';

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: '你',
      role: 'student',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setThreads((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimisticMessage],
    }));
    setInput('');
    setSending(true);
    setErrorText('');

    try {
      const userMessageResponse = await fetch(`/api/messages/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: USER_ID,
          content: text,
          messageType: 'text',
          sourceType: 'manual',
        }),
      });
      const userMessagePayload = (await userMessageResponse.json()) as MessageResponse;
      if (!userMessageResponse.ok || !userMessagePayload.success) {
        throw new Error(userMessagePayload.error || '发送用户消息失败。');
      }

      const aiSessionId = await ensureAiSession(conversationId, conversationName);

      const aiUserResponse = await fetch(`/api/ai/sessions/${aiSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: text,
          userId: USER_ID,
          contentType: 'text',
          requestId: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const aiUserPayload = (await aiUserResponse.json()) as AIMessageResponse;
      if (!aiUserResponse.ok || !aiUserPayload.success) {
        throw new Error(aiUserPayload.error || '写入 AI 用户消息失败。');
      }

      const searchResponse = await fetch('/api/web-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: text,
        }),
      });

      const searchPayload = (await searchResponse.json()) as SearchResponse;
      if (!searchResponse.ok || !searchPayload.success) {
        throw new Error(searchPayload.error || '后端检索失败。');
      }

      const sourceHint = searchPayload.sources?.[0]?.title
        ? `\n\n参考来源：${searchPayload.sources[0].title}`
        : '';
      const assistantText = `${searchPayload.answer || '已完成查询，但未返回答案。'}${sourceHint}`;

      const aiAssistantResponse = await fetch(`/api/ai/sessions/${aiSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant',
          content: assistantText,
          userId: USER_ID,
          contentType: 'text',
          modelName: 'web-search-proxy',
          requestId: `msg-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const aiAssistantPayload = (await aiAssistantResponse.json()) as AIMessageResponse;
      if (!aiAssistantResponse.ok || !aiAssistantPayload.success || !aiAssistantPayload.message) {
        throw new Error(aiAssistantPayload.error || '写入 AI 助手消息失败。');
      }

      const assistantMessageResponse = await fetch(`/api/messages/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: ASSISTANT_ID,
          content: assistantText,
          messageType: 'text',
          sourceType: 'ai',
          sourceRefId: aiAssistantPayload.message.message_id,
        }),
      });
      const assistantMessagePayload = (await assistantMessageResponse.json()) as MessageResponse;
      if (!assistantMessageResponse.ok || !assistantMessagePayload.success) {
        throw new Error(assistantMessagePayload.error || '写入会话助手消息失败。');
      }

      void fetch(`/api/ai/sessions/${aiSessionId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID }),
      });

      await Promise.all([
        loadConversationMessages(conversationId),
        fetchConversations(conversationId),
      ]);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '消息发送失败。');
      setThreads((prev) => ({
        ...prev,
        [conversationId]: [
          ...(prev[conversationId] || []),
          {
            id: `assistant-error-${Date.now()}`,
            sender: '系统助手',
            role: 'assistant',
            text: '请求失败，请检查网关服务与网络连接。',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      }));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        正在加载消息...
      </div>
    );
  }

  if (errorText && activeMessages.length === 0) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">{errorText}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)]">
      <div className="bg-white shadow-sm h-full flex overflow-hidden">
        <div className="w-80 border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">消息中心</h2>
              <button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                type="button"
                aria-label="新建会话"
                title="新建会话"
              >
                <Edit className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索会话..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#F4F3F0] border-none text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">暂无会话。</div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.conversation_id}
                  type="button"
                  onClick={() => setSelectedContactId(contact.conversation_id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors border-b border-gray-50 ${selectedContactId === contact.conversation_id ? 'bg-[#F4F3F0]' : 'hover:bg-[#F4F3F0]'}`}
                >
                  <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                    聊
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{contact.name}</h3>
                    <p className="text-xs text-gray-500 truncate">
                      {contact.unread_count > 0 ? `${contact.unread_count} 条未读` : '已读'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#F9F9F8]">
          <div className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{selectedContact?.name || '系统助手'}</h3>
                <p className="text-[10px] text-[#4CAF50] font-bold uppercase tracking-wide">后端持久化会话</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'student' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{msg.sender}</span>
                  <span className="text-[10px] text-gray-600">{msg.time}</span>
                </div>
                <div className={`px-4 py-3 max-w-[85%] text-sm whitespace-pre-wrap ${msg.role === 'student' ? 'bg-[#E0573D] text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white border-t border-gray-100 shrink-0">
            {errorText ? <p className="text-xs text-red-600 mb-2">{errorText}</p> : null}
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    void handleSend();
                  }
                }}
                placeholder="输入问题并发送，消息与 AI 记录将写入后端..."
                className="w-full bg-[#F4F3F0] border-none pl-4 pr-12 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  void handleSend();
                }}
                disabled={sending || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black disabled:bg-gray-400 transition-colors"
              >
                {sending ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
