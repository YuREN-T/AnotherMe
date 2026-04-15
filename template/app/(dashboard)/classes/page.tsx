'use client';

import { BookOpen, Clock, PlayCircle, MoreHorizontal, Filter, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const classes = [
  { id: 1, title: '物理：牛顿运动定律', subject: '物理', progress: 100, lastAccessed: '2小时前', status: 'completed', image: 'https://picsum.photos/seed/physics/400/200' },
  { id: 2, title: '数学：微积分基础', subject: '数学', progress: 45, lastAccessed: '昨天', status: 'in-progress', image: 'https://picsum.photos/seed/math/400/200' },
  { id: 3, title: '化学：有机化学', subject: '化学', progress: 10, lastAccessed: '3天前', status: 'in-progress', image: 'https://picsum.photos/seed/chemistry/400/200' },
  { id: 4, title: '生物：细胞结构', subject: '生物', progress: 0, lastAccessed: '从未', status: 'not-started', image: 'https://picsum.photos/seed/biology/400/200' },
  { id: 5, title: '英语：文学', subject: '英语', progress: 80, lastAccessed: '1周前', status: 'in-progress', image: 'https://picsum.photos/seed/english/400/200' },
  { id: 6, title: '历史：世界大战', subject: '历史', progress: 100, lastAccessed: '2周前', status: 'completed', image: 'https://picsum.photos/seed/history/400/200' },
];

export default function ClassesPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">我的课程</h1>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索课程..." 
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-gray-300 outline-none transition-all placeholder:text-gray-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wide">
            <Filter className="h-4 w-4" /> 筛选
          </button>
          <Link href="/create-class" className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors uppercase tracking-wide">
            <Plus className="h-4 w-4" /> 新建课程
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-white group shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
            <div className="relative h-40 overflow-hidden bg-gray-100">
              <Image 
                src={cls.image} 
                alt={cls.title} 
                fill 
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center text-black hover:scale-110 transition-transform">
                  <PlayCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="absolute top-4 left-4">
                <span className="px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wide">
                  {cls.subject}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{cls.title}</h3>
                <button className="text-gray-400 hover:text-gray-900 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-6">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {cls.lastAccessed}
                </span>
              </div>
              
              <div className="mt-auto">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide mb-2">
                  <span className={cls.progress === 100 ? 'text-[#4CAF50]' : 'text-gray-500'}>
                    {cls.progress === 100 ? '已完成' : `进度 ${cls.progress}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#F4F3F0] overflow-hidden">
                  <div 
                    className={`h-full ${cls.progress === 100 ? 'bg-[#4CAF50]' : 'bg-[#E0573D]'}`} 
                    style={{ width: `${cls.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
