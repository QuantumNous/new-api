const SUCCESS_RATE_JITTER_POINTS = 1;
const EMPTY_HEALTH_BAR_HEIGHTS = [8, 8, 8, 8, 8] as const;

export function getJitteredSuccessRate(value: number | undefined, seed: string, dayKey = currentUtcDayKey()): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  const offset = (hash01(`${seed}:${dayKey}:success-rate`) * 2 - 1) * SUCCESS_RATE_JITTER_POINTS;
  return clamp(value + offset, 0, 100);
}

export function formatHealthSuccessRate(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 99.95) return `${value.toFixed(1)}%`;
  const digits = value >= 99 ? 2 : 1;
  return `${value.toFixed(digits)}%`;
}

export function getHealthSignalHeights(value: number | undefined, seed: string, dayKey = currentUtcDayKey()): number[] {
  if (value == null || !Number.isFinite(value)) return [...EMPTY_HEALTH_BAR_HEIGHTS];
  const normalized = clamp((value - 90) / 10, 0, 1);
  const shape = [0.42, 0.58, 0.74, 0.9, 1];
  return shape.map((barScale, index) => {
    const jitter = (hash01(`${seed}:${dayKey}:health-bar:${index}`) * 2 - 1) * 1.1;
    return Math.round(clamp(4 + barScale * 16 * normalized + jitter, 4, 20));
  });
}

function currentUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
