'use client';

import { ArrowLeft, Play, Pause, Volume2, Maximize, MessageSquare, ThumbsUp, Bookmark, Share2, FileText } from 'lucide-react';
import Link from 'next/link';

export default function QuestionExplanationPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/photo-to-video" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-900" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">数学：圆锥曲线</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-none aspect-video relative overflow-hidden group shadow-sm">
            {/* Mock Video Content */}
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="text-4xl font-mono text-white mb-4">e = c / a</div>
                <p className="text-gray-400 text-sm uppercase tracking-wide font-bold">AI 导师讲解中...</p>
              </div>
            </div>
            
            {/* Video Controls Overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-4 text-white">
                <button className="hover:text-[#E0573D] transition-colors"><Play className="h-6 w-6" /></button>
                <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden cursor-pointer">
                  <div className="h-full bg-[#E0573D] w-1/3"></div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide">01:15 / 03:45</span>
                <button className="hover:text-[#E0573D] transition-colors"><Volume2 className="h-5 w-5" /></button>
                <button className="hover:text-[#E0573D] transition-colors"><Maximize className="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-black flex items-center justify-center text-xl">👨‍🏫</div>
              <div>
                <p className="font-bold text-gray-900 text-sm">AI 数学导师</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mt-0.5">专属讲解</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-4 py-2 hover:bg-[#F4F3F0] text-gray-600 text-xs font-bold uppercase tracking-wide transition-colors">
                <ThumbsUp className="h-4 w-4" /> 有用
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 hover:bg-[#F4F3F0] text-gray-600 text-xs font-bold uppercase tracking-wide transition-colors">
                <Bookmark className="h-4 w-4" /> 收藏
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 hover:bg-[#F4F3F0] text-gray-600 text-xs font-bold uppercase tracking-wide transition-colors">
                <Share2 className="h-4 w-4" /> 分享
              </button>
            </div>
          </div>
        </div>

        {/* Right: Steps & Similar Questions */}
        <div className="space-y-6">
          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              步骤解析
            </h2>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gray-200">
              <div className="relative flex items-start gap-4">
                <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 z-10 ring-4 ring-white">1</div>
                <div className="pt-1">
                  <h3 className="font-bold text-gray-900 text-sm">理解条件</h3>
                  <p className="text-xs text-gray-500 mt-1">将几何关系转化为代数方程。</p>
                </div>
              </div>
              <div className="relative flex items-start gap-4">
                <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 z-10 ring-4 ring-white">2</div>
                <div className="pt-1">
                  <h3 className="font-bold text-gray-900 text-sm">建立关系</h3>
                  <p className="text-xs text-gray-500 mt-1">使用 a² = b² + c² 进行代换。</p>
                </div>
              </div>
              <div className="relative flex items-start gap-4">
                <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 z-10 ring-4 ring-white">3</div>
                <div className="pt-1">
                  <h3 className="font-bold text-gray-900 text-sm">求解离心率 e</h3>
                  <p className="text-xs text-gray-500 mt-1">化简方程并求解 e，注意其取值范围。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">相似题目</h2>
            <div className="space-y-3">
              <div className="p-4 bg-[#F4F3F0] hover:bg-gray-100 cursor-pointer transition-colors">
                <p className="text-sm font-bold text-gray-900">椭圆离心率的取值范围</p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-bold">难度：中等</p>
              </div>
              <div className="p-4 bg-[#F4F3F0] hover:bg-gray-100 cursor-pointer transition-colors">
                <p className="text-sm font-bold text-gray-900">渐近线与离心率的关系</p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-bold">难度：困难</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
