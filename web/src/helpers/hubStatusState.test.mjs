import { describe, expect, test } from 'bun:test';

import {
  buildRouteManagerHubCheckFallbackStatus,
  buildStatusSnapshotWithClearedHubStatus,
  buildStatusSnapshotWithHubStatus,
} from './hubStatusState.js';

describe('buildStatusSnapshotWithHubStatus', () => {
  test('merges the latest hub status into an existing status snapshot', () => {
    const currentStatus = {
      system_name: 'AI Gateway',
      hub_status: {
        configured: false,
        reachable: false,
      },
      docs_link: 'https://docs.example.com',
    };
    const nextHubStatus = {
      configured: true,
      reachable: true,
      message: 'route-manager reachable',
      upstream_status: 200,
    };

    expect(
      buildStatusSnapshotWithHubStatus(currentStatus, nextHubStatus),
    ).toEqual({
      system_name: 'AI Gateway',
      hub_status: nextHubStatus,
      docs_link: 'https://docs.example.com',
    });
    expect(currentStatus.hub_status.configured).toBe(false);
  });

  test('returns null when there is no base status snapshot to update', () => {
    expect(buildStatusSnapshotWithHubStatus(null, { configured: true })).toBe(
      null,
    );
  });

  test('falls back to a saved status snapshot when context status is not ready', () => {
    const savedStatus = {
      system_name: 'AI Gateway',
      footer_html: '<p>footer</p>',
      hub_status: {
        configured: false,
        reachable: false,
      },
    };
    const nextHubStatus = {
      configured: true,
      reachable: true,
      message: 'route-manager reachable',
    };

    expect(
      buildStatusSnapshotWithHubStatus(null, nextHubStatus, savedStatus),
    ).toEqual({
      system_name: 'AI Gateway',
      footer_html: '<p>footer</p>',
      hub_status: nextHubStatus,
    });
  });

  test('clears a saved hub status snapshot after a failed hub check', () => {
    const savedStatus = {
      system_name: 'AI Gateway',
      footer_html: '<p>footer</p>',
      hub_status: {
        configured: true,
        reachable: true,
        service: 'route-manager',
      },
    };

    expect(
      buildStatusSnapshotWithClearedHubStatus(null, savedStatus),
    ).toEqual({
      system_name: 'AI Gateway',
      footer_html: '<p>footer</p>',
      hub_status: null,
    });
  });
});

describe('buildRouteManagerHubCheckFallbackStatus', () => {
  test('marks the hub as configured but unreachable when Route Manager URL is present', () => {
    expect(
      buildRouteManagerHubCheckFallbackStatus({
        routeManagerURL: 'http://route-manager-shadow:19080',
      }),
    ).toEqual({
      configured: true,
      reachable: false,
      source: 'sync-fallback',
    });
  });

  test('treats a just-saved Route Manager URL as configured before persisted state catches up', () => {
    expect(
      buildRouteManagerHubCheckFallbackStatus({
        routeManagerURL: '',
        pendingRouteManagerURL: 'http://route-manager-shadow:19080',
        currentStatus: {
          hub_status: {
            configured: false,
            reachable: false,
          },
        },
        fallbackStatus: {
          hub_status: {
            configured: false,
            reachable: false,
          },
        },
      }),
    ).toEqual({
      configured: true,
      reachable: false,
      source: 'sync-fallback',
    });
  });

  test('falls back to the saved hub configuration when the input URL is not ready', () => {
    expect(
      buildRouteManagerHubCheckFallbackStatus({
        currentStatus: null,
        fallbackStatus: {
          hub_status: {
            configured: true,
            reachable: true,
          },
        },
      }),
    ).toEqual({
      configured: true,
      reachable: false,
      source: 'sync-fallback',
    });
  });

  test('treats an explicitly cleared Route Manager URL as unconfigured', () => {
    expect(
      buildRouteManagerHubCheckFallbackStatus({
        routeManagerURL: '',
        pendingRouteManagerURL: '',
        respectExplicitEmptyRouteManagerURL: true,
        currentStatus: {
          hub_status: {
            configured: true,
            reachable: true,
          },
        },
        fallbackStatus: {
          hub_status: {
            configured: true,
            reachable: true,
          },
        },
      }),
    ).toEqual({
      configured: false,
      reachable: false,
      source: 'sync-fallback',
    });
  });
});
