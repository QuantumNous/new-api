import { describe, expect, test } from 'bun:test';

import {
  buildRouteManagerHubAlertDetail,
  buildRouteManagerHubDashboardSnapshot,
  buildRouteManagerHubFamilySummaryPills,
  formatRouteManagerHubAlertSeverity,
  formatRouteManagerHubAlertSubtitle,
  formatRouteManagerHubNodeStatus,
  getRouteManagerHubTaskStatusColor,
  formatRouteManagerHubTaskStatus,
  formatRouteManagerHubTaskType,
  buildRouteManagerHubQuickPanelLinks,
  buildRouteManagerHubQuickHighlights,
  extractRouteManagerTaskPreview,
} from './hubDashboard.js';

describe('extractRouteManagerTaskPreview', () => {
  test('uses shell stdout as preview when available', () => {
    expect(
      extractRouteManagerTaskPreview({
        type: 'shell',
        command: 'echo shadow-agent-smoke',
        steps: [
          {
            type: 'execute',
            output: JSON.stringify({
              stdout: 'shadow-agent-smoke\n',
            }),
          },
        ],
      }),
    ).toBe('shadow-agent-smoke');
  });

  test('uses browser page title when available', () => {
    expect(
      extractRouteManagerTaskPreview({
        type: 'browser',
        command: 'http://route-manager-shadow:19080/',
        steps: [
          {
            type: 'execute',
            output: JSON.stringify({
              page_title: '家域中枢',
              page_url: 'http://route-manager-shadow:19080/',
            }),
          },
        ],
      }),
    ).toBe('家域中枢');
  });

  test('uses stderr as preview when stdout is unavailable', () => {
    expect(
      extractRouteManagerTaskPreview({
        type: 'shell',
        command: 'sh -c fail',
        steps: [
          {
            type: 'execute',
            output: JSON.stringify({
              stderr: 'shadow-alert-smoke\n',
            }),
          },
        ],
      }),
    ).toBe('shadow-alert-smoke');
  });

  test('falls back to the command when task output is unavailable', () => {
    expect(
      extractRouteManagerTaskPreview({
        type: 'shell',
        command: 'echo fallback',
        steps: [],
      }),
    ).toBe('echo fallback');
  });
});

describe('buildRouteManagerHubDashboardSnapshot', () => {
  test('builds node and task summaries for dashboard cards', () => {
    const snapshot = buildRouteManagerHubDashboardSnapshot({
      onlineNodes: 4,
      busyNodes: 2,
      pendingTasks: 6,
      activeSchedules: 2,
      criticalAlerts: 2,
      unacknowledgedAlerts: 1,
      ai: {
        model_count: 5,
        ai_capable_nodes: 2,
        online_ai_nodes: 1,
      },
      network: {
        mihomo_configured: true,
        mihomo_reachable: false,
        dns_configured: true,
        dns_reachable: true,
        dns_protection_enabled: true,
        egress_ip: '119.29.29.29',
        egress_region: '中国 广东 深圳',
        egress_isp: '腾讯云',
        egress_source: 'probe+qqwry',
      },
      home_assistant: {
        configured: true,
        reachable: true,
        entity_count: 18,
      },
      primary_node: {
        node_id: 'shadow-node-001',
        hostname: 'shadow-host',
        status: 'online',
        ip_address: '192.168.31.18',
      },
      nodes: [
        {
          node_id: 'shadow-node-001',
          status: 'online',
          browser_runtime: {
            active_tasks: 1,
            pending_tasks: 0,
          },
        },
        {
          node_id: 'shadow-node-002',
          status: 'offline',
          browser_runtime: {
            active_tasks: 0,
            pending_tasks: 2,
          },
        },
      ],
      tasks: [
        {
          id: 9,
          type: 'browser',
          status: 'succeeded',
          target_node_id: 'shadow-node-001',
          command: 'http://route-manager-shadow:19080/',
          steps: [
            {
              type: 'execute',
              output: JSON.stringify({
                page_title: '家域中枢',
              }),
            },
          ],
        },
        {
          id: 8,
          type: 'shell',
          status: 'pending',
          target_node_id: 'shadow-node-001',
          command: 'echo waiting',
          steps: [],
        },
        {
          id: 7,
          type: 'shell',
          status: 'failed',
          target_node_id: 'shadow-node-002',
          command: 'echo failed',
          steps: [],
        },
        {
          id: 6,
          type: 'shell',
          status: 'succeeded',
          target_node_id: 'shadow-node-001',
          command: 'echo hidden',
          steps: [],
        },
      ],
      schedules: [
        {
          id: 9,
          name: '晚间模型巡检',
          type: 'shell',
          target_node_id: 'shadow-node-001',
          daily_at: '23:30',
          enabled: true,
          next_run_at: '2026-03-24T23:30:00+08:00',
        },
        {
          id: 8,
          name: '晨间模型巡检',
          type: 'browser',
          target_node_id: 'shadow-node-002',
          daily_at: '08:15',
          enabled: true,
          next_run_at: '2026-03-25T08:15:00+08:00',
        },
        {
          id: 7,
          name: '午间同步',
          type: 'shell',
          target_node_id: 'shadow-node-001',
          daily_at: '12:00',
          enabled: false,
          next_run_at: '2026-03-25T12:00:00+08:00',
        },
        {
          id: 6,
          name: '隐藏计划',
          type: 'shell',
          target_node_id: 'shadow-node-001',
          daily_at: '01:00',
          enabled: true,
          next_run_at: '2026-03-25T01:00:00+08:00',
        },
      ],
      alerts: [
        {
          id: 'schedule:9:12',
          kind: 'schedule',
          severity: 'critical',
          title: '晚间模型巡检',
          subtitle: '任务 #12 · 失败',
          preview: '最近夜巡执行失败，请查看任务链路',
          meta_text: 'shadow-node-001',
          target_node_id: 'shadow-node-001',
          acknowledged: false,
        },
        {
          id: 'task:8',
          kind: 'task',
          severity: 'warning',
          title: '任务 #8 执行失败',
          subtitle: 'shell · shadow-node-001',
          meta_text: 'shadow-node-001',
          target_node_id: 'shadow-node-001',
          acknowledged: true,
        },
        {
          id: 'system:network:mihomo',
          kind: 'system',
          severity: 'critical',
          title: 'Mihomo 代理内核异常',
          subtitle: '代理运行时不可达',
          meta_text: 'gateway-mini',
          target_node_id: 'shadow-node-003',
          acknowledged: false,
        },
        {
          id: 'task:6',
          kind: 'task',
          severity: 'warning',
          title: '任务 #6 执行失败',
          subtitle: 'shell · shadow-node-001',
          meta_text: 'shadow-node-001',
          target_node_id: 'shadow-node-001',
          acknowledged: false,
        },
      ],
    });

    expect(snapshot.onlineNodes).toBe(4);
    expect(snapshot.busyNodes).toBe(2);
    expect(snapshot.pendingTasks).toBe(6);
    expect(snapshot.activeSchedules).toBe(2);
    expect(snapshot.criticalAlerts).toBe(2);
    expect(snapshot.unacknowledgedAlerts).toBe(1);
    expect(snapshot.ai).toEqual({
      modelCount: 5,
      aiCapableNodes: 2,
      onlineAINodes: 1,
    });
    expect(snapshot.network).toEqual({
      mihomoConfigured: true,
      mihomoReachable: false,
      dnsConfigured: true,
      dnsReachable: true,
      dnsProtectionEnabled: true,
      egressIP: '119.29.29.29',
      egressRegion: '中国 广东 深圳',
      egressISP: '腾讯云',
      egressSource: 'probe+qqwry',
    });
    expect(snapshot.homeAssistant).toEqual({
      configured: true,
      reachable: true,
      entityCount: 18,
    });
    expect(snapshot.primaryNode).toEqual({
      nodeID: 'shadow-node-001',
      hostname: 'shadow-host',
      status: 'online',
      ipAddress: '192.168.31.18',
    });
    expect(snapshot.recentSchedules).toHaveLength(3);
    expect(snapshot.recentTasks).toHaveLength(3);
    expect(snapshot.recentAlerts).toHaveLength(3);
    expect(snapshot.recentSchedules[0]).toMatchObject({
      id: 9,
      name: '晚间模型巡检',
      dailyAt: '23:30',
      enabled: true,
    });
    expect(snapshot.recentTasks[0]).toMatchObject({
      id: 9,
      preview: '家域中枢',
      status: 'succeeded',
    });
    expect(snapshot.recentTasks[1]).toMatchObject({
      id: 8,
      preview: 'echo waiting',
      status: 'pending',
    });
    expect(snapshot.recentAlerts[0]).toMatchObject({
      id: 'schedule:9:12',
      severity: 'critical',
      title: '晚间模型巡检',
      preview: '最近夜巡执行失败，请查看任务链路',
      acknowledged: false,
    });
  });
});

describe('buildRouteManagerHubQuickHighlights', () => {
  test('builds AI, network, dns, egress, and home-assistant highlights for embedded hub home', () => {
    const highlights = buildRouteManagerHubQuickHighlights(
      buildRouteManagerHubDashboardSnapshot({
        ai: {
          model_count: 6,
          online_ai_nodes: 2,
        },
        network: {
          dns_protection_enabled: true,
          mihomo_reachable: true,
          egress_region: '中国 广东 深圳',
          egress_source: 'probe+qqwry',
        },
        home_assistant: {
          reachable: true,
          entity_count: 18,
        },
        primary_node: {
          hostname: 'desktop-1',
        },
      }),
    );

    expect(highlights).toEqual([
      {
        key: 'ai',
        labelKey: '家庭算力编队',
        detail: 'desktop-1 · 6 模型 · 2 在线 AI 节点',
      },
      {
        key: 'network',
        labelKey: '网络代理状态',
        detail: '净网已开启 · 代理可达 · 中国 广东 深圳 · probe+qqwry',
      },
      {
        key: 'dns',
        labelKey: 'DNS 广告屏蔽',
        detail: '净网已开启',
      },
      {
        key: 'egress',
        labelKey: '出口网络画像',
        detail: '中国 广东 深圳 · probe+qqwry',
      },
      {
        key: 'ha',
        labelKey: '家庭实体桥接',
        detail: '桥接在线 · 18 实体',
      },
    ]);
  });

  test('translates highlight details when a translator is provided', () => {
    const highlights = buildRouteManagerHubQuickHighlights(
      buildRouteManagerHubDashboardSnapshot({
        ai: {
          model_count: 6,
          online_ai_nodes: 2,
        },
        network: {
          dns_protection_enabled: true,
          mihomo_reachable: true,
          egress_region: 'Shenzhen',
          egress_source: 'probe',
        },
        home_assistant: {
          reachable: true,
          entity_count: 18,
        },
        primary_node: {
          hostname: 'desktop-1',
        },
      }),
      (label, params = {}) => `translated:${label}:${JSON.stringify(params)}`,
    );

    expect(highlights).toEqual([
      {
        key: 'ai',
        labelKey: '家庭算力编队',
        detail:
          'desktop-1 · translated:6 模型:{"count":6} · translated:2 在线 AI 节点:{"count":2}',
      },
      {
        key: 'network',
        labelKey: '网络代理状态',
        detail:
          'translated:净网已开启:{} · translated:代理可达:{} · Shenzhen · probe',
      },
      {
        key: 'dns',
        labelKey: 'DNS 广告屏蔽',
        detail: 'translated:净网已开启:{}',
      },
      {
        key: 'egress',
        labelKey: '出口网络画像',
        detail: 'Shenzhen · probe',
      },
      {
        key: 'ha',
        labelKey: '家庭实体桥接',
        detail: 'translated:桥接在线:{} · translated:18 实体:{"count":18}',
      },
    ]);
  });

  test('falls back to egress ip and source when geo region is unavailable', () => {
    const highlights = buildRouteManagerHubQuickHighlights(
      buildRouteManagerHubDashboardSnapshot({
        network: {
          dns_configured: true,
          dns_protection_enabled: false,
          mihomo_configured: true,
          egress_ip: '119.29.29.29',
          egress_source: 'probe',
        },
      }),
    );

    expect(highlights).toEqual([
      {
        key: 'network',
        labelKey: '网络代理状态',
        detail: '净网待确认 · 代理待确认 · 119.29.29.29 · probe',
      },
      {
        key: 'dns',
        labelKey: 'DNS 广告屏蔽',
        detail: '净网待确认 · DNS 待确认',
      },
      {
        key: 'egress',
        labelKey: '出口网络画像',
        detail: '119.29.29.29 · probe',
      },
    ]);
  });
});

describe('route-manager hub enum formatting', () => {
  test('translates node status values with route-manager wording', () => {
    const t = (label) => `translated:${label}`;

    expect(formatRouteManagerHubNodeStatus('online', t)).toBe(
      'translated:在线',
    );
    expect(formatRouteManagerHubNodeStatus('stale', t)).toBe(
      'translated:待确认',
    );
    expect(formatRouteManagerHubNodeStatus('sleep', t)).toBe(
      'translated:休眠',
    );
    expect(formatRouteManagerHubNodeStatus('offline', t)).toBe(
      'translated:离线',
    );
    expect(formatRouteManagerHubNodeStatus('unexpected', t)).toBe(
      'translated:未知状态',
    );
  });

  test('translates task status values with route-manager wording', () => {
    const t = (label) => `translated:${label}`;

    expect(formatRouteManagerHubTaskStatus('pending', t)).toBe(
      'translated:待执行',
    );
    expect(formatRouteManagerHubTaskStatus('running', t)).toBe(
      'translated:进行中',
    );
    expect(formatRouteManagerHubTaskStatus('succeeded', t)).toBe(
      'translated:已完成',
    );
    expect(formatRouteManagerHubTaskStatus('failed', t)).toBe(
      'translated:失败',
    );
    expect(formatRouteManagerHubTaskStatus('', t)).toBe(
      'translated:未知状态',
    );
  });

  test('translates alert severity values with route-manager wording', () => {
    const t = (label) => `translated:${label}`;

    expect(formatRouteManagerHubAlertSeverity('critical', t)).toBe(
      'translated:严重',
    );
    expect(formatRouteManagerHubAlertSeverity('warning', t)).toBe(
      'translated:一般',
    );
    expect(formatRouteManagerHubAlertSeverity('notice', t)).toBe(
      'translated:未知状态',
    );
  });

  test('translates task type values with route-manager wording', () => {
    const t = (label) => `translated:${label}`;

    expect(formatRouteManagerHubTaskType('shell', t)).toBe(
      'translated:Shell 任务',
    );
    expect(formatRouteManagerHubTaskType('browser', t)).toBe(
      'translated:浏览器自动化',
    );
    expect(formatRouteManagerHubTaskType('wake', t)).toBe(
      'translated:唤醒任务',
    );
    expect(formatRouteManagerHubTaskType('custom', t)).toBe(
      'translated:未知类型',
    );
  });

  test('translates alert subtitle task types without rewriting other subtitles', () => {
    const t = (label) => `translated:${label}`;

    expect(formatRouteManagerHubAlertSubtitle('shell · shadow-node-001', t)).toBe(
      'translated:Shell 任务 · shadow-node-001',
    );
    expect(
      formatRouteManagerHubAlertSubtitle('browser · shadow-node-002', t),
    ).toBe('translated:浏览器自动化 · shadow-node-002');
    expect(formatRouteManagerHubAlertSubtitle('任务 #12 · 失败', t)).toBe(
      '任务 #12 · 失败',
    );
  });

  test('returns distinct tag colors for task statuses including running', () => {
    expect(getRouteManagerHubTaskStatusColor('pending')).toBe('blue');
    expect(getRouteManagerHubTaskStatusColor('running')).toBe('orange');
    expect(getRouteManagerHubTaskStatusColor('succeeded')).toBe('green');
    expect(getRouteManagerHubTaskStatusColor('failed')).toBe('red');
    expect(getRouteManagerHubTaskStatusColor('unknown')).toBe('grey');
  });

  test('prefers alert preview as the primary alert detail text', () => {
    expect(
      buildRouteManagerHubAlertDetail(
        {
          preview: 'ollama daemon unavailable',
          subtitle: 'shell · shadow-node-001',
          metaText: '任务 #2',
          targetNodeID: 'shadow-node-001',
        },
        (label) => `translated:${label}`,
      ),
    ).toBe('ollama daemon unavailable');
  });

  test('falls back to translated subtitle or metadata when alert preview is empty', () => {
    const t = (label) => `translated:${label}`;

    expect(
      buildRouteManagerHubAlertDetail(
        {
          subtitle: 'browser · shadow-node-001',
          metaText: '任务 #3',
          targetNodeID: 'shadow-node-001',
        },
        t,
      ),
    ).toBe('translated:浏览器自动化 · shadow-node-001');
    expect(
      buildRouteManagerHubAlertDetail(
        {
          subtitle: '',
          metaText: '任务 #3',
          targetNodeID: 'shadow-node-001',
        },
        t,
      ),
    ).toBe('任务 #3');
  });
});

describe('buildRouteManagerHubQuickPanelLinks', () => {
  test('builds AI, mihomo, dns, egress, and home-assistant quick panel links', () => {
    const snapshot = buildRouteManagerHubDashboardSnapshot({
      ai: {
        model_count: 6,
        online_ai_nodes: 2,
      },
      network: {
        dns_configured: true,
        dns_reachable: true,
        dns_protection_enabled: true,
        mihomo_configured: true,
        mihomo_reachable: true,
        egress_region: '中国 广东 深圳',
        egress_isp: '腾讯云',
        egress_source: 'probe+qqwry',
      },
      home_assistant: {
        configured: true,
        reachable: true,
        entity_count: 18,
      },
      primary_node: {
        hostname: 'desktop-1',
      },
    });

    const links = buildRouteManagerHubQuickPanelLinks(
      snapshot,
      (label) => `translated:${label}`,
    );

    expect(links).toEqual([
      {
        key: 'ai',
        label: 'translated:家庭算力编队',
        href: '/hub/?view=ai&panel=fleet',
        description: 'desktop-1 · translated:6 模型 · translated:2 在线 AI 节点',
      },
      {
        key: 'network_mihomo',
        label: 'translated:网络代理状态',
        href: '/hub/?view=network&panel=mihomo',
        description:
          'translated:净网已开启 · translated:代理可达 · 中国 广东 深圳 · probe+qqwry',
      },
      {
        key: 'network_dns',
        label: 'translated:DNS 广告屏蔽',
        href: '/hub/?view=network&panel=dns',
        description: 'translated:净网已开启 · translated:DNS 可达',
      },
      {
        key: 'network_egress',
        label: 'translated:出口网络画像',
        href: '/hub/?view=network&panel=egress',
        description: '中国 广东 深圳 · 腾讯云 · probe+qqwry',
      },
      {
        key: 'ha',
        label: 'translated:家庭实体桥接',
        href: '/hub/?view=ha&panel=entities',
        description: 'translated:桥接在线 · translated:18 实体',
      },
    ]);
  });

  test('falls back to dedicated panel copy when dns and egress summaries are unavailable', () => {
    const links = buildRouteManagerHubQuickPanelLinks(
      buildRouteManagerHubDashboardSnapshot(),
      (label) => `translated:${label}`,
    );

    expect(links).toEqual([
      {
        key: 'ai',
        label: 'translated:家庭算力编队',
        href: '/hub/?view=ai&panel=fleet',
        description: 'translated:直达 AI 中心的主算力编队面板',
      },
      {
        key: 'network_mihomo',
        label: 'translated:网络代理状态',
        href: '/hub/?view=network&panel=mihomo',
        description: 'translated:直达网络中心的 Mihomo 代理状态面板',
      },
      {
        key: 'network_dns',
        label: 'translated:DNS 广告屏蔽',
        href: '/hub/?view=network&panel=dns',
        description: 'translated:直达网络中心的 DNS 广告屏蔽面板',
      },
      {
        key: 'network_egress',
        label: 'translated:出口网络画像',
        href: '/hub/?view=network&panel=egress',
        description: 'translated:直达网络中心的出口网络画像面板',
      },
      {
        key: 'ha',
        label: 'translated:家庭实体桥接',
        href: '/hub/?view=ha&panel=entities',
        description: 'translated:直达家庭自动化的实体桥接面板',
      },
    ]);
  });
});

describe('buildRouteManagerHubFamilySummaryPills', () => {
  test('builds translated family summary pills', () => {
    const pills = buildRouteManagerHubFamilySummaryPills(
      buildRouteManagerHubDashboardSnapshot({
        network: {
          dns_protection_enabled: true,
        },
        home_assistant: {
          entity_count: 18,
        },
        primary_node: {
          hostname: 'desktop-1',
        },
      }),
      (label, params = {}) => `translated:${label}:${JSON.stringify(params)}`,
    );

    expect(pills).toEqual([
      'translated:主算力 desktop-1:{"name":"desktop-1"}',
      'translated:净网已开启:{}',
      'translated:家庭桥接 18 实体:{"count":18}',
    ]);
  });
});
