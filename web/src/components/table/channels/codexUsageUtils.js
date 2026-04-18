export const CODEX_CHANNEL_TYPE = 57;

export const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, parsed));
};

const normalizePlanType = (value) => {
  if (value == null) {
    return '';
  }
  return String(value).trim().toLowerCase();
};

const getWindowDurationSeconds = (windowData) => {
  const value = Number(windowData?.limit_window_seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

const classifyWindowByDuration = (windowData) => {
  const seconds = getWindowDurationSeconds(windowData);
  if (seconds == null) {
    return null;
  }
  return seconds >= 24 * 60 * 60 ? 'weekly' : 'fiveHour';
};

export const resolveRateLimitWindows = (data) => {
  const rateLimit = data?.rate_limit ?? {};
  const primary = rateLimit?.primary_window ?? null;
  const secondary = rateLimit?.secondary_window ?? null;
  const windows = [primary, secondary].filter(Boolean);
  const planType = normalizePlanType(data?.plan_type ?? rateLimit?.plan_type);

  let fiveHourWindow = null;
  let weeklyWindow = null;

  for (const windowData of windows) {
    const bucket = classifyWindowByDuration(windowData);
    if (bucket === 'fiveHour' && !fiveHourWindow) {
      fiveHourWindow = windowData;
      continue;
    }
    if (bucket === 'weekly' && !weeklyWindow) {
      weeklyWindow = windowData;
    }
  }

  if (planType === 'free') {
    if (!weeklyWindow) {
      weeklyWindow = primary ?? secondary ?? null;
    }
    return { fiveHourWindow: null, weeklyWindow };
  }

  if (!fiveHourWindow && !weeklyWindow) {
    return {
      fiveHourWindow: primary ?? null,
      weeklyWindow: secondary ?? null,
    };
  }

  if (!fiveHourWindow) {
    fiveHourWindow =
      windows.find((windowData) => windowData !== weeklyWindow) ?? null;
  }
  if (!weeklyWindow) {
    weeklyWindow =
      windows.find((windowData) => windowData !== fiveHourWindow) ?? null;
  }

  return { fiveHourWindow, weeklyWindow };
};

export const extractCodexUsageSummary = (payload) => {
  const data = payload?.data ?? null;
  const { fiveHourWindow, weeklyWindow } = resolveRateLimitWindows(data);

  const readPercent = (windowData) => {
    if (!windowData) {
      return null;
    }
    return clampPercent(windowData?.used_percent ?? 0);
  };

  return {
    fiveHourPercent: readPercent(fiveHourWindow),
    weeklyPercent: readPercent(weeklyWindow),
    accountType: data?.plan_type ?? data?.rate_limit?.plan_type ?? '',
    upstreamStatus: payload?.upstream_status ?? null,
  };
};
