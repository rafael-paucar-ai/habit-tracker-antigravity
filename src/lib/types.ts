// ===========================================
// Tipos del modelo de datos del Habit Tracker
// ===========================================

export type HabitCategory = 'positive' | 'negative';
export type HabitType = 'binary' | 'quantifiable';
export type FrequencyType = 'daily' | 'weekly_count' | 'specific_days';
export type NotificationType = 'reminder' | 'milestone' | 'alert' | 'tip';
export type EventType = 'completed' | 'streak_broken' | 'milestone' | 'goal_reached' | 'habit_created' | 'habit_deleted';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: HabitCategory;
  type: HabitType;
  target_value: number | null;
  target_unit: string | null;
  frequency_type: FrequencyType;
  frequency_value: number | null;
  frequency_days: string[];
  rest_days: string[];
  wildcard_days_total: number;
  wildcard_days_used: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HabitWithStreak extends Habit {
  streaks: Streak | null;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  value: number | null;
  is_wildcard: boolean;
  created_at: string;
}

export interface Streak {
  id: string;
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  total_completed: number;
  last_completed_date: string | null;
  streak_start_date: string | null;
  updated_at: string;
}

export interface HabitReminder {
  id: string;
  habit_id: string;
  reminder_time: string;
  is_enabled: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  target_count: number | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalHabit {
  id: string;
  goal_id: string;
  habit_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  habit_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  habit_id: string | null;
  event_type: EventType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// DTO para crear un hábito
export interface CreateHabitDTO {
  name: string;
  icon?: string;
  category: HabitCategory;
  type: HabitType;
  target_value?: number;
  target_unit?: string;
  frequency_type?: FrequencyType;
  frequency_value?: number;
  frequency_days?: string[];
  rest_days?: string[];
  wildcard_days_total?: number;
}

// DTO para actualizar un hábito
export interface UpdateHabitDTO extends Partial<CreateHabitDTO> {
  is_active?: boolean;
  sort_order?: number;
}

// Stats dashboard
export interface DashboardStats {
  progress_percent: number;
  active_habits: number;
  completed_today: number;
  left_today: number;
}

// Datos para la gráfica de progreso
export interface ProgressDataPoint {
  date: string;
  day_label: string;
  completion_rate: number;
}

// Datos para el calendario
export interface CalendarDay {
  date: string;
  has_completions: boolean;
  completion_count: number;
}
