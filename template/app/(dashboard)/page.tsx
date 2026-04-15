'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, Target, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const mathTopicsData = [
  { name: '代数', value: 40, color: '#111827' },
  { name: '几何', value: 30, color: '#E0573D' },
  { name: '函数', value: 20, color: '#4A6FA5' },
  { name: '概率与统计', value: 10, color: '#F4D03F' },
];

const learningTimeMonth = [
  { name: '6月', hours: 22 },
  { name: '7月', hours: 35 },
  { name: '8月', hours: 21 },
  { name: '9月', hours: 28 },
  { name: '10月', hours: 42 },
  { name: '11月', hours: 30 },
];

const learningTimeWeek = [
  { name: '周一', hours: 2 },
  { name: '周二', hours: 3.5 },
  { name: '周三', hours: 1.5 },
  { name: '周四', hours: 4 },
  { name: '周五', hours: 2.5 },
  { name: '周六', hours: 5 },
  { name: '周日', hours: 4.5 },
];

const recommendedTasks = [
  { id: 1, title: '复习二次函数图像与性质', type: '复习', duration: '30分钟' },
  { id: 2, title: '完成相似三角形课后练习', type: '练习', duration: '45分钟' },
  { id: 3, title: '预习一元二次方程解法', type: '预习', duration: '20分钟' },
];

export default function LearningPlanPage() {
  const [mounted, setMounted] = useState(false);
  const [timeView, setTimeView] = useState<'month' | 'week'>('month');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">学习看板</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Left: Course Completion */}
        <div className="lg:col-span-4 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">课程完成度</h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">83.3%</span>
            <div className="h-4 w-4 rounded-full bg-[#E8F5E9] flex items-center justify-center">
              <ArrowUpRight className="h-3 w-3 text-[#4CAF50]" />
            </div>
          </div>
          
          <div className="flex-1 min-h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: '已完成', value: 210, color: '#111827' },
                    { name: '待学习', value: 42, color: '#F4F3F0' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {
                    [
                      { name: '已完成', value: 210, color: '#111827' },
                      { name: '待学习', value: 42, color: '#E5E7EB' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))
                  }
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-[#F4F3F0] p-4 text-center hover:bg-gray-100 transition-colors cursor-pointer rounded-lg">
              <p className="text-2xl font-bold text-gray-900">210</p>
              <p className="text-xs text-gray-500 mt-1">已完成课时</p>
            </div>
            <div className="bg-[#F4F3F0] p-4 text-center hover:bg-gray-100 transition-colors cursor-pointer rounded-lg">
              <p className="text-2xl font-bold text-gray-900">42</p>
              <p className="text-xs text-gray-500 mt-1">待学习课时</p>
            </div>
          </div>
        </div>

        {/* Top Right: Study Hours */}
        <div className="lg:col-span-8 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-8">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">学习时长</h2>
            <select 
              className="text-xs border-none bg-[#F4F3F0] px-3 py-1.5 rounded-md text-gray-700 font-medium outline-none cursor-pointer hover:bg-gray-200 transition-colors"
              value={timeView}
              onChange={(e) => setTimeView(e.target.value as 'month' | 'week')}
            >
              <option value="month">按月视图</option>
              <option value="week">按周视图</option>
            </select>
          </div>
          
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              {timeView === 'month' ? (
                <LineChart data={learningTimeMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <RechartsTooltip 
                    cursor={{ stroke: '#E5E7EB', strokeWidth: 2, strokeDasharray: '4 4' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="hours" 
                    name="学习时长(小时)"
                    stroke="#111827" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#111827', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#E0573D', strokeWidth: 0 }}
                    animationDuration={1500}
                  />
                </LineChart>
              ) : (
                <BarChart data={learningTimeWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <RechartsTooltip 
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="hours" 
                    name="学习时长(小时)"
                    fill="#111827" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1000}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Left: Upgrade Pro Plan */}
        <div className="lg:col-span-4 bg-[#4A6FA5] p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[300px] group rounded-xl">
          <div className="flex justify-between items-start relative z-10">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">升级高级版</h2>
            <button className="h-8 w-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors group-hover:scale-110">
              <ArrowUpRight className="h-4 w-4 text-gray-900" />
            </button>
          </div>
          
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 opacity-20 transition-transform duration-700 group-hover:scale-110">
             <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                  <path d="M25 0 L50 14.4 L50 43.3 L25 57.7 L0 43.3 L0 14.4 Z" fill="none" stroke="#FFFFFF" strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#hexagons)" />
             </svg>
          </div>

          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 h-48 z-0 transition-transform duration-500 group-hover:-translate-y-2">
             <Image src="https://picsum.photos/seed/student/400/400" alt="Student" fill className="object-cover rounded-full opacity-80 mix-blend-luminosity" referrerPolicy="no-referrer" />
          </div>

          <button className="w-full py-3 bg-white text-gray-900 font-bold text-sm relative z-10 hover:bg-gray-50 transition-colors shadow-lg active:scale-95 rounded-lg">
            14天免费试用
          </button>
        </div>

        {/* Bottom Middle: Math Topics Pie Chart */}
        <div className="lg:col-span-4 bg-white p-6 shadow-sm flex flex-col rounded-xl">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">最近学习知识点</h2>
              <p className="text-xs text-gray-500 mt-1">初中数学各模块占比</p>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[200px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mathTopicsData}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {mathTopicsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => `${value}%`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: '#4B5563' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Right: Today's Recommendations */}
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
            {recommendedTasks.map((task) => (
              <div key={task.id} className="group flex items-start gap-3 p-3 bg-[#F9F9F9] hover:bg-gray-50 rounded-lg transition-all border border-transparent hover:border-gray-200 cursor-pointer">
                <div className="mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-gray-300 group-hover:text-[#4CAF50] transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                      {task.type}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      {task.duration}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-[#E0573D] transition-colors">
                    {task.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="mt-4 w-full py-2.5 bg-[#111827] hover:bg-black text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <BookOpen className="h-4 w-4" />
            开始今日学习
          </button>
        </div>

      </div>
    </div>
  );
}

