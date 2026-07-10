export type UserId = string;
export type TaskOwner = UserId | "both";
export type TaskStatus = "pending" | "done" | "missed";
export type Priority = "high" | "medium" | "low";
export type ThemeMode = "light" | "dark";

export interface UserProfile {
  id: UserId;
  name: string;
  colorLabel: string;
  invited?: boolean;
  createdAt?: string;
}

export interface TemplateTask {
  id: string;
  title: string;
  description: string;
  user: TaskOwner;
  category: string;
  startTime: string;
  endTime: string;
  note?: string;
  priority: Priority;
  recurring: boolean;
  reminder?: boolean;
}

export interface Task extends TemplateTask {
  date: string;
  status: TaskStatus;
  note: string;
  noteAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
  manual?: boolean;
}

export interface DayLog {
  date: string;
  generalNote: string;
  fabianNote: string;
  mauriNote: string;
  bothNote: string;
  userNotes: Record<string, string>;
  learning: string;
  problem: string;
  tomorrowAdjustment: string;
  dailyPriority: string;
  memoryUpdatedAt?: string;
  closed: boolean;
  closedAt?: string;
}

export interface AppSettings {
  users: Record<UserId, UserProfile>;
  includeSundays: boolean;
  theme: ThemeMode;
  baseTemplate: TemplateTask[];
}

export interface AppData {
  version: number;
  tasksByDate: Record<string, Task[]>;
  dayLogs: Record<string, DayLog>;
  settings: AppSettings;
}

export interface ProgressStats {
  total: number;
  done: number;
  missed: number;
  pending: number;
  completionRate: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  completionRate: number;
  fabianCompletionRate: number;
  mauriCompletionRate: number;
  completedTasks: number;
  missedTasks: number;
  trainingDays: number;
  barbutoDays: number;
  synaptixDays: number;
  dropshippingDays: number;
  streak: number;
  topCompletedCategories: Array<{ category: string; count: number }>;
  topMissedCategories: Array<{ category: string; count: number }>;
}
