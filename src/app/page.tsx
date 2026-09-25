"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Bell, Settings, LogOut, CheckCircle2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, Flame, Check, Plus, Minus
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts';
import {
  getHabitsWithStreaks,
  getLogsForDate,
  toggleHabitLog,
  updateQuantifiableLog,
  getDashboardStats,
  getProgressData,
  getCalendarData,
  getUnreadNotifications,
  getGlobalStreakStats,
  createHabit,
} from '@/lib/services';
import type { HabitWithStreak, HabitLog, DashboardStats, ProgressDataPoint, CalendarDay, Notification, CreateHabitDTO } from '@/lib/types';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Dashboard() {
  // State
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ progress_percent: 0, active_habits: 0, completed_today: 0, left_today: 0 });
  const [progressData, setProgressData] = useState<ProgressDataPoint[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [streakStats, setStreakStats] = useState({ current_streak: 0, longest_streak: 0, total_completed: 0 });

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [positiveExpanded, setPositiveExpanded] = useState(true);
  const [negativeExpanded, setNegativeExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [periodTab, setPeriodTab] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Weekly');
  const [showNewHabitModal, setShowNewHabitModal] = useState(false);
  const [newHabitCategory, setNewHabitCategory] = useState<'positive' | 'negative'>('positive');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch functions
  const fetchAll = useCallback(async () => {
    try {
      const [h, l, s, p, c, n, ss] = await Promise.all([
        getHabitsWithStreaks(),
        getLogsForDate(selectedDate),
        getDashboardStats(selectedDate),
        getProgressData(periodTab === 'Weekly' ? 7 : periodTab === 'Monthly' ? 30 : 365),
        getCalendarData(calendarYear, calendarMonth),
        getUnreadNotifications(),
        getGlobalStreakStats(),
      ]);
      setHabits(h);
      setLogs(l);
      setStats(s);
      setProgressData(p);
      setCalendarData(c);
      setNotifications(n);
      setStreakStats(ss);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, calendarYear, calendarMonth, periodTab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Handlers
  const handleToggle = async (habitId: string) => {
    const log = logs.find(l => l.habit_id === habitId);
    const currentState = log?.completed || false;
    await toggleHabitLog(habitId, selectedDate, currentState);

    if (!currentState) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1500);
    }

    fetchAll();
  };

  const handleQuantifiableChange = async (habitId: string, delta: number, targetValue: number) => {
    const log = logs.find(l => l.habit_id === habitId);
    const currentValue = log?.value || 0;
    const newValue = Math.max(0, currentValue + delta);
    await updateQuantifiableLog(habitId, selectedDate, newValue, targetValue);

    if (newValue >= targetValue && currentValue < targetValue) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1500);
    }

    fetchAll();
  };

  const handleCreateHabit = async (dto: CreateHabitDTO) => {
    await createHabit(dto);
    setShowNewHabitModal(false);
    fetchAll();
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 1) { setCalendarMonth(12); setCalendarYear(y => y - 1); }
    else { setCalendarMonth(m => m - 1); }
  };
  const handleNextMonth = () => {
    if (calendarMonth === 12) { setCalendarMonth(1); setCalendarYear(y => y + 1); }
    else { setCalendarMonth(m => m + 1); }
  };

  // Filter habits
  const positiveHabits = habits.filter(h => h.category === 'positive' && h.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const negativeHabits = habits.filter(h => h.category === 'negative' && h.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Calendar helpers
  const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
  const todayStr = getTodayStr();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading your habits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* Confetti overlay */}
      {confetti && <ConfettiOverlay />}

      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col py-8 flex-shrink-0 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-12 px-8">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
            <CheckCircle2 size={18} />
          </div>
          <span className="text-xl font-bold text-slate-800">Habits</span>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-4">
          <NavItem active icon={<CheckCircle2 size={18} />} label="Habits" />
          <NavItem icon={<TrendingUp size={18} />} label="Goals" />
          <NavItem icon={<TrendingDown size={18} />} label="Analytics" />
          <NavItem icon={<ClockIcon />} label="History" />
          <NavItem icon={<LightbulbIcon />} label="Tips" />
          <NavItem icon={<Bell size={18} />} label="Notifications" badge={notifications.length > 0 ? String(notifications.length) : undefined} />
        </nav>

        <div className="px-4 mt-auto space-y-1">
          <NavItem icon={<Settings size={18} />} label="Settings" />
          <NavItem icon={<LogOut size={18} />} label="Logout" />
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 px-10 py-8 overflow-y-auto">

        {/* Topbar */}
        <header className="flex justify-between items-center mb-8">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border-none py-3 pl-12 pr-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
          <div className="w-10 h-10 rounded-full bg-yellow-100 overflow-hidden ml-4 border-2 border-white shadow-sm flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=fef08a" alt="User Avatar" />
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Today's Progress" value={`${stats.progress_percent}%`}
            icon={<div className="w-6 h-6 rounded-full border-[3px] border-indigo-200 border-l-indigo-600 rotate-45 mr-2"></div>}
            active
          />
          <StatCard title="Active Habits" value={String(stats.active_habits)}
            icon={<span className="text-indigo-400 mr-2 text-xl">⚡</span>}
          />
          <StatCard title="Completed" value={String(stats.completed_today)}
            icon={<CheckCircle2 className="text-indigo-400 mr-2" size={20} />}
          />
          <StatCard title="Left Today" value={String(stats.left_today)}
            icon={<span className="text-indigo-400 mr-2">⏳</span>}
          />
        </div>

        {/* Two Columns Layout */}
        <div className="flex gap-8">

          {/* Left Column (Habits List) */}
          <div className="flex-1 space-y-8">

            {/* Positive Habits */}
            <section>
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setPositiveExpanded(!positiveExpanded)}>
                <h2 className="text-xl font-bold text-slate-800">Positive Habits</h2>
                {positiveExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {positiveExpanded && (
                <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-2 space-y-1">
                  {positiveHabits.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No positive habits yet</p>}
                  {positiveHabits.map(habit => (
                    <HabitItem
                      key={habit.id}
                      habit={habit}
                      log={logs.find(l => l.habit_id === habit.id) || null}
                      onToggle={() => handleToggle(habit.id)}
                      onQuantChange={(delta) => handleQuantifiableChange(habit.id, delta, habit.target_value || 1)}
                      theme="emerald"
                    />
                  ))}
                  <div className="flex justify-end p-2 pr-4">
                    <button
                      onClick={() => { setNewHabitCategory('positive'); setShowNewHabitModal(true); }}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium py-2 px-6 rounded-lg shadow-sm transition-colors flex items-center"
                    >
                      <Plus size={16} className="mr-1" /> Add new
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Negative Habits */}
            <section>
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setNegativeExpanded(!negativeExpanded)}>
                <h2 className="text-xl font-bold text-slate-800">Negative Habits</h2>
                {negativeExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {negativeExpanded && (
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-2 space-y-1">
                  {negativeHabits.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No negative habits yet</p>}
                  {negativeHabits.map(habit => (
                    <HabitItem
                      key={habit.id}
                      habit={habit}
                      log={logs.find(l => l.habit_id === habit.id) || null}
                      onToggle={() => handleToggle(habit.id)}
                      onQuantChange={(delta) => handleQuantifiableChange(habit.id, delta, habit.target_value || 1)}
                      theme="purple"
                    />
                  ))}
                  <div className="flex justify-end p-2 pr-4">
                    <button
                      onClick={() => { setNewHabitCategory('negative'); setShowNewHabitModal(true); }}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium py-2 px-6 rounded-lg shadow-sm transition-colors flex items-center"
                    >
                      <Plus size={16} className="mr-1" /> Add new
                    </button>
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* Right Column (Widgets) */}
          <div className="w-[400px] flex-shrink-0 space-y-8">

            {/* Calendar */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <ChevronLeft size={16} className="text-slate-400 cursor-pointer hover:text-slate-700 transition-colors" onClick={handlePrevMonth} />
                <h3 className="font-bold text-slate-800">{MONTHS[calendarMonth - 1]} {calendarYear}</h3>
                <ChevronRight size={16} className="text-slate-400 cursor-pointer hover:text-slate-700 transition-colors" onClick={handleNextMonth} />
              </div>

              <div className="grid grid-cols-7 gap-y-3 text-center text-sm">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                  <div key={d} className="text-slate-400 text-xs font-medium mb-2">{d}</div>
                ))}

                {/* Empty offset days */}
                {Array.from({ length: firstDayOfMonth }, (_, i) => <div key={`empty-${i}`}></div>)}

                {/* Days */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const calDay = calendarData.find(c => c.date === dateStr);
                  const hasCompletions = calDay?.has_completions || false;

                  return (
                    <div
                      key={day}
                      className="flex flex-col items-center justify-center relative h-8 cursor-pointer"
                      onClick={() => setSelectedDate(dateStr)}
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-md transition-all text-sm
                        ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-md' : isToday ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                      `}>
                        {day}
                      </span>
                      {hasCompletions && !isSelected && (
                        <div className="w-4 h-[2px] bg-emerald-400 absolute bottom-[-2px] rounded-full"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Habit Progress Over Time */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
              <h3 className="font-bold text-slate-800 text-center mb-6">Habit Progress Over Time</h3>

              <div className="bg-slate-50/80 rounded-xl p-4 flex justify-between mb-6 text-center">
                <div>
                  <div className="text-indigo-600 font-bold flex items-center justify-center gap-1 text-sm"><Flame size={14} /> {streakStats.current_streak} days</div>
                  <div className="text-xs text-slate-500 mt-1">Current streak</div>
                </div>
                <div>
                  <div className="text-slate-700 font-bold flex items-center justify-center gap-1 text-sm"><Check size={14} /> {streakStats.longest_streak} days</div>
                  <div className="text-xs text-slate-500 mt-1">Longest streak ever</div>
                </div>
                <div>
                  <div className="text-slate-700 font-bold flex items-center justify-center gap-1 text-sm"><CheckCircle2 size={14} /> {streakStats.total_completed}</div>
                  <div className="text-xs text-slate-500 mt-1">Completed in total</div>
                </div>
              </div>

              <div className="flex gap-2 bg-slate-100/80 p-1 rounded-lg mb-6 text-sm">
                <button className="flex-1 bg-white shadow-sm rounded-md py-1.5 font-medium text-slate-800 text-xs">All Progress ▾</button>
                <div className="flex flex-1 rounded-md overflow-hidden">
                  {(['Weekly', 'Monthly', 'Yearly'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setPeriodTab(tab)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${periodTab === tab ? 'bg-indigo-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-40 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day_label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      formatter={(value: any) => [`${value}%`, 'Completion Rate']}
                    />
                    <Line type="monotone" dataKey="completion_rate" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* New Habit Modal */}
      {showNewHabitModal && (
        <NewHabitModal
          category={newHabitCategory}
          onClose={() => setShowNewHabitModal(false)}
          onCreate={handleCreateHabit}
        />
      )}
    </div>
  );
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

function NavItem({ icon, label, active = false, badge }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-indigo-700 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
      <div className="flex items-center gap-3 font-medium text-sm">{icon}<span>{label}</span></div>
      {badge && <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{badge}</span>}
    </div>
  );
}

function StatCard({ title, value, icon, active = false }: { title: string; value: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <div className={`rounded-xl p-6 flex flex-col justify-center items-center shadow-sm border border-slate-100 transition-all ${active ? 'bg-slate-200/50 scale-[1.02]' : 'bg-white'}`}>
      <div className="flex items-center justify-center text-3xl font-bold text-slate-800 mb-2">{icon}{value}</div>
      <div className="text-slate-500 text-sm font-medium">{title}</div>
    </div>
  );
}

function HabitItem({ habit, log, onToggle, onQuantChange, theme = 'emerald' }: {
  habit: HabitWithStreak;
  log: HabitLog | null;
  onToggle: () => void;
  onQuantChange: (delta: number) => void;
  theme?: 'emerald' | 'purple';
}) {
  const completed = log?.completed || false;
  const isQuantifiable = habit.type === 'quantifiable';
  const currentValue = log?.value || 0;
  const targetValue = habit.target_value || 1;
  const streak = habit.streaks?.current_streak || 0;

  const isEmerald = theme === 'emerald';
  const iconBg = isEmerald ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600';
  const iconBorder = isEmerald ? 'border-emerald-100' : 'border-purple-100';

  const frequencyLabel = habit.frequency_type === 'daily'
    ? 'Daily'
    : habit.frequency_type === 'weekly_count'
      ? `${habit.frequency_value}x per week`
      : habit.frequency_days?.join(', ');

  const subtitleParts = [];
  if (isQuantifiable) {
    subtitleParts.push(`📅 ${frequencyLabel} ${currentValue}/${targetValue}`);
  } else {
    subtitleParts.push(`📅 ${frequencyLabel}`);
  }
  subtitleParts.push(`🔥 ${streak}-day streak`);

  return (
    <div className="flex items-center justify-between p-3 py-4 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors rounded-xl">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${iconBg} border ${iconBorder}`}>{habit.icon}</div>
        <div>
          <h4 className="font-semibold text-slate-800">{habit.name}</h4>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-medium">{subtitleParts.join('  ')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 pr-2">
        {isQuantifiable && (
          <div className="flex items-center gap-1 mr-2">
            <button onClick={() => onQuantChange(-1)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><Minus size={12} /></button>
            <span className="text-xs font-bold text-slate-600 w-8 text-center">{currentValue}</span>
            <button onClick={() => onQuantChange(1)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><Plus size={12} /></button>
          </div>
        )}
        <button onClick={onToggle} className="focus:outline-none">
          {completed ? (
            <div className="w-6 h-6 rounded-md bg-emerald-400 text-white flex items-center justify-center shadow-sm transition-transform hover:scale-110"><Check size={14} strokeWidth={3} /></div>
          ) : (
            <div className="w-6 h-6 rounded-md border-2 border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer bg-white"></div>
          )}
        </button>
      </div>
    </div>
  );
}

function NewHabitModal({ category, onClose, onCreate }: {
  category: 'positive' | 'negative';
  onClose: () => void;
  onCreate: (dto: CreateHabitDTO) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(category === 'positive' ? '✅' : '🚫');
  const [type, setType] = useState<'binary' | 'quantifiable'>('binary');
  const [targetValue, setTargetValue] = useState(1);
  const [targetUnit, setTargetUnit] = useState('');
  const [freqType, setFreqType] = useState<'daily' | 'weekly_count' | 'specific_days'>('daily');
  const [freqValue, setFreqValue] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onCreate({
      name: name.trim(),
      icon,
      category,
      type,
      target_value: type === 'quantifiable' ? targetValue : undefined,
      target_unit: type === 'quantifiable' ? targetUnit : undefined,
      frequency_type: freqType,
      frequency_value: freqType === 'weekly_count' ? freqValue : undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-800 mb-6">
          New {category === 'positive' ? 'Positive' : 'Negative'} Habit
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Read 30 minutes" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Icon</label>
            <input type="text" value={icon} onChange={e => setIcon(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-4 py-2.5 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType('binary')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'binary' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Binary (Yes/No)</button>
              <button type="button" onClick={() => setType('quantifiable')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'quantifiable' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Quantifiable</button>
            </div>
          </div>

          {type === 'quantifiable' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-1">Target</label>
                <input type="number" value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} min={1} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                <input type="text" value={targetUnit} onChange={e => setTargetUnit(e.target.value)} placeholder="glasses, pages..." className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'weekly_count'] as const).map(ft => (
                <button key={ft} type="button" onClick={() => setFreqType(ft)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${freqType === ft ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {ft === 'daily' ? 'Daily' : 'X per week'}
                </button>
              ))}
            </div>
          </div>

          {freqType === 'weekly_count' && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Times per week</label>
              <input type="number" min={1} max={7} value={freqValue} onChange={e => setFreqValue(Number(e.target.value))} className="w-20 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting || !name.trim()} className="flex-1 py-2.5 rounded-lg bg-indigo-700 text-white font-medium text-sm hover:bg-indigo-800 transition-colors disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  isCircle: boolean;
  rotation: number;
}

function ConfettiOverlay() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const newPieces = Array.from({ length: 50 }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.5;
      const duration = 1 + Math.random() * 1;
      const size = 6 + Math.random() * 8;
      const colors = ['#6366f1', '#2dd4bf', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        id: i,
        left,
        delay,
        duration,
        size,
        color,
        isCircle: Math.random() > 0.5,
        rotation: Math.random() * 360,
      };
    });
    setPieces(newPieces);
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animation: `confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}
