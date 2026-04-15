'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart2, TrendingUp, Users, Clock, Loader2 } from 'lucide-react';

interface ClassroomSummary {
  id: string;
  title: string;
  language?: string;
  createdAt: string;
  scenesCount: number;
  sceneTypes: string[];
}

interface ClassroomListResponse {
  success: boolean;
  classrooms?: ClassroomSummary[];
  error?: string;
}

function weekLabel(dateText: string) {
  const date = new Date(dateText);
  const day = date.getDay();
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[day] || '未知';
}

export default function StatisticsPage() {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [activeBar, setActiveBar] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadClassrooms() {
      try {
        const response = await fetch('/api/classroom?limit=180', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json()) as ClassroomListResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '加载统计数据失败。');
        }

        if (!cancelled) {
          setClassrooms(payload.classrooms || []);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '统计数据加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadClassrooms();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const totalClassrooms = classrooms.length;
    const totalScenes = classrooms.reduce((sum, room) => sum + room.scenesCount, 0);
    const totalHours = (totalScenes * 8) / 60;
    const avgScenes = totalClassrooms ? totalScenes / totalClassrooms : 0;

    const sceneTypeCounter = new Map<string, number>();
    classrooms.forEach((room) => {
      room.sceneTypes.forEach((sceneType) => {
        sceneTypeCounter.set(sceneType, (sceneTypeCounter.get(sceneType) || 0) + 1);
      });
    });

    const weakSpots = Array.from(sceneTypeCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sceneType, count]) => ({
        label: sceneType,
        count,
      }));

    const weekCounter = new Map<string, number>();
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach((name) => {
      weekCounter.set(name, 0);
    });
    classrooms.forEach((room) => {
      const key = weekLabel(room.createdAt);
      weekCounter.set(key, (weekCounter.get(key) || 0) + 1);
    });

    const weekly = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((name) => ({
      name,
      value: weekCounter.get(name) || 0,
    }));

    return {
      totalClassrooms,
      totalScenes,
      totalHours,
      avgScenes,
      weakSpots,
      weekly,
    };
  }, [classrooms]);

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        正在加载统计数据...
      </div>
    );
  }

  if (errorText) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">{errorText}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">数据统计</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">累计课堂时长</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.totalHours.toFixed(1)}h</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>基于真实课堂场景估算</span>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">课堂总数</h3>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.totalClassrooms}</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>来自 /api/classroom</span>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">平均场景数</h3>
            <BarChart2 className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.avgScenes.toFixed(1)}</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>每节课堂平均场景</span>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">总场景数</h3>
            <ArrowUpRight className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.totalScenes}</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>讲解 + 测验 + 互动 + 项目</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 shadow-sm min-h-[380px] flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">场景类型分布</h2>
          <div className="flex-1 flex items-end justify-around pb-8 pt-12 border-b border-gray-100 relative">
            <div className="absolute inset-0 flex flex-col justify-between pb-8 pointer-events-none">
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
            </div>

            {(totals.weakSpots.length ? totals.weakSpots : [{ label: '暂无数据', count: 1 }]).map(
              (bar, i, list) => {
                const max = Math.max(...list.map((item) => item.count));
                const height = Math.max(12, Math.round((bar.count / max) * 70));
                return (
                  <div
                    key={bar.label}
                    className="relative z-10 cursor-pointer"
                    onMouseEnter={() => setActiveBar(i)}
                    onMouseLeave={() => setActiveBar(null)}
                  >
                    <div
                      className="w-12 bg-[#111827] transition-all duration-300"
                      style={{ height: `${height}%` }}
                    />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-500 whitespace-nowrap">
                      {bar.label}
                    </span>
                    <div
                      className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap ${activeBar === i ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {bar.count}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm min-h-[380px] flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">周内课堂活跃度</h2>
          <div className="flex-1 relative">
            <svg viewBox="0 0 400 250" className="w-full h-full overflow-visible">
              <polyline
                points={totals.weekly
                  .map((item, index) => {
                    const x = (index / 6) * 400;
                    const max = Math.max(...totals.weekly.map((i) => i.value), 1);
                    const y = 210 - (item.value / max) * 170;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#111827"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {totals.weekly.map((item, i) => {
                const x = (i / 6) * 400;
                const max = Math.max(...totals.weekly.map((j) => j.value), 1);
                const y = 210 - (item.value / max) * 170;
                return (
                  <g key={item.name}>
                    <circle cx={x} cy={y} r="4" fill="#111827" />
                    <text x={x} y={y - 10} fontSize="10" fill="#6B7280" textAnchor="middle">
                      {item.value}
                    </text>
                    <text x={x} y="230" fontSize="10" fill="#9CA3AF" textAnchor="middle">
                      {item.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
