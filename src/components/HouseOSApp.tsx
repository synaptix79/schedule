"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Moon,
  Plus,
  Settings,
  StickyNote,
  Sun,
  Trash2,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CATEGORY_OPTIONS,
  FINANCIAL_CONTEXT,
  PERSONAL_PRIORITIES,
  PRODUCTIVITY_RULES,
  WEEKLY_GOALS
} from "@/lib/constants";
import {
  addDays,
  dayName,
  formatDisplayDate,
  getWeekDates,
  isSunday,
  isTaskLate,
  nextOperationalDate,
  timeToMinutes,
  todayISO
} from "@/lib/dates";
import { getOwnerProgress, getProgress, getWeeklySummary } from "@/lib/progress";
import { loadRemoteAppData, saveRemoteAppData } from "@/lib/supabase";
import {
  createDayLog,
  createInitialData,
  ensureDate,
  generateTasksForDate,
  loadAppData,
  saveAppData
} from "@/lib/storage";
import type {
  AppData,
  AppSettings,
  DayLog,
  Priority,
  Task,
  TaskOwner,
  TaskStatus,
  TemplateTask
} from "@/lib/types";

type ViewId = "calendar" | "week" | "notes" | "summary" | "settings";
type OwnerFilter = "all" | TaskOwner;

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "week", label: "Semana", icon: CalendarCheck },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "summary", label: "Resumen", icon: BarChart3 },
  { id: "settings", label: "Ajustes", icon: Settings }
];

const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: LucideIcon; tone: string; compact: string }
> = {
  pending: {
    label: "Pendiente",
    icon: Clock3,
    tone: "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]",
    compact: "bg-[var(--line)] text-[var(--foreground)]"
  },
  done: {
    label: "Completo",
    icon: Check,
    tone: "border-moss/45 bg-moss/10 text-moss dark:text-[#b9d1ad]",
    compact: "bg-moss text-white"
  },
  missed: {
    label: "No hecho",
    icon: X,
    tone: "border-clay/45 bg-clay/10 text-clay dark:text-[#e2a183]",
    compact: "bg-clay text-white"
  }
};

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-signal/20 text-signal ring-signal/30" },
  medium: { label: "Media", className: "bg-steel/15 text-steel dark:text-[#b9c6d2] ring-steel/20" },
  low: { label: "Baja", className: "bg-[var(--line)] text-[var(--muted)] ring-[var(--line)]" }
};

const OWNER_LABELS: Record<string, string> = {
  fabian: "Fabián",
  mauri: "Mauri",
  both: "Ambos"
};

const EMPTY_TASKS: Task[] = [];

export function HouseOSApp() {
  const initialDate = todayISO();
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("calendar");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [inviteMessage, setInviteMessage] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const [data, setData] = useState<AppData>(() =>
    ensureDate(createInitialData(), initialDate)
  );

  useEffect(() => {
    let active = true;

    async function hydrateData() {
      const localData = ensureDate(loadAppData(), initialDate);

      try {
        const remoteData = await loadRemoteAppData();
        if (!active) return;

        const loaded = ensureDate(remoteData ?? localData, initialDate);
        setData(loaded);
        if (!remoteData) {
          await saveRemoteAppData(loaded);
        }
      } catch (error) {
        console.error(error);
        if (active) setData(localData);
      } finally {
        if (active) {
          setSelectedDate(initialDate);
          setReady(true);
        }
      }
    }

    void hydrateData();

    return () => {
      active = false;
    };
  }, [initialDate]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.settings.theme === "dark");
    if (ready) {
      saveAppData(data);
      const timeout = window.setTimeout(() => {
        void saveRemoteAppData(data).catch(console.error);
      }, 450);

      return () => window.clearTimeout(timeout);
    }
  }, [data, ready]);

  const selectedTasks = data.tasksByDate[selectedDate] ?? EMPTY_TASKS;
  const selectedLog = data.dayLogs[selectedDate] ?? createDayLog(selectedDate);

  const filteredTasks = useMemo(() => {
    return selectedTasks
      .filter((task) => {
        if (ownerFilter === "all") {
          return true;
        }

        return taskMatchesOwnerFilter(task.user, ownerFilter);
      })
      .filter((task) => categoryFilter === "all" || task.category === categoryFilter)
      .sort(sortByTime);
  }, [categoryFilter, ownerFilter, selectedTasks]);

  const completionScopeTasks =
    ownerFilter === "all" && categoryFilter === "all" ? selectedTasks : filteredTasks;
  const dayComplete =
    completionScopeTasks.length > 0 &&
    completionScopeTasks.every((task) => task.status === "done");

  function selectDate(date: string) {
    setSelectedDate(date);
    setData((current) => ensureDate(current, date));
  }

  function goToPreviousDay() {
    selectDate(addDays(selectedDate, -1));
  }

  function goToNextDay() {
    selectDate(addDays(selectedDate, 1));
  }

  function ensureDates(dates: string[]) {
    setData((current) => dates.reduce((next, date) => ensureDate(next, date), current));
  }

  function navigate(view: ViewId) {
    if (view === "week" || view === "summary") {
      ensureDates(getWeekDates(selectedDate));
    }

    setActiveView(view);
  }

  function updateTask(date: string, taskId: string, patch: Partial<Task>) {
    setData((current) => {
      const tasks = current.tasksByDate[date] ?? [];
      return {
        ...current,
        tasksByDate: {
          ...current.tasksByDate,
          [date]: tasks
            .map((task) =>
              task.id === taskId
                ? { ...task, ...patch, updatedAt: new Date().toISOString() }
                : task
            )
            .sort(sortByTime)
        }
      };
    });
  }

  function upsertTask(task: Task) {
    setData((current) => {
      const existingTasks = current.tasksByDate[task.date] ?? [];
      const exists = existingTasks.some((item) => item.id === task.id);
      const nextTask = {
        ...task,
        updatedAt: new Date().toISOString(),
        createdAt: task.createdAt || new Date().toISOString()
      };

      return {
        ...current,
        tasksByDate: {
          ...current.tasksByDate,
          [task.date]: exists
            ? existingTasks.map((item) => (item.id === task.id ? nextTask : item)).sort(sortByTime)
            : [...existingTasks, nextTask].sort(sortByTime)
        }
      };
    });
    setEditingTask(null);
  }

  function deleteTask(task: Task) {
    setData((current) => ({
      ...current,
      tasksByDate: {
        ...current.tasksByDate,
        [task.date]: (current.tasksByDate[task.date] ?? []).filter((item) => item.id !== task.id)
      }
    }));
    setEditingTask(null);
  }

  function updateDayLog(date: string, patch: Partial<DayLog>) {
    setData((current) => ({
      ...current,
      dayLogs: {
        ...current.dayLogs,
        [date]: {
          ...(current.dayLogs[date] ?? createDayLog(date)),
          ...patch
        }
      }
    }));
  }

  function closeDay(date: string) {
    updateDayLog(date, {
      closed: true,
      closedAt: new Date().toISOString()
    });
  }

  function acceptDayNotes(date: string) {
    updateDayLog(date, {
      memoryUpdatedAt: new Date().toISOString()
    });
  }

  function acceptTaskNote(task: Task) {
    updateTask(task.date, task.id, {
      noteAcceptedAt: new Date().toISOString()
    });
  }

  function prepareTomorrow(fromDate: string) {
    const nextDate = nextOperationalDate(fromDate, data.settings.includeSundays);
    setData((current) => ensureDate(current, nextDate));
    setSelectedDate(nextDate);
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch
      }
    }));
  }

  function toggleSundays(includeSundays: boolean) {
    setData((current) => {
      const settings = { ...current.settings, includeSundays };
      const next: AppData = {
        ...current,
        settings,
        tasksByDate: { ...current.tasksByDate }
      };

      if (includeSundays && isSunday(selectedDate) && (next.tasksByDate[selectedDate]?.length ?? 0) === 0) {
        next.tasksByDate[selectedDate] = generateTasksForDate(selectedDate, settings);
      }

      return next;
    });
  }

  function updateTemplateTask(taskId: string, patch: Partial<TemplateTask>) {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        baseTemplate: current.settings.baseTemplate.map((task) =>
          task.id === taskId ? { ...task, ...patch } : task
        )
      }
    }));
  }

  function addTemplateTask(owner: OwnerFilter) {
    const timestamp = Date.now();
    const user: TaskOwner = owner === "all" ? "both" : owner;

    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        baseTemplate: [
          ...current.settings.baseTemplate,
          {
            id: `custom-template-${timestamp}`,
            title: "Nueva tarea base",
            description: "",
            user,
            category: "Reunión",
            startTime: "09:00",
            endTime: "09:30",
            priority: "medium",
            recurring: true
          }
        ]
      }
    }));
  }

  function addUser(name: string) {
    const cleanName = name.trim();
    if (!cleanName) {
      return;
    }

    setData((current) => {
      const id = createUserId(cleanName, current.settings.users);
      return {
        ...current,
        settings: {
          ...current.settings,
          users: {
            ...current.settings.users,
            [id]: {
              id,
              name: cleanName,
              colorLabel: nextUserColor(Object.keys(current.settings.users).length),
              createdAt: new Date().toISOString()
            }
          }
        }
      };
    });
  }

  function updateUser(userId: string, patch: Partial<{ name: string; colorLabel: string }>) {
    setData((current) => {
      const user = current.settings.users[userId];
      if (!user) {
        return current;
      }

      return {
        ...current,
        settings: {
          ...current.settings,
          users: {
            ...current.settings.users,
            [userId]: {
              ...user,
              ...patch
            }
          }
        }
      };
    });
  }

  function deleteUser(userId: string) {
    setData((current) => {
      const users = { ...current.settings.users };
      if (!users[userId] || Object.keys(users).length <= 1) {
        return current;
      }

      delete users[userId];

      return {
        ...current,
        tasksByDate: Object.fromEntries(
          Object.entries(current.tasksByDate).map(([date, tasks]) => [
            date,
            tasks.map((task) => (task.user === userId ? { ...task, user: "both" } : task))
          ])
        ),
        settings: {
          ...current.settings,
          users,
          baseTemplate: current.settings.baseTemplate.map((task) =>
            task.user === userId ? { ...task, user: "both" } : task
          )
        }
      };
    });
  }

  function inviteUser(userId: string) {
    const user = data.settings.users[userId];
    if (!user) {
      return;
    }

    const message = `Invitación House OS: ${user.name}. Abrir la app local y agregar este usuario: ${user.id}`;
    setInviteMessage(message);
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        users: {
          ...current.settings.users,
          [userId]: {
            ...current.settings.users[userId],
            invited: true
          }
        }
      }
    }));

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(message);
    }
  }

  function openNewTask(date: string) {
    setEditingTask(createManualTask(date));
  }

  const view = (() => {
    if (!ready) {
      return <EmptyState title="Cargando House OS" body="Preparando la rutina del día." />;
    }

    if (activeView === "week") {
      return (
        <WeekView
          data={data}
          selectedDate={selectedDate}
          onPreviousDay={goToPreviousDay}
          onNextDay={goToNextDay}
          onPrepareTomorrow={() => prepareTomorrow(selectedDate)}
          onSelectDate={(date) => {
            selectDate(date);
            setActiveView("calendar");
          }}
        />
      );
    }

    if (activeView === "calendar") {
      return (
        <CalendarView
          date={selectedDate}
          tasks={filteredTasks}
          dayLog={selectedLog}
          settings={data.settings}
          ownerFilter={ownerFilter}
          categoryFilter={categoryFilter}
          onSelectDate={selectDate}
          onPreviousDay={goToPreviousDay}
          onNextDay={goToNextDay}
          onPrepareTomorrow={() => prepareTomorrow(selectedDate)}
          onOwnerFilterChange={setOwnerFilter}
          onCategoryFilterChange={setCategoryFilter}
          onDayLogChange={(patch) => updateDayLog(selectedDate, patch)}
          onAcceptNotes={() => acceptDayNotes(selectedDate)}
          onNewTask={() => openNewTask(selectedDate)}
          onStatusChange={(task, status) => updateTask(task.date, task.id, { status })}
          onNoteChange={(task, note) => updateTask(task.date, task.id, { note })}
          onAcceptTaskNote={acceptTaskNote}
          onEdit={setEditingTask}
        />
      );
    }

    if (activeView === "notes") {
      return (
        <NotesPanel
          date={selectedDate}
          tasks={[...selectedTasks].sort(sortByTime)}
          dayLog={selectedLog}
          settings={data.settings}
          onSelectDate={selectDate}
          onDayLogChange={(patch) => updateDayLog(selectedDate, patch)}
          onAcceptNotes={() => acceptDayNotes(selectedDate)}
          onTaskNoteChange={(task, note) => updateTask(task.date, task.id, { note })}
          onAcceptTaskNote={acceptTaskNote}
        />
      );
    }

    if (activeView === "summary") {
      return <SummaryCards data={data} selectedDate={selectedDate} />;
    }

    return (
      <SettingsPanel
        data={data}
        inviteMessage={inviteMessage}
        onUpdateSettings={updateSettings}
        onToggleSundays={toggleSundays}
        onUpdateTemplateTask={updateTemplateTask}
        onAddTemplateTask={addTemplateTask}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onDeleteUser={(userId) =>
          setConfirmAction({
            title: "Eliminar usuario",
            message: "Las tareas de ese usuario pasarán a Ambos para no perder historial.",
            action: () => deleteUser(userId)
          })
        }
        onInviteUser={inviteUser}
      />
    );
  })();

  return (
    <main
      className={[
        "min-h-screen bg-[var(--background)] text-[var(--foreground)]",
        dayComplete ? "day-complete" : ""
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-3 pb-40 pt-3 sm:px-5 lg:pb-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-soft lg:flex">
          <div>
            <div className="px-2 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                House OS
              </p>
              <h1 className="mt-1 text-xl font-semibold">Fabián & Mauri</h1>
            </div>
            <div className="px-2">
              <UserNavFilter
                value={ownerFilter}
                onChange={setOwnerFilter}
                settings={data.settings}
              />
            </div>
            <nav className="mt-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeView === item.id}
                  onClick={() => navigate(item.id)}
                  desktop
                />
              ))}
            </nav>
          </div>
          <p className="rounded-lg border border-signal/30 bg-signal/10 p-3 text-sm leading-5 text-[var(--foreground)]">
            Caja primero. Lo demás ordena el camino.
          </p>
        </aside>

        <section className="min-w-0 flex-1">
          <AppHeader
            date={selectedDate}
            tasks={selectedTasks}
            settings={data.settings}
            dayLog={selectedLog}
            onPreviousDay={goToPreviousDay}
            onCloseDay={() => closeDay(selectedDate)}
            onPrepareTomorrow={() => prepareTomorrow(selectedDate)}
            onToggleTheme={() =>
              updateSettings({ theme: data.settings.theme === "dark" ? "light" : "dark" })
            }
          />
          {view}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)]/96 px-2 py-2 shadow-soft backdrop-blur safe-bottom lg:hidden">
        <div className="mx-auto max-w-xl">
          <UserNavFilter
            value={ownerFilter}
            onChange={setOwnerFilter}
            settings={data.settings}
            compact
          />
        </div>
        <div className="mx-auto mt-2 grid max-w-xl grid-cols-5 gap-1">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </div>
      </nav>

      {editingTask && (
        <TaskEditorModal
          task={editingTask}
          settings={data.settings}
          onSave={upsertTask}
          onCancel={() => setEditingTask(null)}
          onDelete={deleteTask}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            confirmAction.action();
            setConfirmAction(null);
          }}
        />
      )}
    </main>
  );
}

function AppHeader({
  date,
  tasks,
  settings,
  dayLog,
  onPreviousDay,
  onCloseDay,
  onPrepareTomorrow,
  onToggleTheme
}: {
  date: string;
  tasks: Task[];
  settings: AppSettings;
  dayLog: DayLog;
  onPreviousDay: () => void;
  onCloseDay: () => void;
  onPrepareTomorrow: () => void;
  onToggleTheme: () => void;
}) {
  const progress = getProgress(tasks);
  const users = getUserList(settings);
  const closedLabel = dayLog.closed
    ? `Cerrado ${dayLog.closedAt ? new Date(dayLog.closedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : ""}`
    : "Abierto";

  return (
    <header className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {dayName(date)}
            </span>
            <span className="rounded-full bg-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              {closedLabel}
            </span>
          </div>
          <h2 className="metal-date mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            {formatDisplayDate(date)}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--muted)]">
            {isSunday(date) && !settings.includeSundays
              ? "Domingo de descanso/no operativo. Solo aparecen tareas manuales."
              : FINANCIAL_CONTEXT}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <IconButton
            label={settings.theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            onClick={onToggleTheme}
            icon={settings.theme === "dark" ? Sun : Moon}
          />
          <ActionButton label="Día anterior" icon={ChevronLeft} onClick={onPreviousDay} />
          <ActionButton label="Cerrar día" icon={Check} onClick={onCloseDay} />
          <ActionButton label="Preparar mañana" icon={ChevronRight} onClick={onPrepareTomorrow} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DayProgress label="General" progress={progress} />
        {users.map((user) => (
          <UserProgress
            key={user.id}
            label={user.name}
            progress={getOwnerProgress(tasks, user.id)}
          />
        ))}
      </div>
    </header>
  );
}

function WeekView({
  data,
  selectedDate,
  onPreviousDay,
  onNextDay,
  onPrepareTomorrow,
  onSelectDate
}: {
  data: AppData;
  selectedDate: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onPrepareTomorrow: () => void;
  onSelectDate: (date: string) => void;
}) {
  const weekDates = getWeekDates(selectedDate);
  const summary = getWeeklySummary(data, selectedDate);
  const users = getUserList(data.settings);
  const weekTasks = weekDates
    .filter((date) => data.settings.includeSundays || !isSunday(date))
    .flatMap((date) => data.tasksByDate[date] ?? []);

  return (
    <div className="space-y-4">
      <DateStepper
        date={selectedDate}
        onPreviousDay={onPreviousDay}
        onNextDay={onNextDay}
        onPrepareTomorrow={onPrepareTomorrow}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Semana" value={`${summary.completionRate}%`} detail="avance general" />
        <MetricCard label="Racha semanal" value={`${summary.streak}`} detail="días sobre 60%" />
        {users.map((user) => (
          <MetricCard
            key={user.id}
            label={user.name}
            value={`${getOwnerProgress(weekTasks, user.id).completionRate}%`}
            detail="progreso individual"
          />
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {weekDates.map((date) => {
          const tasks = data.tasksByDate[date] ?? [];
          const progress = getProgress(tasks);
          const restDay = isSunday(date) && !data.settings.includeSundays;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-signal/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {dayName(date).slice(0, 3)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{formatDisplayDate(date)}</h3>
                </div>
                <span className="text-2xl font-semibold">{restDay ? "OFF" : `${progress.completionRate}%`}</span>
              </div>
              <ProgressBar value={restDay ? 0 : progress.completionRate} className="mt-4" />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-lg bg-moss/10 px-2 py-2 text-moss dark:text-[#b9d1ad]">
                  {progress.done} ok
                </span>
                <span className="rounded-lg bg-clay/10 px-2 py-2 text-clay dark:text-[#e2a183]">
                  {progress.missed} no
                </span>
                <span className="rounded-lg bg-[var(--line)] px-2 py-2 text-[var(--muted)]">
                  {progress.pending} pend
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {data.settings.users.fabian && (
          <PriorityList title={data.settings.users.fabian.name} items={PERSONAL_PRIORITIES.fabian} goal={WEEKLY_GOALS.fabian} />
        )}
        {data.settings.users.mauri && (
          <PriorityList title={data.settings.users.mauri.name} items={PERSONAL_PRIORITIES.mauri} goal={WEEKLY_GOALS.mauri} />
        )}
      </section>
    </div>
  );
}

function CalendarView({
  date,
  tasks,
  dayLog,
  settings,
  ownerFilter,
  categoryFilter,
  onSelectDate,
  onPreviousDay,
  onNextDay,
  onPrepareTomorrow,
  onOwnerFilterChange,
  onCategoryFilterChange,
  onDayLogChange,
  onAcceptNotes,
  onNewTask,
  onStatusChange,
  onNoteChange,
  onAcceptTaskNote,
  onEdit
}: {
  date: string;
  tasks: Task[];
  dayLog: DayLog;
  settings: AppSettings;
  ownerFilter: OwnerFilter;
  categoryFilter: string;
  onSelectDate: (date: string) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onPrepareTomorrow: () => void;
  onOwnerFilterChange: (value: OwnerFilter) => void;
  onCategoryFilterChange: (value: string) => void;
  onDayLogChange: (patch: Partial<DayLog>) => void;
  onAcceptNotes: () => void;
  onNewTask: () => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onNoteChange: (task: Task, note: string) => void;
  onAcceptTaskNote: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        <div>
          <DateStepper
            date={date}
            onPreviousDay={onPreviousDay}
            onNextDay={onNextDay}
            onPrepareTomorrow={onPrepareTomorrow}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-medium text-[var(--muted)]">
              Elegir fecha
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  if (event.target.value) {
                    onSelectDate(event.target.value);
                  }
                }}
                className="mt-1 block min-h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
              />
            </label>
            <ActionButton label="Crear tarea manual" icon={Plus} onClick={onNewTask} />
          </div>

          <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Nota de prioridad del día
              </p>
              <NoteAcceptButton updatedAt={dayLog.memoryUpdatedAt} onClick={onAcceptNotes} />
            </div>
            <textarea
              value={dayLog.dailyPriority}
              onChange={(event) => onDayLogChange({ dailyPriority: event.target.value })}
              placeholder="Escribí las 3 tareas principales del día..."
              className="mt-2 min-h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-signal"
            />
          </div>

          <details className="mt-3 rounded-lg border border-[var(--line)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)]">
              Reglas de productividad
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PRODUCTIVITY_RULES.map((rule) => (
                <p
                  key={rule}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]"
                >
                  {rule}
                </p>
              ))}
            </div>
          </details>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedFilter value={ownerFilter} onChange={onOwnerFilterChange} settings={settings} />
          <label className="flex flex-col gap-1 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:gap-2">
            Categoría
            <select
              value={categoryFilter}
              onChange={(event) => onCategoryFilterChange(event.target.value)}
              className="min-h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
            >
              <option value="all">Todas</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TaskList
          date={date}
          tasks={tasks}
          settings={settings}
          onStatusChange={onStatusChange}
          onNoteChange={onNoteChange}
          onAcceptNote={onAcceptTaskNote}
          onEdit={onEdit}
        />
      </section>
    </div>
  );
}

function NotesPanel({
  date,
  tasks,
  dayLog,
  settings,
  onSelectDate,
  onDayLogChange,
  onAcceptNotes,
  onTaskNoteChange,
  onAcceptTaskNote
}: {
  date: string;
  tasks: Task[];
  dayLog: DayLog;
  settings: AppSettings;
  onSelectDate: (date: string) => void;
  onDayLogChange: (patch: Partial<DayLog>) => void;
  onAcceptNotes: () => void;
  onTaskNoteChange: (task: Task, note: string) => void;
  onAcceptTaskNote: (task: Task) => void;
}) {
  const users = getUserList(settings);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Notas del día
            </p>
            <h3 className="mt-1 text-xl font-semibold">{formatDisplayDate(date)}</h3>
          </div>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) {
                onSelectDate(event.target.value);
              }
            }}
            className="min-h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <NoteField
            label="Nota general"
            value={dayLog.generalNote}
            onChange={(value) => onDayLogChange({ generalNote: value })}
            acceptedAt={dayLog.memoryUpdatedAt}
            onAccept={onAcceptNotes}
          />
          {users.map((user) => (
            <NoteField
              key={user.id}
              label={user.name}
              value={getUserNote(dayLog, user.id)}
              onChange={(value) =>
                onDayLogChange({
                  userNotes: {
                    ...(dayLog.userNotes ?? {}),
                    [user.id]: value
                  },
                  ...(user.id === "fabian" ? { fabianNote: value } : {}),
                  ...(user.id === "mauri" ? { mauriNote: value } : {})
                })
              }
              acceptedAt={dayLog.memoryUpdatedAt}
              onAccept={onAcceptNotes}
            />
          ))}
          <NoteField
            label="Ambos"
            value={dayLog.bothNote}
            onChange={(value) => onDayLogChange({ bothNote: value })}
            acceptedAt={dayLog.memoryUpdatedAt}
            onAccept={onAcceptNotes}
          />
          <NoteField
            label="Aprendizaje del día"
            value={dayLog.learning}
            onChange={(value) => onDayLogChange({ learning: value })}
            acceptedAt={dayLog.memoryUpdatedAt}
            onAccept={onAcceptNotes}
          />
          <NoteField
            label="Problema detectado"
            value={dayLog.problem}
            onChange={(value) => onDayLogChange({ problem: value })}
            acceptedAt={dayLog.memoryUpdatedAt}
            onAccept={onAcceptNotes}
          />
          <NoteField
            label="Ajuste para mañana"
            value={dayLog.tomorrowAdjustment}
            onChange={(value) => onDayLogChange({ tomorrowAdjustment: value })}
            acceptedAt={dayLog.memoryUpdatedAt}
            onAccept={onAcceptNotes}
            wide
          />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="text-lg font-semibold">Notas por tarea</h3>
        <div className="mt-3 space-y-3">
          {tasks.length === 0 ? (
            <EmptyState title="Sin tareas" body="Este día no tiene tareas generadas o manuales." />
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{task.startTime}</span>
                  <span className="text-[var(--muted)]">{ownerLabel(task.user, settings)}</span>
                  <span className="text-[var(--muted)]">/ {task.category}</span>
                </div>
                <p className="mt-1 font-medium">{task.title}</p>
                <textarea
                  value={task.note}
                  onChange={(event) => onTaskNoteChange(task, event.target.value)}
                  placeholder="Nota de esta tarea..."
                  className="mt-3 min-h-20 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-sm outline-none focus:border-signal"
                />
                <div className="mt-3 flex justify-end">
                  <NoteAcceptButton updatedAt={task.noteAcceptedAt} onClick={() => onAcceptTaskNote(task)} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCards({ data, selectedDate }: { data: AppData; selectedDate: string }) {
  const summary = getWeeklySummary(data, selectedDate);
  const weekDates = getWeekDates(selectedDate).filter(
    (date) => data.settings.includeSundays || !isSunday(date)
  );
  const tasks = weekDates.flatMap((date) => data.tasksByDate[date] ?? []);
  const users = getUserList(data.settings);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {users.map((user) => (
          <MetricCard
            key={user.id}
            label={`Completadas ${user.name}`}
            value={`${tasks.filter((task) => task.status === "done" && (task.user === user.id || task.user === "both")).length}`}
            detail="incluye tareas compartidas"
          />
        ))}
        <MetricCard label="No hechas" value={`${summary.missedTasks}`} detail="registradas esta semana" />
        <MetricCard label="Completadas" value={`${summary.completedTasks}`} detail="total semanal" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entrenamiento" value={`${summary.trainingDays}`} detail="días entrenados" />
        <MetricCard label="Barbuto" value={`${summary.barbutoDays}`} detail="días con avance" />
        <MetricCard label="Synaptix" value={`${summary.synaptixDays}`} detail="días con avance" />
        <MetricCard label="Dropshipping" value={`${summary.dropshippingDays}`} detail="días con avance" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <CategoryRank title="Categorías más cumplidas" items={summary.topCompletedCategories} empty="Todavía no hay tareas completas." />
        <CategoryRank title="Categorías más falladas" items={summary.topMissedCategories} empty="Todavía no hay tareas no hechas." />
      </section>
    </div>
  );
}

function SettingsPanel({
  data,
  inviteMessage,
  onUpdateSettings,
  onToggleSundays,
  onUpdateTemplateTask,
  onAddTemplateTask,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onInviteUser
}: {
  data: AppData;
  inviteMessage: string;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleSundays: (value: boolean) => void;
  onUpdateTemplateTask: (taskId: string, patch: Partial<TemplateTask>) => void;
  onAddTemplateTask: (owner: OwnerFilter) => void;
  onAddUser: (name: string) => void;
  onUpdateUser: (userId: string, patch: Partial<{ name: string; colorLabel: string }>) => void;
  onDeleteUser: (userId: string) => void;
  onInviteUser: (userId: string) => void;
}) {
  const settings = data.settings;
  const users = getUserList(settings);
  const [newUserName, setNewUserName] = useState("");
  const [templateOwnerFilter, setTemplateOwnerFilter] = useState<OwnerFilter>("all");
  const filteredTemplate = [...settings.baseTemplate]
    .filter((task) => taskMatchesOwnerFilter(task.user, templateOwnerFilter))
    .sort(sortTemplateByTime);

  function submitUser() {
    onAddUser(newUserName);
    setNewUserName("");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="text-lg font-semibold">Configuración</h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold"
          >
            {settings.theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Tema {settings.theme === "dark" ? "oscuro" : "claro"}
          </button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={settings.includeSundays}
              onChange={(event) => onToggleSundays(event.target.checked)}
              className="h-4 w-4 accent-signal"
            />
            Activar domingos
          </label>
        </div>

        <div className="mt-6">
          <h4 className="text-base font-semibold">Usuarios</h4>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitUser();
                }
              }}
              placeholder="Nombre del usuario"
              className="min-h-11 flex-1 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
            <ActionButton label="Agregar usuario" icon={Plus} onClick={submitUser} />
          </div>

          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Color
                    <input
                      type="color"
                      value={user.colorLabel}
                      onChange={(event) => onUpdateUser(user.id, { colorLabel: event.target.value })}
                      className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-1"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Nombre
                    <input
                      value={user.name}
                      onChange={(event) => onUpdateUser(user.id, { name: event.target.value })}
                      className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
                    />
                  </label>
                  <div className="flex gap-2">
                    <ActionButton label={user.invited ? "Invitado" : "Invitar"} icon={ChevronRight} onClick={() => onInviteUser(user.id)} />
                    <button
                      type="button"
                      title="Eliminar usuario"
                      aria-label="Eliminar usuario"
                      disabled={users.length <= 1}
                      onClick={() => onDeleteUser(user.id)}
                      className="grid h-11 w-11 place-items-center rounded-lg border border-clay/45 text-clay transition hover:bg-clay/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {inviteMessage && (
            <p className="mt-3 rounded-lg border border-signal/30 bg-signal/10 p-3 text-sm leading-5 text-[var(--muted)]">
              {inviteMessage}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Editar horario base</summary>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-medium text-[var(--muted)]">
              Filtrar de quién
              <select
                value={templateOwnerFilter}
                onChange={(event) => setTemplateOwnerFilter(event.target.value as OwnerFilter)}
                className="mt-1 block min-h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
              >
                <option value="all">Todos</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
                <option value="both">Ambos</option>
              </select>
            </label>
            <span className="text-sm text-[var(--muted)]">
              {filteredTemplate.length} tareas visibles
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredTemplate.map((task) => (
              <TemplateTaskEditor
                key={task.id}
                task={task}
                settings={settings}
                onChange={(patch) => onUpdateTemplateTask(task.id, patch)}
              />
            ))}
            <button
              type="button"
              onClick={() => onAddTemplateTask(templateOwnerFilter)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--line)] bg-[var(--background)] px-3 text-sm font-semibold transition hover:border-signal"
            >
              <Plus className="h-4 w-4" />
              Agregar nueva tarea
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}

function TaskList({
  date,
  tasks,
  settings,
  onStatusChange,
  onNoteChange,
  onAcceptNote,
  onEdit
}: {
  date: string;
  tasks: Task[];
  settings: AppSettings;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onNoteChange: (task: Task, note: string) => void;
  onAcceptNote: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title={isSunday(date) && !settings.includeSundays ? "Domingo no operativo" : "Sin tareas"}
        body={
          isSunday(date) && !settings.includeSundays
            ? "Podés crear tareas manuales si hace falta."
            : "No hay tareas para los filtros actuales."
        }
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          settings={settings}
          onStatusChange={(status) => onStatusChange(task, status)}
          onNoteChange={(note) => onNoteChange(task, note)}
          onAcceptNote={() => onAcceptNote(task)}
          onEdit={() => onEdit(task)}
        />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  settings,
  onStatusChange,
  onNoteChange,
  onAcceptNote,
  onEdit
}: {
  task: Task;
  settings: AppSettings;
  onStatusChange: (status: TaskStatus) => void;
  onNoteChange: (note: string) => void;
  onAcceptNote: () => void;
  onEdit: () => void;
}) {
  const late = isTaskLate(task.date, task.endTime, task.status);
  const status = STATUS_META[task.status];

  return (
    <article
      className={[
        "rounded-lg border p-3 transition",
        status.tone,
        late ? "border-l-4 border-l-signal" : ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            <span>{task.startTime} - {task.endTime}</span>
            <span>{ownerLabel(task.user, settings)}</span>
            <span>{task.category}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug">{task.title}</h3>
          {task.description && (
            <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{task.description}</p>
          )}
        </div>
        <button
          type="button"
          title="Editar tarea"
          aria-label="Editar tarea"
          onClick={onEdit}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--background)] text-[var(--muted)] transition hover:border-signal hover:text-[var(--foreground)]"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={task.status} />
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${PRIORITY_META[task.priority].className}`}>
          Prioridad {PRIORITY_META[task.priority].label}
        </span>
        {late && (
          <span className="inline-flex items-center gap-1 rounded-full bg-signal/20 px-2.5 py-1 text-xs font-semibold text-signal">
            <AlertTriangle className="h-3.5 w-3.5" />
            Atrasado
          </span>
        )}
        {task.reminder && (
          <span className="rounded-full bg-steel/15 px-2.5 py-1 text-xs font-semibold text-steel dark:text-[#b9c6d2]">
            Solo recordatorio, no indicación médica
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["done", "missed", "pending"] as TaskStatus[]).map((statusId) => (
          <StatusButton
            key={statusId}
            status={statusId}
            active={task.status === statusId}
            onClick={() => onStatusChange(statusId)}
          />
        ))}
      </div>

      <textarea
        value={task.note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Nota de la tarea..."
        className="mt-3 min-h-16 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)] outline-none focus:border-signal"
      />
      <div className="mt-3 flex justify-end">
        <NoteAcceptButton updatedAt={task.noteAcceptedAt} onClick={onAcceptNote} />
      </div>
    </article>
  );
}

function StatusButton({
  status,
  active,
  onClick
}: {
  status: TaskStatus;
  active: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      title={meta.label}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-semibold transition",
        active
          ? `${meta.compact} border-transparent`
          : "border-[var(--line)] bg-[var(--background)] text-[var(--muted)] hover:border-signal"
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{meta.label}</span>
    </button>
  );
}

function SegmentedFilter({
  value,
  onChange,
  settings
}: {
  value: OwnerFilter;
  onChange: (value: OwnerFilter) => void;
  settings: AppSettings;
}) {
  const options: Array<{ value: OwnerFilter; label: string }> = [
    { value: "all", label: "Todos" },
    ...getUserList(settings).map((user) => ({ value: user.id, label: user.name })),
    { value: "both", label: "Ambos" }
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--background)] p-1 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            "min-h-10 rounded-md px-2 text-sm font-semibold transition",
            value === option.value ? "bg-signal text-ink" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DayProgress({ label, progress }: { label: string; progress: ReturnType<typeof getProgress> }) {
  const color = getProgressColor(progress.completionRate);
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-semibold" style={{ color }}>{progress.completionRate}%</span>
      </div>
      <ProgressBar value={progress.completionRate} className="mt-2" />
      <p className="mt-2 text-xs text-[var(--muted)]">
        {progress.done} completas / {progress.missed} no hechas / {progress.pending} pendientes
      </p>
    </div>
  );
}

function UserProgress({
  label,
  progress
}: {
  label: string;
  progress: ReturnType<typeof getProgress>;
}) {
  const color = getProgressColor(progress.completionRate);
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-semibold" style={{ color }}>{progress.completionRate}%</span>
      </div>
      <ProgressBar value={progress.completionRate} className="mt-2" />
      <p className="mt-2 text-xs text-[var(--muted)]">
        {progress.done}/{progress.total} tareas con responsabilidad directa o compartida
      </p>
    </div>
  );
}

function ProgressBar({
  value,
  className = ""
}: {
  value: number;
  className?: string;
}) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const color = getProgressColor(normalizedValue);

  return (
    <div className={`h-2 overflow-hidden rounded-full bg-[var(--line)] ${className}`}>
      <div
        className="h-full rounded-full transition-[width,background-color,box-shadow] duration-500 ease-out"
        style={{
          width: `${normalizedValue}%`,
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}`
        }}
      />
    </div>
  );
}

function getProgressColor(value: number): string {
  const normalizedValue = Math.max(0, Math.min(100, value));

  if (normalizedValue === 100) {
    return "hsl(82 42% 36%)";
  }

  // Starts red and travels through amber into olive as work is completed.
  const hue = 4 + normalizedValue * 0.7;
  return `hsl(${hue} 48% 43%)`;
}

function StatusPill({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.compact}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function PriorityList({ title, items, goal }: { title: string; items: string[]; goal: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={item} className="flex items-center gap-2 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--line)] text-xs font-semibold">
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-lg bg-signal/10 p-3 text-sm leading-5 text-[var(--muted)]">{goal}</p>
    </div>
  );
}

function DateStepper({
  date,
  onPreviousDay,
  onNextDay,
  onPrepareTomorrow
}: {
  date: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onPrepareTomorrow: () => void;
}) {
  return (
    <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Navegar día
          </p>
          <p className="text-sm font-semibold">{formatDisplayDate(date)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onPreviousDay}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[var(--line)] px-2 text-sm font-semibold transition hover:border-signal"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <button
            type="button"
            onClick={onPrepareTomorrow}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm font-semibold transition hover:border-signal"
          >
            <span className="sm:hidden">Prep.</span>
            <span className="hidden sm:inline">Preparar mañana</span>
          </button>
          <button
            type="button"
            onClick={onNextDay}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[var(--line)] px-2 text-sm font-semibold transition hover:border-signal"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRank({
  title,
  items,
  empty
}: {
  title: string;
  items: Array<{ category: string; count: number }>;
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.category} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2">
              <span className="font-medium">{item.category}</span>
              <span className="text-sm font-semibold text-[var(--muted)]">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NoteField({
  label,
  value,
  onChange,
  acceptedAt,
  onAccept,
  wide
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  acceptedAt?: string;
  onAccept?: () => void;
  wide?: boolean;
}) {
  return (
    <label className={`text-sm font-medium text-[var(--muted)] ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-[var(--foreground)] outline-none focus:border-signal"
      />
      {onAccept && value.trim().length > 0 && (
        <div className="mt-2 flex justify-end">
          <NoteAcceptButton updatedAt={acceptedAt} onClick={onAccept} />
        </div>
      )}
    </label>
  );
}

function NoteAcceptButton({
  updatedAt,
  onClick
}: {
  updatedAt?: string;
  onClick: () => void;
}) {
  const updatedLabel = updatedAt
    ? `Actualizado ${new Date(updatedAt).toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit"
      })}`
    : "Sin actualizar";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold transition hover:border-signal"
    >
      <Check className="h-4 w-4" />
      Aceptar nota
      <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">
        {updatedLabel}
      </span>
    </button>
  );
}

function TemplateTaskEditor({
  task,
  settings,
  onChange
}: {
  task: TemplateTask;
  settings: AppSettings;
  onChange: (patch: Partial<TemplateTask>) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="grid gap-2 sm:grid-cols-[5.5rem_5.5rem_minmax(0,1fr)]">
        <input
          type="time"
          value={task.startTime}
          onChange={(event) => onChange({ startTime: event.target.value })}
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-2 text-sm outline-none focus:border-signal"
        />
        <input
          type="time"
          value={task.endTime}
          onChange={(event) => onChange({ endTime: event.target.value })}
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-2 text-sm outline-none focus:border-signal"
        />
        <input
          value={task.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-signal"
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          De quién
          <Select value={task.user} onChange={(value) => onChange({ user: value as TaskOwner })}>
            {getUserList(settings).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
            <option value="both">Ambos</option>
          </Select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Categoría
          <Select value={task.category} onChange={(value) => onChange({ category: value })}>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Prioridad
          <Select value={task.priority} onChange={(value) => onChange({ priority: value as Priority })}>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </Select>
        </label>
      </div>
    </div>
  );
}

function TaskEditorModal({
  task,
  settings,
  onSave,
  onCancel,
  onDelete
}: {
  task: Task;
  settings: AppSettings;
  onSave: (task: Task) => void;
  onCancel: () => void;
  onDelete: (task: Task) => void;
}) {
  const [draft, setDraft] = useState(task);

  function updateDraft(patch: Partial<Task>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-soft sm:max-w-2xl sm:rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {draft.manual ? "Tarea manual" : "Editar tarea"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{formatDisplayDate(draft.date)}</h3>
          </div>
          <button
            type="button"
            title="Cerrar"
            aria-label="Cerrar"
            onClick={onCancel}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2 text-sm font-medium text-[var(--muted)]">
            Título
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Inicio
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => updateDraft({ startTime: event.target.value })}
              className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Fin
            <input
              type="time"
              value={draft.endTime}
              onChange={(event) => updateDraft({ endTime: event.target.value })}
              className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Responsable
            <Select value={draft.user} onChange={(value) => updateDraft({ user: value as TaskOwner })}>
              {getUserList(settings).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
              <option value="both">Ambos</option>
            </Select>
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Categoría
            <Select value={draft.category} onChange={(value) => updateDraft({ category: value })}>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Estado
            <Select value={draft.status} onChange={(value) => updateDraft({ status: value as TaskStatus })}>
              <option value="pending">Pendiente</option>
              <option value="done">Completo</option>
              <option value="missed">No hecho</option>
            </Select>
          </label>
          <label className="text-sm font-medium text-[var(--muted)]">
            Prioridad
            <Select value={draft.priority} onChange={(value) => updateDraft({ priority: value as Priority })}>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </label>
          <label className="md:col-span-2 text-sm font-medium text-[var(--muted)]">
            Descripción
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
          </label>
          <label className="md:col-span-2 text-sm font-medium text-[var(--muted)]">
            Nota
            <textarea
              value={draft.note}
              onChange={(event) => updateDraft({ note: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-[var(--foreground)] outline-none focus:border-signal"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
            <input
              type="checkbox"
              checked={draft.recurring}
              onChange={(event) => updateDraft({ recurring: event.target.checked })}
              className="h-4 w-4 accent-signal"
            />
            Recurrente
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => onDelete(draft)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-clay/40 px-3 text-sm font-semibold text-clay"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-semibold text-ink"
            >
              <Check className="h-4 w-4" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-soft">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="min-h-11 rounded-lg bg-clay px-4 text-sm font-semibold text-white">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
  desktop
}: {
  item: { id: ViewId; label: string; icon: LucideIcon };
  active: boolean;
  onClick: () => void;
  desktop?: boolean;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      title={item.label}
      onClick={onClick}
      className={[
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition",
        desktop ? "w-full justify-start px-3" : "flex-col px-1 text-[0.68rem]",
        active ? "bg-signal text-ink" : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--foreground)]"
      ].join(" ")}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function UserNavFilter({
  value,
  onChange,
  settings,
  compact
}: {
  value: OwnerFilter;
  onChange: (value: OwnerFilter) => void;
  settings: AppSettings;
  compact?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
      Usuario
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as OwnerFilter)}
        className={[
          "mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal",
          compact ? "min-h-9 text-sm" : "min-h-11 text-sm"
        ].join(" ")}
      >
        <option value="all">Todos</option>
        {getUserList(settings).map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
        <option value="both">Ambos</option>
      </select>
    </label>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--background)] transition hover:border-signal"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  danger
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
        danger
          ? "border-clay/45 text-clay hover:bg-clay/10"
          : "border-[var(--line)] bg-[var(--background)] hover:border-signal"
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Select({
  value,
  onChange,
  children
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none focus:border-signal"
    >
      {children}
    </select>
  );
}

function ownerLabel(owner: TaskOwner, settings: AppSettings): string {
  if (owner === "both") {
    return OWNER_LABELS.both;
  }

  return settings.users[owner]?.name ?? OWNER_LABELS[owner] ?? owner;
}

function getUserList(settings: AppSettings) {
  return Object.values(settings.users).sort((a, b) => {
    const knownOrder = ["fabian", "mauri"];
    const aIndex = knownOrder.indexOf(a.id);
    const bIndex = knownOrder.indexOf(b.id);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }

    return a.name.localeCompare(b.name);
  });
}

function taskMatchesOwnerFilter(owner: TaskOwner, filter: OwnerFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "both") {
    return owner === "both";
  }

  return owner === filter || owner === "both";
}

function getUserNote(dayLog: DayLog, userId: string): string {
  if (dayLog.userNotes && userId in dayLog.userNotes) {
    return dayLog.userNotes[userId];
  }

  if (userId === "fabian") {
    return dayLog.fabianNote;
  }

  if (userId === "mauri") {
    return dayLog.mauriNote;
  }

  return "";
}

function createUserId(name: string, users: AppSettings["users"]): string {
  const base = slugify(name) || `usuario-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (users[candidate] || candidate === "both" || candidate === "all") {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextUserColor(index: number): string {
  const colors = ["#5d7554", "#a65f3b", "#d6a63f", "#53616f", "#7f5aa2", "#2f9c95"];
  return colors[index % colors.length];
}

function sortByTime(a: Task, b: Task): number {
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.title.localeCompare(b.title);
}

function sortTemplateByTime(a: TemplateTask, b: TemplateTask): number {
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.title.localeCompare(b.title);
}

function createManualTask(date: string): Task {
  const timestamp = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;

  return {
    id: `${date}-manual-${id}`,
    date,
    title: "Nueva tarea",
    description: "",
    user: "both",
    category: "Reunión",
    startTime: "09:00",
    endTime: "09:30",
    status: "pending",
    note: "",
    priority: "medium",
    recurring: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    manual: true
  };
}
