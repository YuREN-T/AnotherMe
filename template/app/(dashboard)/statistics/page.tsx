'use client';

import { useState } from 'react';
import { ArrowUpRight, BarChart2, TrendingUp, Users, Clock } from 'lucide-react';

export default function StatisticsPage() {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [activeBar, setActiveBar] = useState<number | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-wide uppercase">数据统计</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">总学习时长</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">124.5</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>本月 +12.5%</span>
          </div>
        </div>
        
        <div className="bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">完成课程数</h3>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">42</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>本周 +4</span>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">平均分数</h3>
            <BarChart2 className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">92%</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>整体 +2.1%</span>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">解答题目数</h3>
            <ArrowUpRight className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">856</p>
          <div className="flex items-center gap-1 mt-2 text-[#4CAF50] text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>本月 +124</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 shadow-sm min-h-[400px] flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">薄弱点分析</h2>
          <div className="flex-1 flex items-end justify-around pb-8 pt-12 border-b border-gray-100 relative">
            {/* Y-axis lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-8 pointer-events-none">
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
              <div className="border-t border-gray-100 w-full"></div>
            </div>
            
            {/* Bars */}
            {[
              { label: '二次函数', val: '错误率 45%', h: 'h-[45%]', bg: 'bg-[#E0573D]' },
              { label: '几何证明', val: '错误率 30%', h: 'h-[30%]', bg: 'bg-black' },
              { label: '概率计算', val: '错误率 15%', h: 'h-[15%]', bg: 'bg-[#4A6FA5]' },
              { label: '相似三角', val: '错误率 25%', h: 'h-[25%]', bg: 'bg-[#F4D03F]' },
              { label: '方程组', val: '错误率 10%', h: 'h-[10%]', bg: 'bg-[#88DBCB]' },
            ].map((bar, i) => (
              <div key={i} 
                   className={`w-12 ${bar.h} ${bar.bg} relative group z-10 cursor-pointer transition-all duration-500 origin-bottom hover:scale-x-110 hover:brightness-110`} 
                   style={{ animation: `growUp 1s ease-out ${i * 0.1}s both` }}
                   onClick={() => setActiveBar(activeBar === i ? null : i)}
                   onMouseEnter={() => setActiveBar(i)}
                   onMouseLeave={() => setActiveBar(null)}
              >
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-500 whitespace-nowrap">{bar.label}</span>
                {/* Tooltip */}
                <div className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded transition-opacity pointer-events-none whitespace-nowrap ${activeBar === i ? 'opacity-100' : 'opacity-0'}`}>
                  {bar.val}
                </div>
              </div>
            ))}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes growUp {
                from { transform: scaleY(0); }
                to { transform: scaleY(1); }
              }
            `}} />
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm min-h-[400px] flex flex-col">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">学习活跃度</h2>
          <div className="flex-1 relative">
            <svg viewBox="0 0 400 250" className="w-full h-full overflow-visible">
              <polyline 
                points="0,200 50,150 100,180 150,100 200,120 250,50 300,80 350,20 400,60" 
                fill="none" 
                stroke="#111827" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="animate-[dash_2s_ease-out_forwards]"
                strokeDasharray="1000"
                strokeDashoffset="1000"
              />
              
              {[
                { cx: 50, cy: 150, val: '2h' },
                { cx: 150, cy: 100, val: '4h' },
                { cx: 250, cy: 50, val: '6h' },
                { cx: 350, cy: 20, val: '8h' },
              ].map((pt, i) => (
                <g key={i} 
                   onMouseEnter={() => setHoveredPoint(i)} 
                   onMouseLeave={() => setHoveredPoint(null)}
                   onClick={() => setHoveredPoint(hoveredPoint === i ? null : i)}
                   className="cursor-pointer"
                >
                  <circle 
                    cx={pt.cx} 
                    cy={pt.cy} 
                    r={hoveredPoint === i ? "6" : "4"} 
                    fill="#111827" 
                    className="transition-all duration-200"
                  />
                  {/* Tooltip */}
                  <g className={`transition-opacity duration-200 ${hoveredPoint === i ? 'opacity-100' : 'opacity-0'}`}>
                    <rect x={pt.cx - 15} y={pt.cy - 25} width="30" height="18" rx="4" fill="#E0573D" />
                    <text x={pt.cx} y={pt.cy - 13} fontSize="10" fill="#FFF" textAnchor="middle" fontWeight="bold">{pt.val}</text>
                  </g>
                </g>
              ))}
              
              <text x="0" y="230" fontSize="10" fill="#9CA3AF">周一</text>
              <text x="66" y="230" fontSize="10" fill="#9CA3AF">周二</text>
              <text x="133" y="230" fontSize="10" fill="#9CA3AF">周三</text>
              <text x="200" y="230" fontSize="10" fill="#9CA3AF">周四</text>
              <text x="266" y="230" fontSize="10" fill="#9CA3AF">周五</text>
              <text x="333" y="230" fontSize="10" fill="#9CA3AF">周六</text>
              <text x="400" y="230" fontSize="10" fill="#9CA3AF">周日</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
