import { describe, expect, test } from 'bun:test';

import {
  getRouteManagerHubAIFleetHref,
  getRouteManagerHubAlertHref,
  getRouteManagerHubAlertsHref,
  getRouteManagerHubDNSSecurityHref,
  getRouteManagerHubEgressHref,
  getRouteManagerHubHref,
  getRouteManagerHubHomeAssistantEntitiesHref,
  getRouteManagerHubNodeHref,
  getRouteManagerHubNodesHref,
  getRouteManagerHubNetworkPanelHref,
  getRouteManagerHubScheduleHref,
  getRouteManagerHubSidebarItems,
  getRouteManagerHubTaskHref,
  shouldShowRouteManagerHubEntry,
} from './hubNavigation.js';

describe('shouldShowRouteManagerHubEntry', () => {
  test('shows the hub entry when the hub is configured', () => {
    expect(
      shouldShowRouteManagerHubEntry({
        configured: true,
        reachable: true,
      }),
    ).toBe(true);
  });

  test('hides the hub entry when the hub is not configured', () => {
    expect(
      shouldShowRouteManagerHubEntry({
        configured: false,
        reachable: false,
      }),
    ).toBe(false);
  });
});

describe('getRouteManagerHubHref', () => {
  test('returns the same-origin hub entry path', () => {
    expect(getRouteManagerHubHref()).toBe('/hub/');
  });
});

describe('getRouteManagerHubSidebarItems', () => {
  test('returns the hub sidebar submenu entries in a stable order', () => {
    const t = (label) => `translated:${label}`;

    expect(getRouteManagerHubSidebarItems(t)).toEqual([
      {
        itemKey: 'hub_overview',
        text: 'translated:家域中枢总览',
        to: '/hub/',
      },
      {
        itemKey: 'hub_nodes',
        text: 'translated:节点中心',
        to: '/hub/?view=nodes',
      },
      {
        itemKey: 'hub_tasks',
        text: 'translated:任务中心',
        to: '/hub/?view=tasks',
      },
      {
        itemKey: 'hub_alerts',
        text: 'translated:告警中心',
        to: '/hub/?view=alerts',
      },
      {
        itemKey: 'hub_ai_fleet',
        text: 'translated:家庭算力编队',
        to: '/hub/?view=ai&panel=fleet',
      },
      {
        itemKey: 'hub_network_mihomo',
        text: 'translated:网络代理状态',
        to: '/hub/?view=network&panel=mihomo',
      },
      {
        itemKey: 'hub_network_dns',
        text: 'translated:DNS 广告屏蔽',
        to: '/hub/?view=network&panel=dns',
      },
      {
        itemKey: 'hub_network_egress',
        text: 'translated:出口网络画像',
        to: '/hub/?view=network&panel=egress',
      },
      {
        itemKey: 'hub_ha_entities',
        text: 'translated:家庭实体桥接',
        to: '/hub/?view=ha&panel=entities',
      },
    ]);
  });
});

describe('getRouteManagerHubNodesHref', () => {
  test('returns the hub nodes entry path', () => {
    expect(getRouteManagerHubNodesHref()).toBe('/hub/?view=nodes');
  });
});

describe('getRouteManagerHubAlertsHref', () => {
  test('returns the hub alerts entry path', () => {
    expect(getRouteManagerHubAlertsHref()).toBe('/hub/?view=alerts');
  });
});

describe('panel deep links', () => {
  test('builds the ai fleet deep link', () => {
    expect(getRouteManagerHubAIFleetHref()).toBe('/hub/?view=ai&panel=fleet');
  });

  test('builds the network mihomo panel deep link', () => {
    expect(getRouteManagerHubNetworkPanelHref('mihomo')).toBe(
      '/hub/?view=network&panel=mihomo',
    );
  });

  test('builds the dns ad blocking deep link', () => {
    expect(getRouteManagerHubDNSSecurityHref()).toBe(
      '/hub/?view=network&panel=dns',
    );
  });

  test('builds the egress identity deep link', () => {
    expect(getRouteManagerHubEgressHref()).toBe(
      '/hub/?view=network&panel=egress',
    );
  });

  test('builds the home assistant entities deep link', () => {
    expect(getRouteManagerHubHomeAssistantEntitiesHref()).toBe(
      '/hub/?view=ha&panel=entities',
    );
  });
});

describe('getRouteManagerHubTaskHref', () => {
  test('builds a hub task detail deep link', () => {
    expect(getRouteManagerHubTaskHref(19)).toBe('/hub/?view=tasks&task_id=19');
  });

  test('falls back to the hub home when task id is invalid', () => {
    expect(getRouteManagerHubTaskHref(0)).toBe('/hub/');
  });
});

describe('getRouteManagerHubScheduleHref', () => {
  test('builds a hub schedule deep link', () => {
    expect(getRouteManagerHubScheduleHref(9)).toBe(
      '/hub/?view=tasks&schedule_id=9',
    );
  });

  test('falls back to the hub tasks page when schedule id is invalid', () => {
    expect(getRouteManagerHubScheduleHref(0)).toBe('/hub/?view=tasks');
  });
});

describe('getRouteManagerHubNodeHref', () => {
  test('builds a hub node deep link', () => {
    expect(getRouteManagerHubNodeHref('shadow-node-001')).toBe(
      '/hub/?view=nodes&node_id=shadow-node-001',
    );
  });

  test('falls back to the hub node center when node id is empty', () => {
    expect(getRouteManagerHubNodeHref('')).toBe('/hub/?view=nodes');
  });
});

describe('getRouteManagerHubAlertHref', () => {
  test('builds a hub alert deep link', () => {
    expect(getRouteManagerHubAlertHref('schedule:9:12')).toBe(
      '/hub/?view=alerts&alert_id=schedule%3A9%3A12',
    );
  });

  test('falls back to the hub alert center when alert id is empty', () => {
    expect(getRouteManagerHubAlertHref('')).toBe('/hub/?view=alerts');
  });
});
