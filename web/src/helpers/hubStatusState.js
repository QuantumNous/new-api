export function buildStatusSnapshotWithHubStatus(
  currentStatus = null,
  nextHubStatus = null,
  fallbackStatus = null,
) {
  const baseStatus =
    currentStatus && typeof currentStatus === 'object'
      ? currentStatus
      : fallbackStatus && typeof fallbackStatus === 'object'
        ? fallbackStatus
        : null;

  if (!baseStatus) {
    return null;
  }

  return {
    ...baseStatus,
    hub_status: nextHubStatus,
  };
}

export function buildStatusSnapshotWithClearedHubStatus(
  currentStatus = null,
  fallbackStatus = null,
) {
  return buildStatusSnapshotWithHubStatus(currentStatus, null, fallbackStatus);
}

export function buildRouteManagerHubCheckFallbackStatus({
  currentStatus = null,
  routeManagerURL = '',
  pendingRouteManagerURL = '',
  fallbackStatus = null,
} = {}) {
  const normalizedRouteManagerURL =
    typeof routeManagerURL === 'string' ? routeManagerURL.trim() : '';
  const normalizedPendingRouteManagerURL =
    typeof pendingRouteManagerURL === 'string'
      ? pendingRouteManagerURL.trim()
      : '';

  return {
    configured:
      normalizedRouteManagerURL.length > 0 ||
      normalizedPendingRouteManagerURL.length > 0 ||
      Boolean(currentStatus?.hub_status?.configured) ||
      Boolean(fallbackStatus?.hub_status?.configured),
    reachable: false,
    source: 'sync-fallback',
  };
}
