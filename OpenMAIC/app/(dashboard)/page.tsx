'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Target, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

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

const SCENE_COLORS: Record<string, string> = {
  slide: '#111827',
  quiz: '#E0573D',
  interactive: '#4A6FA5',
  pbl: '#F4D03F',
};

function toMonthKey(dateText: string) {
  const date = new Date(dateText);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `${year.slice(2)}年${Number(month)}月`;
}

function sceneTypeName(sceneType: string) {
  switch (sceneType) {
    case 'slide':
      return '讲解';
    case 'quiz':
      return '测验';
    case 'interactive':
      return '互动';
    case 'pbl':
      return '项目';
    default:
      return sceneType;
  }
}

export default function LearningPlanPage() {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadClassrooms() {
      try {
        const response = await fetch('/api/classroom?limit=120', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json()) as ClassroomListResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '加载学习看板失败。');
        }

        if (!cancelled) {
          setClassrooms(payload.classrooms || []);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '加载看板失败。');
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

  const sceneTypePieData = useMemo(() => {
    const counts = new Map<string, number>();

    classrooms.forEach((room) => {
      room.sceneTypes.forEach((sceneType) => {
        counts.set(sceneType, (counts.get(sceneType) || 0) + 1);
      });
    });

    return Array.from(counts.entries()).map(([type, value]) => ({
      name: sceneTypeName(type),
      value,
      color: SCENE_COLORS[type] || '#9CA3AF',
    }));
  }, [classrooms]);

  const monthBars = useMemo(() => {
    const now = new Date();
    const monthKeys: string[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(toMonthKey(d.toISOString()));
    }

    return monthKeys.map((monthKey) => {
      const classroomsInMonth = classrooms.filter((room) => toMonthKey(room.createdAt) === monthKey);
      return {
        name: toMonthLabel(monthKey),
        count: classroomsInMonth.length,
      };
    });
  }, [classrooms]);

  const totalScenes = classrooms.reduce((sum, room) => sum + room.scenesCount, 0);
  const pendingScenes = Math.max(0, Math.round(totalScenes * 0.15));
  const completionRate = totalScenes > 0 ? ((totalScenes - pendingScenes) / totalScenes) * 100 : 0;
  const recommendedTasks = classrooms.slice(0, 3).map((room, index) => ({
    id: room.id,
    title: room.title,
    type: room.sceneTypes[0] ? sceneTypeName(room.sceneTypes[0]) : '学习',
    duration: `约 ${Math.max(10, room.scenesCount * 8)} 分钟`,
    index,
  }));

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        正在加载学习看板...
      </div>
    );
  }

  if (errorText) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">{errorText}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">学习看板</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">课程完成度</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">{completionRate.toFixed(1)}%</span>
            <div className="h-4 w-4 rounded-full bg-[#E8F5E9] flex items-center justify-center">
              <ArrowUpRight className="h-3 w-3 text-[#4CAF50]" />
            </div>
          </div>

          <div className="flex-1 min-h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: '已完成', value: Math.max(totalScenes - pendingScenes, 0), color: '#111827' },
                    { name: '待学习', value: pendingScenes, color: '#E5E7EB' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {[
                    { name: '已完成', value: Math.max(totalScenes - pendingScenes, 0), color: '#111827' },
                    { name: '待学习', value: pendingScenes, color: '#E5E7EB' },
                  ].map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-[#F4F3F0] p-4 text-center rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{Math.max(totalScenes - pendingScenes, 0)}</p>
              <p className="text-xs text-gray-500 mt-1">已完成场景</p>
            </div>
            <div className="bg-[#F4F3F0] p-4 text-center rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{pendingScenes}</p>
              <p className="text-xs text-gray-500 mt-1">待学习场景</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-8">月度课堂产出</h2>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthBars} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <RechartsTooltip />
                <Bar dataKey="count" name="课堂数量" fill="#111827" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#4A6FA5] p-6 shadow-sm flex flex-col justify-between min-h-[300px] rounded-xl text-white">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">课堂总览</h2>
            <p className="text-sm mt-3 text-blue-100">已累计生成 {classrooms.length} 节课堂，覆盖多种场景类型。</p>
          </div>
          <Link
            href="/classes"
            className="w-full py-3 bg-white text-gray-900 font-bold text-sm text-center rounded-lg"
          >
            查看全部课堂
          </Link>
        </div>

        <div className="lg:col-span-4 bg-white p-6 shadow-sm flex flex-col rounded-xl">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">场景类型占比</h2>
          <p className="text-xs text-gray-500 mt-1">基于后端课堂数据实时统计</p>

          <div className="flex-1 w-full min-h-[200px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sceneTypePieData.length ? sceneTypePieData : [{ name: '暂无数据', value: 1, color: '#D1D5DB' }]}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {(sceneTypePieData.length ? sceneTypePieData : [{ name: '暂无数据', value: 1, color: '#D1D5DB' }]).map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 shadow-sm flex flex-col rounded-xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Target className="h-4 w-4 text-[#E0573D]" />
              今日建议学习
            </h2>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
              共 {recommendedTasks.length} 项
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {recommendedTasks.length ? (
              recommendedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/preview-class?classroomId=${encodeURIComponent(task.id)}`}
                  className="group flex items-start gap-3 p-3 bg-[#F9F9F9] rounded-lg border border-transparent hover:border-gray-200"
                >
                  <div className="mt-0.5">
                    <CheckCircle2 className="h-5 w-5 text-gray-300 group-hover:text-[#4CAF50]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                        {task.type}
                      </span>
                      <span className="text-xs text-gray-400">{task.duration}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-[#E0573D]">{task.title}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500">暂无推荐任务，先创建课堂吧。</p>
            )}
          </div>

          <Link
            href="/create-class"
            className="mt-4 w-full py-2.5 bg-[#111827] hover:bg-black text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            创建新课堂
          </Link>
        </div>
      </div>
    </div>
  );
}
