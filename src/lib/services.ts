import { supabase } from './supabase';
import type {
  Habit, HabitWithStreak, HabitLog, Notification,
  CreateHabitDTO, UpdateHabitDTO, DashboardStats, ProgressDataPoint, CalendarDay
} from './types';

// ===========================================
// HABITS
// ===========================================

/** Obtener todos los hábitos activos con su streak, agrupados por categoría */
export async function getHabitsWithStreaks(): Promise<HabitWithStreak[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(`
      *,
      streaks (*)
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data as HabitWithStreak[]) || [];
}

/** Crear un nuevo hábito */
export async function createHabit(dto: CreateHabitDTO): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      name: dto.name,
      icon: dto.icon || '📌',
      category: dto.category,
      type: dto.type,
      target_value: dto.target_value || null,
      target_unit: dto.target_unit || null,
      frequency_type: dto.frequency_type || 'daily',
      frequency_value: dto.frequency_value || null,
      frequency_days: dto.frequency_days || [],
      rest_days: dto.rest_days || [],
      wildcard_days_total: dto.wildcard_days_total || 0,
    })
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await supabase.from('activity_log').insert({
    habit_id: data.id,
    event_type: 'habit_created',
    description: `Hábito "${dto.name}" creado`,
    metadata: { category: dto.category },
  });

  return data;
}

/** Actualizar un hábito existente */
export async function updateHabit(id: string, dto: UpdateHabitDTO): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .update(dto)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Eliminar (desactivar) un hábito */
export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;

  await supabase.from('activity_log').insert({
    habit_id: id,
    event_type: 'habit_deleted',
    description: 'Hábito eliminado',
  });
}

// ===========================================
// HABIT LOGS (Registro Diario)
// ===========================================

/** Obtener los logs de un día específico */
export async function getLogsForDate(date: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('log_date', date);

  if (error) throw error;
  return data || [];
}

/** Marcar/desmarcar un hábito binario para una fecha */
export async function toggleHabitLog(habitId: string, date: string, currentState: boolean): Promise<HabitLog> {
  const newCompleted = !currentState;

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      {
        habit_id: habitId,
        log_date: date,
        completed: newCompleted,
      },
      { onConflict: 'habit_id,log_date' }
    )
    .select()
    .single();

  if (error) throw error;

  // Actualizar streak
  if (newCompleted) {
    await incrementStreak(habitId, date);
  } else {
    await recalculateStreak(habitId);
  }

  return data;
}

/** Actualizar progreso de un hábito cuantificable */
export async function updateQuantifiableLog(
  habitId: string,
  date: string,
  value: number,
  targetValue: number
): Promise<HabitLog> {
  const completed = value >= targetValue;

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      {
        habit_id: habitId,
        log_date: date,
        completed,
        value,
      },
      { onConflict: 'habit_id,log_date' }
    )
    .select()
    .single();

  if (error) throw error;

  if (completed) {
    await incrementStreak(habitId, date);
  }

  return data;
}

// ===========================================
// STREAKS
// ===========================================

/** Incrementar la racha de un hábito */
async function incrementStreak(habitId: string, date: string): Promise<void> {
  const { data: streak } = await supabase
    .from('streaks')
    .select('*')
    .eq('habit_id', habitId)
    .single();

  if (!streak) return;

  const lastDate = streak.last_completed_date;
  const currentDate = new Date(date);
  const lastCompletedDate = lastDate ? new Date(lastDate) : null;

  let newStreak = streak.current_streak;
  let newStreakStart = streak.streak_start_date;

  if (!lastCompletedDate) {
    // First completion ever
    newStreak = 1;
    newStreakStart = date;
  } else {
    const diffDays = Math.floor(
      (currentDate.getTime() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      // Consecutive day
      newStreak = streak.current_streak + 1;
    } else if (diffDays === 0) {
      // Same day, no change
      newStreak = streak.current_streak;
    } else {
      // Streak broken, restart
      newStreak = 1;
      newStreakStart = date;
    }
  }

  const longestStreak = Math.max(newStreak, streak.longest_streak);

  await supabase
    .from('streaks')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      total_completed: streak.total_completed + 1,
      last_completed_date: date,
      streak_start_date: newStreakStart,
      updated_at: new Date().toISOString(),
    })
    .eq('habit_id', habitId);

  // Check milestones
  const milestones = [7, 14, 21, 30, 60, 90, 180, 365];
  if (milestones.includes(newStreak)) {
    await supabase.from('notifications').insert({
      habit_id: habitId,
      type: 'milestone',
      title: `🔥 ¡Racha de ${newStreak} días!`,
      message: `¡Increíble! Has mantenido tu racha durante ${newStreak} días consecutivos.`,
    });

    await supabase.from('activity_log').insert({
      habit_id: habitId,
      event_type: 'milestone',
      description: `Racha de ${newStreak} días alcanzada`,
      metadata: { streak: newStreak },
    });
  }
}

/** Recalcular la racha cuando se desmarca un hábito */
async function recalculateStreak(habitId: string): Promise<void> {
  // Get all completed logs sorted desc
  const { data: logs } = await supabase
    .from('habit_logs')
    .select('log_date')
    .eq('habit_id', habitId)
    .eq('completed', true)
    .order('log_date', { ascending: false });

  if (!logs || logs.length === 0) {
    await supabase
      .from('streaks')
      .update({
        current_streak: 0,
        total_completed: 0,
        last_completed_date: null,
        streak_start_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('habit_id', habitId);
    return;
  }

  // Calculate current streak from most recent
  let streak = 1;
  const dates = logs.map(l => new Date(l.log_date));

  for (let i = 0; i < dates.length - 1; i++) {
    const diff = Math.floor(
      (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  await supabase
    .from('streaks')
    .update({
      current_streak: streak,
      total_completed: logs.length,
      last_completed_date: logs[0].log_date,
      streak_start_date: dates[streak - 1].toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('habit_id', habitId);
}

// ===========================================
// DASHBOARD STATS
// ===========================================

/** Obtener métricas para las Stats Cards del día actual */
export async function getDashboardStats(date: string): Promise<DashboardStats> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id')
    .eq('is_active', true);

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('habit_id, completed')
    .eq('log_date', date);

  const totalActive = habits?.length || 0;
  const completedToday = logs?.filter(l => l.completed).length || 0;
  const leftToday = totalActive - completedToday;
  const progressPercent = totalActive > 0
    ? Math.round((completedToday / totalActive) * 100)
    : 0;

  return {
    progress_percent: progressPercent,
    active_habits: totalActive,
    completed_today: completedToday,
    left_today: leftToday,
  };
}

// ===========================================
// PROGRESS CHART DATA
// ===========================================

/** Obtener datos de progreso para la gráfica (últimos N días) */
export async function getProgressData(days: number = 7, habitId?: string): Promise<ProgressDataPoint[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  let query = supabase
    .from('habit_logs')
    .select('log_date, completed')
    .gte('log_date', startStr)
    .lte('log_date', endStr);

  if (habitId) {
    query = query.eq('habit_id', habitId);
  }

  const { data: logs } = await query;

  // Group by date
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const result: ProgressDataPoint[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    const dayLogs = logs?.filter(l => l.log_date === dateStr) || [];
    const total = dayLogs.length;
    const completed = dayLogs.filter(l => l.completed).length;

    result.push({
      date: dateStr,
      day_label: dayNames[d.getDay()],
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  return result;
}

// ===========================================
// CALENDAR DATA
// ===========================================

/** Obtener datos de completitud para el calendario de un mes */
export async function getCalendarData(year: number, month: number): Promise<CalendarDay[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0); // Last day of month
  const endStr = endDate.toISOString().split('T')[0];

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('log_date, completed')
    .gte('log_date', startDate)
    .lte('log_date', endStr)
    .eq('completed', true);

  // Group by date
  const dateMap = new Map<string, number>();
  logs?.forEach(log => {
    const count = dateMap.get(log.log_date) || 0;
    dateMap.set(log.log_date, count + 1);
  });

  const result: CalendarDay[] = [];
  const daysInMonth = endDate.getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = dateMap.get(dateStr) || 0;
    result.push({
      date: dateStr,
      has_completions: count > 0,
      completion_count: count,
    });
  }

  return result;
}

// ===========================================
// NOTIFICATIONS
// ===========================================

/** Obtener notificaciones no leídas */
export async function getUnreadNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/** Obtener todas las notificaciones */
export async function getAllNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

/** Marcar notificación como leída */
export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
}

/** Marcar todas las notificaciones como leídas */
export async function markAllNotificationsRead(): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}

// ===========================================
// GLOBAL STREAK STATS (para el widget Progress)
// ===========================================

/** Obtener stats general de rachas para el widget */
export async function getGlobalStreakStats(habitId?: string) {
  let query = supabase.from('streaks').select('*');

  if (habitId) {
    query = query.eq('habit_id', habitId);
  }

  const { data } = await query;

  if (!data || data.length === 0) {
    return { current_streak: 0, longest_streak: 0, total_completed: 0 };
  }

  const maxCurrentStreak = Math.max(...data.map(s => s.current_streak));
  const maxLongestStreak = Math.max(...data.map(s => s.longest_streak));
  const totalCompleted = data.reduce((sum, s) => sum + s.total_completed, 0);

  return {
    current_streak: maxCurrentStreak,
    longest_streak: maxLongestStreak,
    total_completed: totalCompleted,
  };
}
