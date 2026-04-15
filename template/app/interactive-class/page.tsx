'use client';

import { useState } from 'react';
import { ArrowLeft, Mic, Video, MonitorUp, MessageSquare, Send, Hand, Settings, Maximize2 } from 'lucide-react';
import Link from 'next/link';

export default function InteractiveClassPage() {
  const [messages, setMessages] = useState([
    { id: 1, sender: '李教授', role: 'teacher', text: '大家好，今天我们学习匀变速直线运动。', time: '14:30' },
    { id: 2, sender: '助教 Mia', role: 'assistant', text: '请准备好笔记本，记得记下关键公式。', time: '14:31' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: '我', role: 'student', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
  };

  return (
    <div className="h-screen bg-[#111111] flex flex-col font-sans text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-black border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-800 rounded-none transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-300" />
          </Link>
          <h1 className="text-sm font-bold uppercase tracking-wide">物理：牛顿第二定律</h1>
          <span className="px-2 py-1 bg-[#E0573D]/20 text-[#E0573D] text-[10px] uppercase tracking-wide font-bold flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#E0573D] rounded-full animate-pulse"></span>
            直播中
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-800 rounded-none transition-colors text-gray-300">
            <Settings className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-gray-800 rounded-none transition-colors text-gray-300">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video/Whiteboard */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex-1 bg-black border border-gray-800 overflow-hidden relative flex flex-col shadow-lg">
            {/* Whiteboard Area */}
            <div className="flex-1 bg-[#1A1A1A] relative">
              {/* Mock Whiteboard Content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <h2 className="text-4xl font-bold text-white font-mono">v = v₀ + at</h2>
                  <p className="text-gray-400 text-xs uppercase tracking-wide font-bold">速度公式</p>
                </div>
              </div>
            </div>
            
            {/* Teacher Video Overlay */}
            <div className="absolute bottom-4 right-4 w-64 aspect-video bg-gray-900 border-2 border-gray-700 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center text-6xl">👨‍🏫</div>
              <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[10px] uppercase tracking-wide font-bold">李教授</div>
            </div>
          </div>

          {/* Controls */}
          <div className="h-20 bg-black border border-gray-800 flex items-center justify-center gap-6 shadow-lg">
            <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
              <div className="h-10 w-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700">
                <Mic className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide font-bold">静音</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
              <div className="h-10 w-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700">
                <Video className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide font-bold">视频</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
              <div className="h-10 w-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700">
                <Hand className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide font-bold">举手</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-[#E0573D] hover:text-[#c94d35] transition-colors ml-8">
              <div className="h-10 w-10 bg-[#E0573D]/20 flex items-center justify-center hover:bg-[#E0573D]/30">
                <MonitorUp className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide font-bold">结束课堂</span>
            </button>
          </div>
        </div>

        {/* Right: Chat & Interaction */}
        <div className="w-80 bg-black border-l border-gray-800 flex flex-col">
          <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wide">实时聊天</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'student' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{msg.sender}</span>
                  <span className="text-[10px] text-gray-600">{msg.time}</span>
                </div>
                <div className={`px-4 py-3 max-w-[85%] text-sm ${
                  msg.role === 'student' 
                    ? 'bg-[#E0573D] text-white' 
                    : msg.role === 'teacher'
                      ? 'bg-gray-800 text-gray-100'
                      : 'bg-[#4A6FA5]/20 text-[#4A6FA5] border border-[#4A6FA5]/30'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入消息..."
                className="w-full bg-gray-900 border-none pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-700 transition-all placeholder:text-gray-600"
              />
              <button 
                onClick={handleSend}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white hover:bg-gray-200 transition-colors"
              >
                <Send className="h-4 w-4 text-black" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
