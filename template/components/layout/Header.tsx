'use client';

import { Bell, Search, Calendar, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export function Header() {
  return (
    <header className="h-24 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex-1 max-w-md">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-900 transition-colors" />
          <input
            type="text"
            placeholder="搜索..."
            className="w-full pl-11 pr-4 py-2.5 bg-white border-none focus:ring-2 focus:ring-gray-200 rounded-lg outline-none transition-all duration-300 text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Link href="/notifications" className="text-gray-900 hover:text-black transition-colors relative">
          <Bell className="h-5 w-5" />
        </Link>
        
        <Link href="/calendar" className="text-gray-900 hover:text-black transition-colors relative">
          <Calendar className="h-5 w-5" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-black text-white text-[8px] font-bold flex items-center justify-center rounded-sm">
            8
          </span>
        </Link>

        <div className="flex items-center ml-2">
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full border-2 border-[#F3F2EE] overflow-hidden bg-gray-200 z-10">
              <Image src="https://picsum.photos/seed/user1/100/100" alt="User" width={32} height={32} referrerPolicy="no-referrer" />
            </div>
            <div className="h-8 w-8 rounded-full border-2 border-[#F3F2EE] bg-white flex items-center justify-center text-xs font-bold text-gray-900 z-0">
              +24
            </div>
          </div>
        </div>

        <button className="ml-2 bg-[#E0573D] hover:bg-[#c94d35] text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors shadow-sm">
          添加成员
        </button>
      </div>
    </header>
  );
}
