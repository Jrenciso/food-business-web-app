import type { MonitorOrder } from './cloud';
import { operatingDate } from './operations';

export const monitorStages = ['New', 'Preparing', 'Ready', 'Picked up', 'Out for delivery'] as const;

export function elapsedMilliseconds(timestamp: string | undefined, now: number): number | null {
  if (!timestamp) return null;
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? Math.max(0, now - value) : null;
}

export function formatElapsed(milliseconds: number | null): string {
  if (milliseconds === null) return 'Time unavailable';
  const minutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const remainder = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${remainder}m`;
  return `${minutes}m`;
}

function safeOperatingDate(timestamp: string | undefined, timezone: string, cutoff: string): string | null {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  try { return operatingDate(timestamp, timezone, cutoff); } catch { return null; }
}

export const monitorBusinessDate = (order: MonitorOrder, timezone: string, cutoff: string) => {
  const dateOnly = order.businessDate;
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) &&
      Number.isFinite(Date.parse(`${dateOnly}T00:00:00Z`)) &&
      new Date(`${dateOnly}T00:00:00Z`).toISOString().slice(0, 10) === dateOnly) return dateOnly;
  return safeOperatingDate(order.createdAt, timezone, cutoff);
};

const completedAt = (order: MonitorOrder) =>
  [...order.statusHistory].reverse().find((entry) => entry.status === 'Completed')?.at;

export function calculateMonitorSummary(
  orders: MonitorOrder[], businessDate: string, timezone: string, cutoff: string,
) {
  const receivedToday = orders.filter((order) => monitorBusinessDate(order, timezone, cutoff) === businessDate);
  const activeToday = receivedToday.filter((order) => !['Completed', 'Cancelled'].includes(order.status));
  const carryover = orders.filter((order) => monitorBusinessDate(order, timezone, cutoff) !== null && monitorBusinessDate(order, timezone, cutoff)! < businessDate &&
    !['Completed', 'Cancelled'].includes(order.status))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const futureActive = orders.filter((order) => monitorBusinessDate(order, timezone, cutoff) !== null && monitorBusinessDate(order, timezone, cutoff)! > businessDate &&
    !['Completed', 'Cancelled'].includes(order.status))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const unscopedActive = orders.filter((order) => monitorBusinessDate(order, timezone, cutoff) === null &&
    !['Completed', 'Cancelled'].includes(order.status));
  const completedToday = orders.filter((order) => {
    const at = completedAt(order);
    return order.status === 'Completed' && safeOperatingDate(at, timezone, cutoff) === businessDate;
  }).sort((a, b) => Date.parse(completedAt(b)!) - Date.parse(completedAt(a)!));
  const turnarounds = completedToday
    .filter((order) => monitorBusinessDate(order, timezone, cutoff) === businessDate &&
      safeOperatingDate(order.createdAt, timezone, cutoff) === businessDate)
    .map((order) => {
      const at = completedAt(order)!;
      const created = Date.parse(order.createdAt);
      const completed = Date.parse(at);
      return Number.isFinite(created) && Number.isFinite(completed) && completed >= created
        ? completed - created : null;
    }).filter((duration): duration is number => duration !== null);
  const activeAll = [...activeToday, ...carryover, ...futureActive, ...unscopedActive];
  const oldest = activeAll.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
  const laneCounts = Object.fromEntries(monitorStages.map((stage) => [
    stage, activeToday.filter((order) => order.status === stage).length,
  ])) as Record<(typeof monitorStages)[number], number>;
  return {
    receivedToday,
    cancelledToday: receivedToday.filter((order) => order.status === 'Cancelled').length,
    activeToday,
    carryover,
    futureActive,
    unscopedActive,
    completedToday,
    turnarounds,
    oldest,
    laneCounts,
  };
}
