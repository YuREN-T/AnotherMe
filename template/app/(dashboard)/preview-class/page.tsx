'use client';

import { PlayCircle, Users, FileText, Clock, Edit3 } from 'lucide-react';
import Link from 'next/link';

export default function PreviewClassPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">课堂预览</h1>
        </div>
        <Link 
          href="/interactive-class"
          className="flex items-center gap-2 px-6 py-3 bg-[#E0573D] hover:bg-[#c94d35] text-white font-bold uppercase tracking-wide transition-all text-sm"
        >
          <PlayCircle className="h-4 w-4" />
          开始上课
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content: Script & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                大纲与脚本
              </h2>
              <button className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wide flex items-center gap-1">
                <Edit3 className="h-3 w-3" /> 编辑
              </button>
            </div>
            
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gray-200">
              {/* Timeline Item 1 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-black text-white font-bold text-sm shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  1
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 bg-[#F4F3F0] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm">引入与概念</h3>
                    <span className="text-[10px] font-bold text-gray-900 bg-white px-2 py-1 uppercase tracking-wide">10 分钟</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">通过生活中的落体现象引入匀变速直线运动，讲解核心公式 v = v0 + at。</p>
                </div>
              </div>
              
              {/* Timeline Item 2 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-black text-white font-bold text-sm shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  2
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 bg-[#F4F3F0] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm">白板推导</h3>
                    <span className="text-[10px] font-bold text-gray-900 bg-white px-2 py-1 uppercase tracking-wide">15 分钟</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">使用虚拟白板推导位移公式，结合 v-t 图像进行直观演示。</p>
                </div>
              </div>

              {/* Timeline Item 3 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-black text-white font-bold text-sm shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  3
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 bg-[#F4F3F0] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-sm">互动测验</h3>
                    <span className="text-[10px] font-bold text-gray-900 bg-white px-2 py-1 uppercase tracking-wide">10 分钟</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">推送 3 道精选选择题，并根据学生的作答情况进行针对性讲解。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Agents & Config */}
        <div className="space-y-6">
          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-6">
              <Users className="h-4 w-4 text-gray-400" />
              AI 导师团队
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[#F4F3F0]">
                <div className="h-10 w-10 bg-black flex items-center justify-center text-xl">👨‍🏫</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">李教授</h3>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">主讲老师</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-[#F4F3F0]">
                <div className="h-10 w-10 bg-white border border-gray-200 flex items-center justify-center text-xl">👩‍🎓</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">助教 Mia</h3>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">答疑 / 测验</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">课堂信息</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">时长</span>
                <span className="font-bold text-gray-900 text-sm">35 分钟</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">知识点</span>
                <span className="font-bold text-gray-900 text-sm">4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">测验题</span>
                <span className="font-bold text-gray-900 text-sm">3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
