'use client';

import { useState } from 'react';
import { Camera, Upload, PlayCircle, Clock, FileText } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const recentVideos = [
  { id: 1, title: '数学：圆锥曲线', subject: '数学', date: '今天 10:30', duration: '5 分钟', thumbnail: 'https://picsum.photos/seed/v1/300/200' },
  { id: 2, title: '物理：电磁感应', subject: '物理', date: '昨天 15:20', duration: '8 分钟', thumbnail: 'https://picsum.photos/seed/v2/300/200' },
  { id: 3, title: '化学：氧化还原反应', subject: '化学', date: '10月24日', duration: '6 分钟', thumbnail: 'https://picsum.photos/seed/v3/300/200' },
];

export default function PhotoToVideoPage() {
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">拍照答疑</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Take Photo Card */}
        <div className="bg-[#4A6FA5] p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:bg-[#3d5c8a] transition-colors group relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
             <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />
             </svg>
          </div>
          <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform relative z-10 shadow-lg">
            <Camera className="h-10 w-10 text-gray-900" />
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wide relative z-10">拍照</h2>
          <p className="text-sm text-blue-100 mt-2 relative z-10">拍下你的问题</p>
        </div>

        {/* Upload Image Card */}
        <div className="bg-white p-8 shadow-sm border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:bg-[#F4F3F0] transition-colors group">
          <div className="h-20 w-20 bg-black rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
            <Upload className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">上传图片</h2>
          <p className="text-sm text-gray-500 mt-2">从相册中选择</p>
        </div>
      </div>

      <div className="bg-white p-8 shadow-sm mt-8">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">最近讲解</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentVideos.map((video) => (
            <Link key={video.id} href="/question-explanation" className="group block">
              <div className="relative aspect-video rounded-none overflow-hidden bg-gray-100 mb-4">
                <Image src={video.thumbnail} alt={video.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide">
                  {video.duration}
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{video.subject}</span>
                  <h3 className="font-bold text-gray-900 text-sm mt-1 group-hover:text-[#E0573D] transition-colors line-clamp-2">{video.title}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-2 uppercase tracking-wide font-bold">
                <Clock className="h-3 w-3" />
                {video.date}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
