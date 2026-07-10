import { DEFAULT_SETTINGS, STORAGE_KEY } from "./constants";
import { isSunday, todayISO } from "./dates";
import type { AppData, AppSettings, DayLog, Priority, Task, TaskOwner, TaskStatus, TemplateTask, UserProfile } from "./types";

export function createDayLog(date: string): DayLog {
  return {
    date,
    generalNote: "",
    fabianNote: "",
    mauriNote: "",
    bothNote: "",
    userNotes: {},
    learning: "",
    problem: "",
    tomorrowAdjustment: "",
    dailyPriority: "",
    closed: false
  };
}

export function createInitialData(): AppData {
  return {
    version: 1,
    tasksByDate: {},
    dayLogs: {},
    settings: cloneSettings(DEFAULT_SETTINGS)
  };
}

export function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    users: cloneUsers(settings.users),
    baseTemplate: settings.baseTemplate.map((task) => ({ ...task }))
  };
}

export function generateTasksForDate(date: string, settings: AppSettings): Task[] {
  if (isSunday(date) && !settings.includeSundays) {
    return [];
  }

  const timestamp = new Date().toISOString();
  return settings.baseTemplate.map((task) => templateToTask(task, date, timestamp));
}

export function templateToTask(task: TemplateTask, date: string, timestamp = new Date().toISOString()): Task {
  return {
    ...task,
    id: `${date}-${task.id}`,
    date,
    status: "pending",
    note: task.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function ensureDate(data: AppData, date: string): AppData {
  const next: AppData = {
    ...data,
    tasksByDate: { ...data.tasksByDate },
    dayLogs: { ...data.dayLogs },
    settings: cloneSettings(data.settings)
  };

  if (!next.tasksByDate[date]) {
    next.tasksByDate[date] = generateTasksForDate(date, next.settings);
  }

  if (!next.dayLogs[date]) {
    next.dayLogs[date] = createDayLog(date);
  }

  return next;
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return ensureDate(createInitialData(), todayISO());
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return ensureDate(createInitialData(), todayISO());
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalizeAppData(parsed);
  } catch {
    return ensureDate(createInitialData(), todayISO());
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function normalizeAppData(partial: Partial<AppData>): AppData {
  const base = createInitialData();
  const settings = {
    ...base.settings,
    ...(partial.settings ?? {}),
    users: {
      ...base.settings.users,
      ...cloneUsers(partial.settings?.users ?? {})
    },
    baseTemplate:
      partial.settings?.baseTemplate && partial.settings.baseTemplate.length > 0
        ? partial.settings.baseTemplate
        : base.settings.baseTemplate
  };

  const tasksByDate = Object.fromEntries(
    Object.entries(partial.tasksByDate ?? {}).map(([date, tasks]) => [
      date,
      Array.isArray(tasks)
        ? tasks.map((task, index) => normalizeTask(task as Partial<Task>, date, index))
        : []
    ])
  );

  const normalized: AppData = {
    version: 1,
    tasksByDate,
    dayLogs: partial.dayLogs ?? {},
    settings: cloneSettings(settings)
  };

  Object.keys(normalized.dayLogs).forEach((date) => {
    normalized.dayLogs[date] = { ...createDayLog(date), ...normalized.dayLogs[date] };
  });

  return ensureDate(normalized, todayISO());
}

function cloneUsers(users: Record<string, UserProfile>): Record<string, UserProfile> {
  return Object.fromEntries(
    Object.entries(users).map(([id, user]) => [
      id,
      {
        ...user,
        id: user.id ?? id
      }
    ])
  );
}

function normalizeTask(task: Partial<Task>, date: string, index: number): Task {
  const timestamp = new Date().toISOString();

  return {
    id: String(task.id ?? `${date}-imported-${index}`),
    date: task.date ?? date,
    title: task.title ?? "Tarea importada",
    description: task.description ?? "",
    user: normalizeOwner(task.user),
    category: task.category ?? "Reunión",
    startTime: task.startTime ?? "09:00",
    endTime: task.endTime ?? "09:30",
    status: normalizeStatus(task.status),
    note: task.note ?? "",
    noteAcceptedAt: task.noteAcceptedAt,
    priority: normalizePriority(task.priority),
    recurring: Boolean(task.recurring),
    createdAt: task.createdAt ?? timestamp,
    updatedAt: task.updatedAt ?? timestamp,
    manual: task.manual ?? true,
    reminder: task.reminder ?? false
  };
}

function normalizeOwner(owner: TaskOwner | undefined): TaskOwner {
  return owner && owner !== "all" ? owner : "both";
}

function normalizeStatus(status: TaskStatus | undefined): TaskStatus {
  return status === "done" || status === "missed" || status === "pending" ? status : "pending";
}

function normalizePriority(priority: Priority | undefined): Priority {
  return priority === "high" || priority === "medium" || priority === "low" ? priority : "medium";
}
