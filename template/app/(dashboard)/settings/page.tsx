'use client';

import { User, Bell, Shield, Monitor, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">设置</h1>
      </div>

      <div className="bg-white shadow-sm flex flex-col md:flex-row min-h-[600px]">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 bg-[#F4F3F0] p-6 space-y-2 shrink-0 border-r border-gray-200/50">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-black text-white font-bold uppercase tracking-wide text-xs shadow-sm">
            <User className="h-4 w-4" /> 个人资料
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wide text-xs transition-colors">
            <Sparkles className="h-4 w-4" /> AI 偏好
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wide text-xs transition-colors">
            <Bell className="h-4 w-4" /> 通知设置
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wide text-xs transition-colors">
            <Shield className="h-4 w-4" /> 安全中心
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wide text-xs transition-colors">
            <Monitor className="h-4 w-4" /> 外观设置
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-8">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-8">个人信息</h2>
          
          <div className="space-y-8">
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden">
                <Image src="https://picsum.photos/seed/user/100/100" alt="User" width={80} height={80} referrerPolicy="no-referrer" />
              </div>
              <div>
                <button className="px-4 py-2 bg-white border-2 border-gray-200 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors uppercase tracking-wide">
                  更换头像
                </button>
                <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide font-bold">支持 JPG, PNG，最大 5MB</p>
              </div>
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">姓名</label>
                <input
                  type="text"
                  defaultValue="Annette Black"
                  className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">年级</label>
                <select defaultValue="高二" className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all text-sm">
                  <option>高一</option>
                  <option>高二</option>
                  <option>高三</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">邮箱</label>
                <input
                  type="email"
                  defaultValue="An-black@gmail.com"
                  className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">电话号码</label>
                <input
                  type="tel"
                  defaultValue="+1 (555) 000-0000"
                  className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div className="pt-8 flex justify-end">
              <button className="px-8 py-3 bg-[#E0573D] hover:bg-[#c94d35] text-white text-sm font-bold uppercase tracking-wide transition-all shadow-sm">
                保存更改
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
