'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock3, Filter, Loader2, Play, Search, Star, TrendingUp, Video } from 'lucide-react';
import {
  MiniBarChart,
  WorkspaceHero,
  WorkspaceMetricCard,
  WorkspacePanel,
  WorkspaceProfilePanel,
  workspaceToneClass,
} from '@/components/workspace/workspace-dashboard';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { cn } from '@/lib/utils';

interface VideoItem {
  id: string;
  title: string;
  subject: string;
  duration: string;
  thumbnail: string;
  difficulty: 'easy' | 'medium' | 'hard';
  views: number;
}

const difficultyLabel: Record<VideoItem['difficulty'], string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export default function ProblemVideoPage() {
  const [videos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const avatar = useUserProfileStore((state) => state.avatar);
  const nickname = useUserProfileStore((state) => state.nickname);
  const bio = useUserProfileStore((state) => state.bio);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsLoading(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const subjects = useMemo(
    () => ['all', ...Array.from(new Set(videos.map((video) => video.subject)))],
    [videos],
  );

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const matchesSearch =
        searchQuery === '' || video.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = selectedSubject === 'all' || video.subject === selectedSubject;
      return matchesSearch && matchesSubject;
    });
  }, [searchQuery, selectedSubject, videos]);

  const subjectCounts = useMemo(() => {
    return subjects
      .filter((subject) => subject !== 'all')
      .map((subject) => ({
        label: subject,
        count: videos.filter((video) => video.subject === subject).length,
      }));
  }, [subjects, videos]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6d7a92]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <WorkspaceHero
          eyebrow="Video Shelf"
          title="把题目视频页做成更像推荐平台而不是纯列表。"
          description="参考第四张图的卡片并置方式：上层是主推荐和检索，下层再展示分类、热度和视频卡片，让页面更像内容产品。"
          badges={[
            `${videos.length} 个视频`,
            `${Math.max(subjects.length - 1, 0)} 个科目`,
            `${filteredVideos.length} 个当前结果`,
          ]}
          tone="sky"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceMetricCard
              label="推荐时长"
              value="15 分钟"
              note="优先推送可在一次专注周期内看完的讲解。"
              tone="sun"
              icon={Clock3}
            />
            <WorkspaceMetricCard
              label="观看热度"
              value={`${videos.reduce((sum, video) => sum + video.views, 0)}`}
              note="更高的观看量会优先进入精选模块。"
              tone="peach"
              icon={TrendingUp}
            />
          </div>
        </WorkspaceHero>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <WorkspacePanel
            title="视频检索与推荐"
            subtitle="把搜索、筛选和内容卡做在同一块主舞台上，缩短找题到开看的路径。"
            icon={Video}
            tone="sun"
            className="min-h-[560px]"
          >
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c99af]" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索视频标题..."
                    className="h-12 w-full rounded-[1.2rem] border border-[#dde6f3] bg-white/92 pl-11 pr-4 text-sm text-[#263247] outline-none transition focus:border-[#9cb9ff] focus:ring-4 focus:ring-[#9cb9ff]/15"
                  />
                </div>
                <select
                  aria-label="按科目筛选视频"
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  className="h-12 rounded-[1.2rem] border border-[#ece2f9] bg-white/86 px-4 text-sm text-[#39465f] outline-none"
                >
                  <option value="all">全部科目</option>
                  {subjects
                    .filter((subject) => subject !== 'all')
                    .map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid max-h-[430px] gap-3 overflow-auto pr-1">
                {filteredVideos.length ? (
                  filteredVideos.map((video, index) => (
                    <div
                      key={video.id}
                      className={cn(
                        'rounded-[1.5rem] border p-4 shadow-[0_14px_30px_rgba(89,90,110,0.06)]',
                        workspaceToneClass(
                          index % 3 === 0 ? 'peach' : index % 3 === 1 ? 'sky' : 'violet',
                        ),
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-[1.3rem] border border-white/80 bg-white/90 text-3xl shadow-[0_10px_22px_rgba(89,90,110,0.08)]">
                          {video.thumbnail}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[11px] font-semibold text-[#51627d]">
                              {video.subject}
                            </span>
                            <span className="rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[11px] font-semibold text-[#6f7f9a]">
                              {difficultyLabel[video.difficulty]}
                            </span>
                          </div>
                          <p className="mt-3 truncate text-base font-semibold text-[#212734]">
                            {video.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#5f6d84]">
                            <span>{video.duration}</span>
                            <span>{video.views} 次观看</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`播放视频：${video.title}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#20232b] text-white shadow-[0_16px_30px_rgba(31,35,43,0.18)] transition hover:-translate-y-0.5"
                        >
                          <Play className="ml-0.5 h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="workspace-empty-box flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                    <Video className="h-10 w-10 text-[#97a6bb]" />
                    <div>
                      <p className="font-semibold text-[#53627b]">没有找到对应视频</p>
                      <p className="mt-1 text-sm text-[#74839a]">换个关键词，或者切换科目筛选。</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </WorkspacePanel>
        </motion.div>

        <div className="grid gap-4">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <WorkspaceProfilePanel avatar={avatar} nickname={nickname} bio={bio} tone="peach" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <WorkspacePanel
              title="科目热度"
              subtitle="不同科目的视频数量做成条形图，比纯文本统计更有识别度。"
              icon={Filter}
              tone="mint"
            >
              <MiniBarChart
                values={subjectCounts.length ? subjectCounts.map((item) => item.count || 1) : [1]}
                labels={subjectCounts.length ? subjectCounts.map((item) => item.label) : ['空']}
              />
            </WorkspacePanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            <WorkspacePanel
              title="精选推荐"
              subtitle="用更精致的小型内容卡代替以前单调的推荐列表。"
              icon={Star}
              tone="violet"
            >
              <div className="space-y-3">
                {videos.length ? (
                  videos.slice(0, 3).map((video, index) => (
                    <div
                      key={video.id}
                      className={cn(
                        'rounded-[1.35rem] border p-4 shadow-[0_12px_26px_rgba(89,90,110,0.05)]',
                        workspaceToneClass(index % 2 === 0 ? 'sun' : 'teal'),
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/80 bg-white/88 text-xl">
                          {video.thumbnail}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#212734]">
                            {video.title}
                          </p>
                          <p className="mt-1 text-xs text-[#6b7a91]">
                            {video.subject} · {video.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="workspace-empty-box flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
                    <Star className="h-8 w-8 text-[#97a6bb]" />
                    <div>
                      <p className="font-semibold text-[#53627b]">暂无推荐视频</p>
                      <p className="mt-1 text-sm text-[#74839a]">
                        当题目视频生成后，这里会展示推荐内容。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </WorkspacePanel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
