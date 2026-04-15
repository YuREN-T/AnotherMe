'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Upload, PlayCircle, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProblemVideoJobCreateResponse {
  success: boolean;
  jobId?: string;
  pollUrl?: string;
  pollIntervalMs?: number;
  error?: string;
}

interface ProblemVideoJobResponse {
  success: boolean;
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  step?: string;
  progress?: number;
  errorMessage?: string | null;
  result?: {
    videoUrl?: string;
    durationSec?: number;
    scriptStepsCount?: number;
    debugBundleUrl?: string | null;
  };
  error?: string;
}

interface RecentVideoItem {
  id: string;
  title: string;
  date: string;
  duration: string;
  videoUrl?: string;
  status: 'succeeded' | 'failed';
}

const STORAGE_KEY = 'anotherme:dashboard:recent-problem-videos:v1';

function formatDuration(durationSec?: number) {
  if (!durationSec || durationSec <= 0) return '--';
  const total = Math.round(durationSec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDateLabel(date: Date) {
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) {
    return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function readRecentVideos(): RecentVideoItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentVideoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentVideos(items: RecentVideoItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 12)));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PhotoToVideoPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [problemText, setProblemText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [recentVideos, setRecentVideos] = useState<RecentVideoItem[]>([]);

  useEffect(() => {
    setRecentVideos(readRecentVideos());

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const canGenerate = useMemo(() => selectedImage && !isGenerating, [selectedImage, isGenerating]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const appendRecentVideo = (item: RecentVideoItem) => {
    const next = [item, ...recentVideos.filter((video) => video.id !== item.id)].slice(0, 12);
    setRecentVideos(next);
    saveRecentVideos(next);
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      setErrorText('请先上传题目图片。');
      return;
    }

    setErrorText('');
    setIsGenerating(true);
    setStatusText('正在上传图片...');

    try {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const formData = new FormData();
      formData.append('image', selectedImage);
      if (problemText.trim()) {
        formData.append('problemText', problemText.trim());
      }

      const createResp = await fetch('/api/problem-video', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const createPayload = (await createResp.json()) as ProblemVideoJobCreateResponse;
      if (!createResp.ok || !createPayload.success || !createPayload.jobId) {
        throw new Error(createPayload.error || '创建拍题讲解任务失败。');
      }

      const pollUrl = createPayload.pollUrl || `/api/problem-video/${createPayload.jobId}`;
      const pollIntervalMs = createPayload.pollIntervalMs || 3000;

      const maxPollAttempts = 240;
      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        await sleep(pollIntervalMs);

        const pollResp = await fetch(pollUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        const pollPayload = (await pollResp.json()) as ProblemVideoJobResponse;
        if (!pollResp.ok || !pollPayload.success) {
          throw new Error(pollPayload.error || '查询视频生成状态失败。');
        }

        const progressText =
          typeof pollPayload.progress === 'number' ? ` (${Math.round(pollPayload.progress)}%)` : '';
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        setStatusText(`${pollPayload.step || '视频生成中'}${progressText}`);

        if (pollPayload.status === 'failed') {
          throw new Error(pollPayload.errorMessage || '拍题视频生成失败。');
        }

        if (pollPayload.status === 'succeeded') {
          const result = pollPayload.result || {};
          const title = problemText.trim() || '拍题讲解';
          const item: RecentVideoItem = {
            id: createPayload.jobId,
            title,
            date: formatDateLabel(new Date()),
            duration: formatDuration(result.durationSec),
            videoUrl: result.videoUrl,
            status: 'succeeded',
          };

          appendRecentVideo(item);

          if (result.videoUrl) {
            const titleParam = encodeURIComponent(title);
            const urlParam = encodeURIComponent(result.videoUrl);
            window.location.href = `/question-explanation?title=${titleParam}&videoUrl=${urlParam}`;
            return;
          }

          setStatusText('视频生成成功，但暂未返回可播放地址。');
          return;
        }
      }

      throw new Error('视频生成超时，请稍后重试。');
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : '生成失败，请稍后重试。';
      setErrorText(message);
      appendRecentVideo({
        id: `failed-${Date.now()}`,
        title: problemText.trim() || '拍题讲解',
        date: formatDateLabel(new Date()),
        duration: '--',
        status: 'failed',
      });
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">拍照答疑</h1>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => setSelectedImage(event.target.files?.[0] || null)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={openFilePicker}
          className="bg-[#4A6FA5] p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:bg-[#3d5c8a] transition-colors group relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform relative z-10 shadow-lg">
            <Camera className="h-10 w-10 text-gray-900" />
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wide relative z-10">拍照/选图</h2>
          <p className="text-sm text-blue-100 mt-2 relative z-10">
            {selectedImage ? selectedImage.name : '拍下或选择你的题目图片'}
          </p>
        </button>

        <button
          type="button"
          onClick={openFilePicker}
          className="bg-white p-8 shadow-sm border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:bg-[#F4F3F0] transition-colors group"
        >
          <div className="h-20 w-20 bg-black rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
            <Upload className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">上传图片</h2>
          <p className="text-sm text-gray-500 mt-2">从相册中选择，自动接入真实后端生成</p>
        </button>
      </div>

      <div className="bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-bold text-gray-900 uppercase tracking-wide">题目补充描述 (选填)</label>
        <textarea
          rows={3}
          value={problemText}
          onChange={(event) => setProblemText(event.target.value)}
          placeholder="例如：已知抛物线方程，求离心率并说明步骤"
          className="w-full px-4 py-3 bg-[#F4F3F0] border-none focus:ring-2 focus:ring-gray-300 outline-none transition-all resize-none text-sm"
        />
        {statusText ? <p className="text-sm text-gray-600">{statusText}</p> : null}
        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#E0573D] hover:bg-[#c94d35] text-white font-bold uppercase tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              生成讲解视频
            </>
          )}
        </button>
      </div>

      <div className="bg-white p-8 shadow-sm mt-8">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">最近讲解</h2>
        {recentVideos.length === 0 ? (
          <p className="text-sm text-gray-500">暂无视频记录，先上传题目图片开始生成。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentVideos.map((video) => (
              <Link
                key={video.id}
                href={
                  video.videoUrl
                    ? `/question-explanation?title=${encodeURIComponent(video.title)}&videoUrl=${encodeURIComponent(video.videoUrl)}`
                    : '/question-explanation'
                }
                className="group block"
              >
                <div className="relative aspect-video rounded-none overflow-hidden bg-gray-100 mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4A6FA5] via-[#6d89ba] to-[#9cb5de]" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide">
                    {video.duration}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mt-1 group-hover:text-[#E0573D] transition-colors line-clamp-2">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-2 uppercase tracking-wide font-bold">
                    <Clock className="h-3 w-3" />
                    {video.date}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    状态：{video.status === 'succeeded' ? '成功' : '失败'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
