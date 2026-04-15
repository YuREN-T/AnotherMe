'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, ThumbsUp, Bookmark, Share2, FileText } from 'lucide-react';
import Link from 'next/link';

export default function QuestionExplanationPage() {
  const [title, setTitle] = useState('题目讲解');
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTitle = params.get('title');
    const urlVideo = params.get('videoUrl');

    if (urlTitle) {
      setTitle(urlTitle);
    }
    if (urlVideo) {
      setVideoUrl(urlVideo);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/photo-to-video" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-900" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">{title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-none aspect-video relative overflow-hidden group shadow-sm">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="h-full w-full"
                preload="metadata"
              >
                你的浏览器不支持视频播放。
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-white mb-4">暂无可播放视频</div>
                  <p className="text-gray-400 text-sm uppercase tracking-wide font-bold">
                    请返回“拍照答疑”重新生成
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-black flex items-center justify-center text-xl">👨‍🏫</div>
              <div>
                <p className="font-bold text-gray-900 text-sm">AI 数学导师</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mt-0.5">
                  专属讲解
                </p>
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

        <div className="space-y-6">
          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              步骤解析
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-[#F4F3F0]">
                <p className="text-sm font-bold text-gray-900">1. 识别题型与已知条件</p>
                <p className="text-xs text-gray-500 mt-1">系统先对图片进行 OCR 与题型归类。</p>
              </div>
              <div className="p-4 bg-[#F4F3F0]">
                <p className="text-sm font-bold text-gray-900">2. 生成解题路径</p>
                <p className="text-xs text-gray-500 mt-1">根据题型自动生成分步讲解脚本。</p>
              </div>
              <div className="p-4 bg-[#F4F3F0]">
                <p className="text-sm font-bold text-gray-900">3. 合成语音与视频</p>
                <p className="text-xs text-gray-500 mt-1">通过真实后端任务输出最终讲解视频。</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              使用建议
            </h2>
            <p className="text-sm text-gray-600 leading-7">
              如果视频中有步骤不清楚，建议回到“拍照答疑”补充文字条件，例如“请详细展开第二步推导”。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
