'use client';

import { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays,
  parseISO
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  time: string;
  type: 'study' | 'exam' | 'homework';
  date: string; // YYYY-MM-DD
};

const INITIAL_TASKS: Task[] = [
  { id: '1', title: '完成二次函数练习册', time: '14:00', type: 'homework', date: format(new Date(), 'yyyy-MM-dd') },
  { id: '2', title: '数学周测', time: '09:00', type: 'exam', date: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
  { id: '3', title: '预习相似三角形', time: '20:00', type: 'study', date: format(addDays(new Date(), -1), 'yyyy-MM-dd') },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null); // date string
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const jumpToToday = () => setCurrentDate(new Date());

  const handleAddTask = (dateStr: string) => {
    if (!newTaskTitle.trim()) {
      setIsAddingTask(null);
      return;
    }
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      time: '12:00',
      type: 'study',
      date: dateStr,
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-wide">
            {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
          </h1>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1 shadow-sm">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button onClick={jumpToToday} className="px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors">
              今天
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-[#111827] hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          新建任务
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const dateFormat = "EEEE";
    const days = [];
    let startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center py-3 border-b border-gray-200">
          {format(addDays(startDate, i), dateFormat, { locale: zhCN }).replace('星期', '周')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 bg-[#F9F9F8] rounded-t-xl border border-gray-200 border-b-0">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const dateStr = format(cloneDay, 'yyyy-MM-dd');
        const dayTasks = tasks.filter(t => t.date === dateStr);
        const isToday = isSameDay(day, new Date());
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] bg-white border-r border-b border-gray-200 p-2 transition-colors group relative",
              !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : "text-gray-900",
              isToday ? "bg-blue-50/10" : ""
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={cn(
                "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                isToday ? "bg-[#E0573D] text-white shadow-sm" : ""
              )}>
                {formattedDate}
              </span>
              <button 
                onClick={() => setIsAddingTask(dateStr)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {dayTasks.map(task => (
                <div 
                  key={task.id} 
                  className={cn(
                    "px-2 py-1.5 rounded text-xs font-medium truncate border shadow-sm cursor-pointer hover:shadow transition-shadow",
                    task.type === 'homework' ? "bg-blue-50 text-blue-700 border-blue-100" :
                    task.type === 'exam' ? "bg-red-50 text-red-700 border-red-100" :
                    "bg-amber-50 text-amber-700 border-amber-100"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="h-3 w-3 opacity-70" />
                    <span className="opacity-80 text-[10px]">{task.time}</span>
                  </div>
                  <div className="truncate">{task.title}</div>
                </div>
              ))}
              
              {isAddingTask === dateStr && (
                <div className="mt-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="任务名称..."
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded shadow-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask(dateStr);
                      if (e.key === 'Escape') {
                        setIsAddingTask(null);
                        setNewTaskTitle('');
                      }
                    }}
                    onBlur={() => handleAddTask(dateStr)}
                  />
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-l border-t border-gray-200 rounded-b-xl overflow-hidden">{rows}</div>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 shadow-sm rounded-xl border border-gray-100">
        {renderHeader()}
        <div className="shadow-sm rounded-xl overflow-hidden">
          {renderDays()}
          {renderCells()}
        </div>
      </div>
    </div>
  );
}
