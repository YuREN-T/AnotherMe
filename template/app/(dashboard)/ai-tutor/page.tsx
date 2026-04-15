'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Sparkles, BookOpen, Calculator, PenTool } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  { icon: Calculator, text: '帮我复习二次函数' },
  { icon: BookOpen, text: '解释一下勾股定理' },
  { icon: PenTool, text: '出一道相似三角形的练习题' },
  { icon: Sparkles, text: '如何提高数学解题速度？' },
];

export default function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: `这是一个模拟的 AI 回复。你刚才问了关于 "${text}" 的问题。在实际应用中，这里会接入大语言模型（如 Gemini 或 Claude）的 API 来生成真实的辅导内容。` 
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      
      {/* Header */}
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 shrink-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">AI 专属导师</h2>
            <p className="text-[10px] text-gray-500 font-medium">基于最新大模型，随时解答你的数学疑问</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[#FAFAFA]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="h-16 w-16 bg-black rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg">
              <Bot className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">今天想学习什么数学知识？</h1>
            <p className="text-sm text-gray-500 mb-12 text-center">我可以帮你解答难题、复习知识点，或者为你生成专属练习题。</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {SUGGESTIONS.map((suggestion, i) => (
                <button 
                  key={i}
                  onClick={() => handleSend(suggestion.text)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 group-hover:text-black group-hover:bg-gray-100 transition-colors">
                    <suggestion.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 pb-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                <div className="shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 border border-gray-100">
                      <Image src="https://picsum.photos/seed/user/100/100" alt="User" width={32} height={32} referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center text-white shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className={cn(
                  "max-w-[80%] text-[15px] leading-relaxed",
                  msg.role === 'user' ? "text-right" : "text-left"
                )}>
                  <div className="font-bold text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                    {msg.role === 'user' ? '你' : 'AI 导师'}
                  </div>
                  <div className={cn(
                    "inline-block px-5 py-3.5 shadow-sm",
                    msg.role === 'user' 
                      ? "bg-[#111827] text-white rounded-2xl rounded-tr-sm" 
                      : "bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100"
                  )}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-4">
                <div className="shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center text-white shadow-sm">
                    <Bot className="h-5 w-5" />
                  </div>
                </div>
                <div className="max-w-[80%] text-[15px] leading-relaxed text-left">
                  <div className="font-bold text-xs text-gray-400 mb-1.5 uppercase tracking-wide">AI 导师</div>
                  <div className="inline-block px-5 py-4 bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm">
                    <div className="flex gap-1.5 items-center h-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Paperclip className="h-5 w-5" />
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input);
            }}
            placeholder="输入你的数学问题，或者发送题目截图..."
            className="w-full bg-[#F4F3F0] border-none pl-14 pr-14 py-4 rounded-xl text-[15px] focus:ring-2 focus:ring-gray-200 outline-none transition-all placeholder:text-gray-400"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button 
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="p-2 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-gray-400">AI 可能会产生不准确的信息，请核实重要内容。</p>
        </div>
      </div>

    </div>
  );
}
