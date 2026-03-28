function interpolateMessage(message, params = {}) {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    message,
  );
}

function translateMessage(t, key, params = {}) {
  if (typeof t === 'function') {
    return interpolateMessage(t(key, params), params);
  }

  return interpolateMessage(key, params);
}

function withBannerSource(banner, status) {
  if (status?.source) {
    return {
      ...banner,
      source: status.source,
    };
  }

  return banner;
}

export function formatRouteManagerHubStatus(status, t) {
  if (!status?.configured) {
    return withBannerSource(
      {
      tone: 'warning',
      message: translateMessage(t, 'Route Manager 地址未配置'),
      },
      status,
    );
  }

  if (status.reachable) {
    return withBannerSource(
      {
      tone: 'success',
      message: translateMessage(
        t,
        '家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
      ),
      },
      status,
    );
  }

  if (typeof status?.upstream_status === 'number' && status.upstream_status > 0) {
    return withBannerSource(
      {
      tone: 'danger',
      message: translateMessage(
        t,
        '家庭管理控制系统暂时不可达，上游状态 {{upstreamStatus}}',
        { upstreamStatus: status.upstream_status },
      ),
      },
      status,
    );
  }

  return withBannerSource(
    {
    tone: 'danger',
    message: translateMessage(
      t,
      '家庭管理控制系统暂时不可达，请检查地址和 shadow 服务',
    ),
    },
    status,
  );
}

export function getRouteManagerHubStatusBanner(
  statusSnapshot,
  t,
  fallbackStatusSnapshot = null,
) {
  const resolvedStatusSnapshot =
    statusSnapshot && typeof statusSnapshot === 'object'
      ? statusSnapshot
      : fallbackStatusSnapshot && typeof fallbackStatusSnapshot === 'object'
        ? fallbackStatusSnapshot
        : null;

  if (
    !resolvedStatusSnapshot ||
    !resolvedStatusSnapshot.hub_status ||
    typeof resolvedStatusSnapshot.hub_status !== 'object'
  ) {
    return null;
  }

  return formatRouteManagerHubStatus(resolvedStatusSnapshot.hub_status, t);
}

export function mergeRouteManagerHubStatusBanner(currentBanner, nextBanner) {
  if (nextBanner) {
    if (
      currentBanner?.source === 'manual-check' &&
      currentBanner?.tone === 'danger' &&
      nextBanner?.source === 'sync-fallback'
    ) {
      return currentBanner;
    }

    return nextBanner;
  }

  if (
    currentBanner?.source === 'manual-check' &&
    currentBanner?.tone === 'danger'
  ) {
    return currentBanner;
  }

  return null;
}
