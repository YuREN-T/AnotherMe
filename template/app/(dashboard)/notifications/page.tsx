'use client';

import { Bell, MessageSquare, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

const notifications = [
  { id: 1, type: 'alert', title: '即将开始的课程', message: '物理：牛顿运动定律 将在 15 分钟后开始。', time: '15 分钟前', read: false, icon: Calendar, color: 'text-[#E0573D]', bg: 'bg-[#E0573D]/10' },
  { id: 2, type: 'message', title: '新消息', message: '李教授回复了你关于导数的问题。', time: '2 小时前', read: false, icon: MessageSquare, color: 'text-[#4A6FA5]', bg: 'bg-[#4A6FA5]/10' },
  { id: 3, type: 'system', title: '系统更新', message: '新的 AI 导师功能现已上线。', time: '1 天前', read: true, icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  { id: 4, type: 'success', title: '达成目标', message: '你本周已完成 10 小时的学习！', time: '2 天前', read: true, icon: CheckCircle2, color: 'text-[#4CAF50]', bg: 'bg-[#4CAF50]/10' },
];

export default function NotificationsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">通知中心</h1>
        <button className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wide transition-colors">
          全部标为已读
        </button>
      </div>

      <div className="bg-white shadow-sm">
        <div className="divide-y divide-gray-100">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-6 flex gap-4 hover:bg-[#F4F3F0] transition-colors cursor-pointer ${notification.read ? 'opacity-70' : ''}`}
            >
              <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${notification.bg}`}>
                <notification.icon className={`h-6 w-6 ${notification.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h3 className={`text-sm font-bold text-gray-900 ${!notification.read ? 'flex items-center gap-2' : ''}`}>
                    {notification.title}
                    {!notification.read && <span className="h-2 w-2 rounded-full bg-[#E0573D]"></span>}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{notification.time}</span>
                </div>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
