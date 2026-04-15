'use client';

import { useState } from 'react';
import { Upload, Sparkles, Settings2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateClassPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      router.push('/preview-class');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">创建课堂</h1>
      </div>

      <div className="bg-white p-8 shadow-sm">
        <div className="space-y-8">
          {/* Topic Input */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">课程主题</label>
            <input
              type="text"
              placeholder="例如：物理：牛顿运动定律"
              className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all text-sm"
            />
          </div>

          {/* Course Requirements */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">课程要求 (选填)</label>
            <textarea
              rows={3}
              placeholder="例如：重点讲解公式推导，提供生活中的实际案例..."
              className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 rounded-none outline-none transition-all resize-none text-sm"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">学习资料</label>
            <div className="mt-2 flex justify-center border-2 border-dashed border-gray-300 px-6 py-12 hover:bg-[#F4F3F0] transition-colors cursor-pointer group">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 bg-black text-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                  <span className="relative cursor-pointer bg-transparent font-bold text-[#E0573D] hover:text-[#c94d35]">
                    点击上传
                  </span>
                  <p className="pl-1">或拖拽文件到此处</p>
                </div>
                <p className="text-xs leading-5 text-gray-500 mt-2">支持 PDF, DOCX, PNG, JPG，最大 50MB</p>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="pt-6 border-t border-gray-100">
            <button className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wide">
              <Settings2 className="h-4 w-4" />
              高级设置
            </button>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-8 py-4 bg-[#E0573D] hover:bg-[#c94d35] text-white font-bold uppercase tracking-wide transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  生成课堂
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
