import { getWeekDates, isSunday, startOfWeek } from "./dates";
import type { AppData, ProgressStats, Task, UserId, WeeklySummary } from "./types";

export function getProgress(tasks: Task[]): ProgressStats {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const missed = tasks.filter((task) => task.status === "missed").length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  return {
    total,
    done,
    missed,
    pending,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

export function getOwnerProgress(tasks: Task[], owner: UserId): ProgressStats {
  return getProgress(tasks.filter((task) => task.user === owner || task.user === "both"));
}

export function getCategoryCounts(tasks: Task[], status: "done" | "missed"): Array<{ category: string; count: number }> {
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    if (task.status !== status) {
      return acc;
    }

    acc[task.category] = (acc[task.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function countDoneDaysByCategory(data: AppData, dates: string[], category: string): number {
  return dates.filter((date) =>
    (data.tasksByDate[date] ?? []).some(
      (task) => task.category === category && task.status === "done"
    )
  ).length;
}

export function getWeeklySummary(data: AppData, selectedDate: string): WeeklySummary {
  const dates = getWeekDates(selectedDate);
  const operationalDates = dates.filter(
    (date) => data.settings.includeSundays || !isSunday(date)
  );
  const tasks = operationalDates.flatMap((date) => data.tasksByDate[date] ?? []);
  const overall = getProgress(tasks);
  const fabian = getOwnerProgress(tasks, "fabian");
  const mauri = getOwnerProgress(tasks, "mauri");
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = dates[dates.length - 1];

  return {
    weekStart,
    weekEnd,
    completionRate: overall.completionRate,
    fabianCompletionRate: fabian.completionRate,
    mauriCompletionRate: mauri.completionRate,
    completedTasks: overall.done,
    missedTasks: overall.missed,
    trainingDays: countDoneDaysByCategory(data, operationalDates, "Entrenamiento"),
    barbutoDays: countDoneDaysByCategory(data, operationalDates, "Barbuto"),
    synaptixDays: countDoneDaysByCategory(data, operationalDates, "Synaptix"),
    dropshippingDays: countDoneDaysByCategory(data, operationalDates, "Dropshipping"),
    streak: getWeeklyStreak(data, operationalDates),
    topCompletedCategories: getCategoryCounts(tasks, "done").slice(0, 5),
    topMissedCategories: getCategoryCounts(tasks, "missed").slice(0, 5)
  };
}

function getWeeklyStreak(data: AppData, dates: string[]): number {
  let streak = 0;

  for (const date of dates) {
    const tasks = data.tasksByDate[date] ?? [];
    if (tasks.length === 0) {
      continue;
    }

    const progress = getProgress(tasks);
    if (progress.completionRate >= 60) {
      streak += 1;
    }
  }

  return streak;
}
