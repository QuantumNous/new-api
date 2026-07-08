"use client";

import type { HomeTrendPoint } from "@/lib/home-live";
import { cn } from "@/lib/utils";

// Status-page style daily bars: one green bar per day. The height range is
// deliberately compressed (worst day still reads tall) so the wall signals
// stability; exact per-day rates live in the native tooltips.
export function DailyHealthBars(props: { points: HomeTrendPoint[]; label: string; heightPx?: number }) {
  const heightPx = props.heightPx ?? 56;
  const days = bucketByDay(props.points);
  if (days.length === 0) return null;
  const min = Math.min(...days.map((day) => day.rate));
  const range = Math.max(100 - min, 0.1);

  return (
    <div className="flex h-full items-end gap-[2px]" role="img" aria-label={props.label}>
      {days.map((day) => {
        const scale = (day.rate - min) / range;
        const height = 72 + scale * 28;
        return (
          <div
            key={day.key}
            className="group/bar relative flex-1"
            title={`${day.key} · ${day.rate.toFixed(2)}%`}
          >
            <div
              className={cn(
                "w-full rounded-t-[3px] bg-emerald-500 transition-opacity group-hover/bar:opacity-75",
                day.rate < 99 && "opacity-80"
              )}
              style={{ height: `${(height / 100) * heightPx}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function bucketByDay(points: HomeTrendPoint[]): { key: string; rate: number }[] {
  const byDay = new Map<string, number[]>();
  for (const point of points) {
    const key = new Date(point.ts * 1000).toISOString().slice(0, 10);
    const values = byDay.get(key) ?? [];
    values.push(point.success_rate);
    byDay.set(key, values);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({ key, rate: values.reduce((sum, value) => sum + value, 0) / values.length }));
}
