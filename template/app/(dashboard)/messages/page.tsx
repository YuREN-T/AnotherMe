'use client';

import { Search, Edit, MoreHorizontal, Phone, Video, Info } from 'lucide-react';
import Image from 'next/image';

const contacts = [
  { id: 1, name: '李教授', role: '物理老师', lastMessage: '下节课见。', time: '上午 10:30', unread: 2, online: true },
  { id: 2, name: '助教 Mia', role: '助教', lastMessage: '这是今天的笔记。', time: '昨天', unread: 0, online: false },
  { id: 3, name: '学习小组 A', role: '3 名成员', lastMessage: '谁想复习第四章？', time: '星期二', unread: 5, online: true },
];

export default function MessagesPage() {
  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)]">
      <div className="bg-white shadow-sm h-full flex overflow-hidden">
        {/* Left Sidebar - Contacts */}
        <div className="w-80 border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">消息中心</h2>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Edit className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索消息..." 
                className="w-full pl-9 pr-4 py-2.5 bg-[#F4F3F0] border-none text-sm focus:ring-2 focus:ring-gray-300 outline-none transition-all placeholder:text-gray-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {contacts.map((contact) => (
              <div key={contact.id} className="p-4 flex items-center gap-3 hover:bg-[#F4F3F0] cursor-pointer transition-colors border-b border-gray-50">
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden">
                    <Image src={`https://picsum.photos/seed/${contact.name}/100/100`} alt={contact.name} width={48} height={48} referrerPolicy="no-referrer" />
                  </div>
                  {contact.online && (
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#4CAF50] border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{contact.name}</h3>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide shrink-0">{contact.time}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{contact.lastMessage}</p>
                </div>
                {contact.unread > 0 && (
                  <div className="h-5 w-5 rounded-full bg-[#E0573D] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {contact.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Area - Chat */}
        <div className="flex-1 flex flex-col bg-[#F9F9F8]">
          {/* Chat Header */}
          <div className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                <Image src="https://picsum.photos/seed/Prof. Lee/100/100" alt="Prof. Lee" width={40} height={40} referrerPolicy="no-referrer" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">李教授</h3>
                <p className="text-[10px] text-[#4CAF50] font-bold uppercase tracking-wide">在线</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Phone className="h-5 w-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Video className="h-5 w-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Info className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center mb-8">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-3 py-1 rounded-full">今天</span>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1">
                <Image src="https://picsum.photos/seed/Prof. Lee/100/100" alt="Prof. Lee" width={32} height={32} referrerPolicy="no-referrer" />
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-900">李教授</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">上午 10:25</span>
                </div>
                <div className="bg-white p-3 shadow-sm text-sm text-gray-800 rounded-tr-lg rounded-b-lg border border-gray-100 inline-block max-w-[80%]">
                  你好！关于牛顿定律的作业有什么问题吗？
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 flex-row-reverse">
              <div>
                <div className="flex items-baseline gap-2 mb-1 justify-end">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">上午 10:28</span>
                  <span className="text-xs font-bold text-gray-900">你</span>
                </div>
                <div className="bg-[#111111] p-3 shadow-sm text-sm text-white rounded-tl-lg rounded-b-lg inline-block max-w-[80%]">
                  是的，我对第三题有点困惑。就是那个关于斜面的问题。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1">
                <Image src="https://picsum.photos/seed/Prof. Lee/100/100" alt="Prof. Lee" width={32} height={32} referrerPolicy="no-referrer" />
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-900">李教授</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">上午 10:30</span>
                </div>
                <div className="bg-white p-3 shadow-sm text-sm text-gray-800 rounded-tr-lg rounded-b-lg border border-gray-100 inline-block max-w-[80%]">
                  啊，那题有点棘手。记住要把重力向量分解为平行和垂直于斜面的分量。我们可以在下节课上讨论。下节课见。
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0">
                <div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-lg leading-none pb-0.5">+</div>
              </button>
              <input 
                type="text" 
                placeholder="输入消息..." 
                className="flex-1 bg-[#F4F3F0] border-none px-4 py-3 text-sm focus:ring-2 focus:ring-gray-300 outline-none transition-all placeholder:text-gray-500"
              />
              <button className="px-6 py-3 bg-[#E0573D] hover:bg-[#c94d35] text-white text-xs font-bold uppercase tracking-wide transition-colors shrink-0">
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
