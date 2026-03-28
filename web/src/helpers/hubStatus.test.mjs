import { describe, expect, test } from 'bun:test';

import {
  formatRouteManagerHubStatus,
  getRouteManagerHubStatusBanner,
  mergeRouteManagerHubStatusBanner,
} from './hubStatus.js';

describe('formatRouteManagerHubStatus', () => {
  test('formats unconfigured hub state', () => {
    const t = (key) => `translated:${key}`;

    expect(
      formatRouteManagerHubStatus(
        { configured: false, reachable: false },
        t,
      ),
    ).toEqual({
        tone: 'warning',
        message: 'translated:Route Manager 地址未配置',
      });
  });

  test('formats reachable hub state', () => {
    const t = (key) => `translated:${key}`;

    expect(
      formatRouteManagerHubStatus({
          configured: true,
          reachable: true,
          service: 'route-manager',
        },
        t,
      ),
    ).toEqual({
      tone: 'success',
      message: 'translated:家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
    });
  });

  test('formats unreachable hub state with upstream status', () => {
    const t = (key, params) => `translated:${key}:${params?.upstreamStatus ?? ''}`;

    expect(
      formatRouteManagerHubStatus({
          configured: true,
          reachable: false,
          upstream_status: 502,
        },
        t,
      ),
    ).toEqual({
      tone: 'danger',
      message: 'translated:家庭管理控制系统暂时不可达，上游状态 502:502',
    });
  });

  test('preserves source metadata when formatting hub state', () => {
    expect(
      formatRouteManagerHubStatus({
        configured: true,
        reachable: false,
        source: 'sync-fallback',
      }),
    ).toEqual({
      tone: 'danger',
      message: '家庭管理控制系统暂时不可达，请检查地址和 shadow 服务',
      source: 'sync-fallback',
    });
  });

  test('falls back to local strings when no translator is provided', () => {
    expect(
      formatRouteManagerHubStatus({
        configured: true,
        reachable: false,
        upstream_status: 502,
      }),
    ).toEqual({
      tone: 'danger',
      message: '家庭管理控制系统暂时不可达，上游状态 502',
    });
  });

  test('interpolates placeholders when translator returns the key unchanged', () => {
    const t = (key) => key;

    expect(
      formatRouteManagerHubStatus(
        {
          configured: true,
          reachable: false,
          upstream_status: 502,
        },
        t,
      ),
    ).toEqual({
      tone: 'danger',
      message: '家庭管理控制系统暂时不可达，上游状态 502',
    });
  });
});

describe('getRouteManagerHubStatusBanner', () => {
  test('returns null before the status snapshot is loaded', () => {
    expect(getRouteManagerHubStatusBanner(null)).toBeNull();
  });

  test('returns null when the loaded status snapshot has no hub status yet', () => {
    expect(
      getRouteManagerHubStatusBanner({
        system_name: 'AI Gateway',
      }),
    ).toBeNull();
  });

  test('returns null when the loaded status snapshot has a null hub status', () => {
    expect(
      getRouteManagerHubStatusBanner({
        system_name: 'AI Gateway',
        hub_status: null,
      }),
    ).toBeNull();
  });

  test('falls back to a saved status snapshot when the live status is not ready', () => {
    const t = (key) => `translated:${key}`;

    expect(
      getRouteManagerHubStatusBanner(
        null,
        t,
        {
          system_name: 'AI Gateway',
          hub_status: {
            configured: true,
            reachable: true,
            service: 'route-manager',
          },
        },
      ),
    ).toEqual({
      tone: 'success',
      message: 'translated:家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
    });
  });

  test('formats the current hub state from a loaded status snapshot', () => {
    const t = (key) => `translated:${key}`;

    expect(
      getRouteManagerHubStatusBanner(
        {
          system_name: 'AI Gateway',
          hub_status: {
            configured: true,
            reachable: true,
            service: 'route-manager',
          },
        },
        t,
      ),
    ).toEqual({
      tone: 'success',
      message: 'translated:家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
    });
  });
});

describe('mergeRouteManagerHubStatusBanner', () => {
  test('keeps a manual error banner when the synced status snapshot has cleared hub status', () => {
    expect(
      mergeRouteManagerHubStatusBanner(
        {
          tone: 'danger',
          message: 'translated:Route Manager 状态检查失败',
          source: 'manual-check',
        },
        null,
      ),
    ).toEqual({
      tone: 'danger',
      message: 'translated:Route Manager 状态检查失败',
      source: 'manual-check',
    });
  });

  test('replaces the manual error banner when a new snapshot banner is available', () => {
    expect(
      mergeRouteManagerHubStatusBanner(
        {
          tone: 'danger',
          message: 'translated:Route Manager 状态检查失败',
          source: 'manual-check',
        },
        {
          tone: 'success',
          message: 'translated:家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
        },
      ),
    ).toEqual({
      tone: 'success',
      message: 'translated:家庭管理控制系统已接入，可通过 /hub/ 打开家域中枢',
    });
  });

  test('keeps the manual error banner when the synced fallback banner only reflects the cleared cache state', () => {
    expect(
      mergeRouteManagerHubStatusBanner(
        {
          tone: 'danger',
          message: 'translated:Route Manager 状态检查失败',
          source: 'manual-check',
        },
        {
          tone: 'danger',
          message: 'translated:家庭管理控制系统暂时不可达，请检查地址和 shadow 服务',
          source: 'sync-fallback',
        },
      ),
    ).toEqual({
      tone: 'danger',
      message: 'translated:Route Manager 状态检查失败',
      source: 'manual-check',
    });
  });
});
