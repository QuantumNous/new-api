import {
  getRouteManagerHubAIFleetHref,
  getRouteManagerHubDNSSecurityHref,
  getRouteManagerHubEgressHref,
  getRouteManagerHubHomeAssistantEntitiesHref,
  getRouteManagerHubNetworkPanelHref,
} from './hubNavigation.js';

function interpolateTemplate(message, params = {}) {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    message,
  );
}

function translateHubText(t, key, params = {}) {
  if (typeof t !== 'function') {
    return interpolateTemplate(key, params);
  }

  return interpolateTemplate(t(key, params), params);
}

const ROUTE_MANAGER_HUB_NODE_STATUS_LABELS = {
  online: '在线',
  stale: '待确认',
  sleep: '休眠',
  offline: '离线',
};

const ROUTE_MANAGER_HUB_TASK_STATUS_LABELS = {
  pending: '待执行',
  running: '进行中',
  succeeded: '已完成',
  failed: '失败',
};

const ROUTE_MANAGER_HUB_TASK_STATUS_COLORS = {
  pending: 'blue',
  running: 'orange',
  succeeded: 'green',
  failed: 'red',
};

const ROUTE_MANAGER_HUB_TASK_TYPE_LABELS = {
  wake: '唤醒任务',
  shell: 'Shell 任务',
  docker: 'Docker 任务',
  browser: '浏览器自动化',
  ai_inference: '本地推理',
  network_policy: '网络策略',
  home_assistant_action: '家庭动作',
};

const ROUTE_MANAGER_HUB_ALERT_SEVERITY_LABELS = {
  critical: '严重',
  warning: '一般',
};

function formatRouteManagerHubEnumLabel(
  value,
  labels,
  t = (label) => label,
  fallbackKey = '未知状态',
) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const labelKey = labels[normalizedValue] || fallbackKey;

  return translateHubText(t, labelKey);
}

function safeParseTaskOutput(rawOutput) {
  if (typeof rawOutput !== 'string' || rawOutput.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(rawOutput);
  } catch {
    return null;
  }
}

export function formatRouteManagerHubNodeStatus(
  status,
  t = (label) => label,
) {
  return formatRouteManagerHubEnumLabel(
    status,
    ROUTE_MANAGER_HUB_NODE_STATUS_LABELS,
    t,
  );
}

export function formatRouteManagerHubTaskStatus(
  status,
  t = (label) => label,
) {
  return formatRouteManagerHubEnumLabel(
    status,
    ROUTE_MANAGER_HUB_TASK_STATUS_LABELS,
    t,
  );
}

export function getRouteManagerHubTaskStatusColor(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  return ROUTE_MANAGER_HUB_TASK_STATUS_COLORS[normalizedStatus] || 'grey';
}

export function formatRouteManagerHubTaskType(type, t = (label) => label) {
  return formatRouteManagerHubEnumLabel(
    type,
    ROUTE_MANAGER_HUB_TASK_TYPE_LABELS,
    t,
    '未知类型',
  );
}

export function formatRouteManagerHubAlertSeverity(
  severity,
  t = (label) => label,
) {
  return formatRouteManagerHubEnumLabel(
    severity,
    ROUTE_MANAGER_HUB_ALERT_SEVERITY_LABELS,
    t,
  );
}

export function formatRouteManagerHubAlertSubtitle(
  subtitle,
  t = (label) => label,
) {
  const normalizedSubtitle = String(subtitle || '').trim();

  if (!normalizedSubtitle) {
    return '';
  }

  const [leadingPart, ...remainingParts] = normalizedSubtitle.split(' · ');
  const normalizedLeadingPart = String(leadingPart || '').trim().toLowerCase();

  if (
    remainingParts.length === 0 ||
    !Object.prototype.hasOwnProperty.call(
      ROUTE_MANAGER_HUB_TASK_TYPE_LABELS,
      normalizedLeadingPart,
    )
  ) {
    return normalizedSubtitle;
  }

  return [
    formatRouteManagerHubTaskType(normalizedLeadingPart, t),
    ...remainingParts,
  ].join(' · ');
}

export function buildRouteManagerHubAlertDetail(
  alert = {},
  t = (label) => label,
) {
  const preview = String(alert?.preview || '').trim();
  if (preview) {
    return preview;
  }

  const subtitle = formatRouteManagerHubAlertSubtitle(alert?.subtitle, t);
  if (subtitle) {
    return subtitle;
  }

  const metaText = String(alert?.metaText || alert?.meta_text || '').trim();
  if (metaText) {
    return metaText;
  }

  const targetNodeID = String(
    alert?.targetNodeID || alert?.target_node_id || '',
  ).trim();
  if (targetNodeID) {
    return targetNodeID;
  }

  return '-';
}

export function extractRouteManagerTaskPreview(task) {
  const directPreview = task?.preview?.trim();
  if (directPreview) {
    return directPreview;
  }

  const executeStep = Array.isArray(task?.steps)
    ? task.steps.find((step) => step?.type === 'execute')
    : null;
  const parsedOutput = safeParseTaskOutput(executeStep?.output);

  const stdoutPreview = parsedOutput?.stdout?.trim();
  if (stdoutPreview) {
    return stdoutPreview;
  }

  const stderrPreview = parsedOutput?.stderr?.trim();
  if (stderrPreview) {
    return stderrPreview;
  }

  const pageTitlePreview = parsedOutput?.page_title?.trim();
  if (pageTitlePreview) {
    return pageTitlePreview;
  }

  const pageURLPreview = parsedOutput?.page_url?.trim();
  if (pageURLPreview) {
    return pageURLPreview;
  }

  return task?.command?.trim() || '';
}

export function buildRouteManagerHubDashboardSnapshot({
  onlineNodes,
  online_nodes,
  busyNodes,
  busy_nodes,
  pendingTasks,
  pending_tasks,
  activeSchedules,
  active_schedules,
  criticalAlerts,
  critical_alerts,
  unacknowledgedAlerts,
  unacknowledged_alerts,
  ai = {},
  network = {},
  homeAssistant = {},
  home_assistant = {},
  primaryNode = {},
  primary_node = {},
  nodes = [],
  schedules = [],
  tasks = [],
  alerts = [],
} = {}) {
  const normalizedHomeAssistant =
    homeAssistant && Object.keys(homeAssistant).length > 0
      ? homeAssistant
      : home_assistant;
  const normalizedPrimaryNode =
    primaryNode && Object.keys(primaryNode).length > 0
      ? primaryNode
      : primary_node;

  const computedOnlineNodes = nodes.filter(
    (node) => node?.status === 'online',
  ).length;
  const computedBusyNodes = nodes.filter((node) => {
    const browserRuntime = node?.browser_runtime;
    return (
      (browserRuntime?.active_tasks || 0) > 0 ||
      (browserRuntime?.pending_tasks || 0) > 0
    );
  }).length;
  const computedPendingTasks = tasks.filter(
    (task) => task?.status === 'pending',
  ).length;
  const computedActiveSchedules = schedules.filter(
    (schedule) => schedule?.enabled,
  ).length;
  const computedCriticalAlerts = alerts.filter(
    (alert) => alert?.severity === 'critical',
  ).length;
  const computedUnacknowledgedAlerts = alerts.filter(
    (alert) => !alert?.acknowledged,
  ).length;

  const recentTasks = tasks.slice(0, 3).map((task) => ({
    id: task?.id,
    type: task?.type || '',
    status: task?.status || 'unknown',
    targetNodeID: task?.target_node_id || '',
    preview: extractRouteManagerTaskPreview(task),
  }));
  const recentSchedules = schedules.slice(0, 3).map((schedule) => ({
    id: schedule?.id,
    name: schedule?.name || '',
    type: schedule?.type || '',
    targetNodeID: schedule?.target_node_id || '',
    dailyAt: schedule?.daily_at || '',
    enabled: Boolean(schedule?.enabled),
    nextRunAt: schedule?.next_run_at || '',
  }));
  const recentAlerts = alerts.slice(0, 3).map((alert) => ({
    id: alert?.id || '',
    kind: alert?.kind || '',
    severity: alert?.severity || 'unknown',
    title: alert?.title || '',
    subtitle: alert?.subtitle || '',
    preview: alert?.preview || '',
    metaText: alert?.metaText || alert?.meta_text || '',
    targetNodeID: alert?.targetNodeID || alert?.target_node_id || '',
    acknowledged: Boolean(alert?.acknowledged),
  }));

  return {
    onlineNodes:
      typeof onlineNodes === 'number'
        ? onlineNodes
        : typeof online_nodes === 'number'
          ? online_nodes
          : computedOnlineNodes,
    busyNodes:
      typeof busyNodes === 'number'
        ? busyNodes
        : typeof busy_nodes === 'number'
          ? busy_nodes
          : computedBusyNodes,
    pendingTasks:
      typeof pendingTasks === 'number'
        ? pendingTasks
        : typeof pending_tasks === 'number'
          ? pending_tasks
          : computedPendingTasks,
    activeSchedules:
      typeof activeSchedules === 'number'
        ? activeSchedules
        : typeof active_schedules === 'number'
          ? active_schedules
          : computedActiveSchedules,
    criticalAlerts:
      typeof criticalAlerts === 'number'
        ? criticalAlerts
        : typeof critical_alerts === 'number'
          ? critical_alerts
          : computedCriticalAlerts,
    unacknowledgedAlerts:
      typeof unacknowledgedAlerts === 'number'
        ? unacknowledgedAlerts
        : typeof unacknowledged_alerts === 'number'
          ? unacknowledged_alerts
          : computedUnacknowledgedAlerts,
    ai: {
      modelCount: Number(ai?.modelCount || ai?.model_count || 0),
      aiCapableNodes: Number(ai?.aiCapableNodes || ai?.ai_capable_nodes || 0),
      onlineAINodes: Number(ai?.onlineAINodes || ai?.online_ai_nodes || 0),
    },
    network: {
      mihomoConfigured: Boolean(
        network?.mihomoConfigured ?? network?.mihomo_configured,
      ),
      mihomoReachable: Boolean(
        network?.mihomoReachable ?? network?.mihomo_reachable,
      ),
      dnsConfigured: Boolean(
        network?.dnsConfigured ?? network?.dns_configured,
      ),
      dnsReachable: Boolean(network?.dnsReachable ?? network?.dns_reachable),
      dnsProtectionEnabled: Boolean(
        network?.dnsProtectionEnabled ?? network?.dns_protection_enabled,
      ),
      egressIP: network?.egressIP || network?.egress_ip || '',
      egressRegion: network?.egressRegion || network?.egress_region || '',
      egressISP: network?.egressISP || network?.egress_isp || '',
      egressSource: network?.egressSource || network?.egress_source || '',
    },
    homeAssistant: {
      configured: Boolean(
        normalizedHomeAssistant?.configured ??
          normalizedHomeAssistant?.Configured,
      ),
      reachable: Boolean(
        normalizedHomeAssistant?.reachable ??
          normalizedHomeAssistant?.Reachable,
      ),
      entityCount: Number(
        normalizedHomeAssistant?.entityCount ||
          normalizedHomeAssistant?.entity_count ||
          0,
      ),
    },
    primaryNode: {
      nodeID: normalizedPrimaryNode?.nodeID || normalizedPrimaryNode?.node_id || '',
      hostname: normalizedPrimaryNode?.hostname || '',
      status: normalizedPrimaryNode?.status || '',
      ipAddress:
        normalizedPrimaryNode?.ipAddress || normalizedPrimaryNode?.ip_address || '',
    },
    recentSchedules,
    recentTasks,
    recentAlerts,
  };
}

function buildRouteManagerHubAIQuickDetail(
  snapshot = {},
  t = (label) => label,
) {
  const primaryNodeName =
    snapshot?.primaryNode?.hostname || snapshot?.primaryNode?.nodeID || '';
  const modelCount = Number(snapshot?.ai?.modelCount || 0);
  const onlineAINodes = Number(snapshot?.ai?.onlineAINodes || 0);
  const aiParts = [];

  if (primaryNodeName) {
    aiParts.push(primaryNodeName);
  }
  if (modelCount > 0) {
    aiParts.push(translateHubText(t, '{{count}} 模型', { count: modelCount }));
  }
  if (onlineAINodes > 0) {
    aiParts.push(
      translateHubText(t, '{{count}} 在线 AI 节点', {
        count: onlineAINodes,
      }),
    );
  }

  return aiParts.join(' · ');
}

function buildRouteManagerHubNetworkQuickDetail(
  snapshot = {},
  t = (label) => label,
) {
  const networkParts = [];

  if (snapshot?.network?.dnsProtectionEnabled) {
    networkParts.push(translateHubText(t, '净网已开启'));
  } else if (snapshot?.network?.dnsConfigured) {
    networkParts.push(translateHubText(t, '净网待确认'));
  }

  if (snapshot?.network?.mihomoReachable) {
    networkParts.push(translateHubText(t, '代理可达'));
  } else if (snapshot?.network?.mihomoConfigured) {
    networkParts.push(translateHubText(t, '代理待确认'));
  }

  if (snapshot?.network?.egressRegion) {
    networkParts.push(snapshot.network.egressRegion);
  } else if (snapshot?.network?.egressIP) {
    networkParts.push(snapshot.network.egressIP);
  }

  if (snapshot?.network?.egressSource) {
    networkParts.push(snapshot.network.egressSource);
  }

  return networkParts.join(' · ');
}

function buildRouteManagerHubDNSQuickDetail(
  snapshot = {},
  t = (label) => label,
) {
  const networkParts = [];

  if (snapshot?.network?.dnsProtectionEnabled) {
    networkParts.push(translateHubText(t, '净网已开启'));
  } else if (snapshot?.network?.dnsConfigured) {
    networkParts.push(translateHubText(t, '净网待确认'));
  }

  if (snapshot?.network?.dnsReachable) {
    networkParts.push(translateHubText(t, 'DNS 可达'));
  } else if (snapshot?.network?.dnsConfigured) {
    networkParts.push(translateHubText(t, 'DNS 待确认'));
  }

  return networkParts.join(' · ');
}

function buildRouteManagerHubEgressQuickDetail(snapshot = {}) {
  const egressParts = [];

  if (snapshot?.network?.egressRegion) {
    egressParts.push(snapshot.network.egressRegion);
  } else if (snapshot?.network?.egressIP) {
    egressParts.push(snapshot.network.egressIP);
  }

  if (snapshot?.network?.egressISP) {
    egressParts.push(snapshot.network.egressISP);
  }

  if (snapshot?.network?.egressSource) {
    egressParts.push(snapshot.network.egressSource);
  }

  return egressParts.join(' · ');
}

function buildRouteManagerHubHomeAssistantQuickDetail(
  snapshot = {},
  t = (label) => label,
) {
  const haEntityCount = Number(snapshot?.homeAssistant?.entityCount || 0);

  if (!snapshot?.homeAssistant?.reachable && haEntityCount <= 0) {
    return '';
  }

  return [
    translateHubText(
      t,
      snapshot?.homeAssistant?.reachable ? '桥接在线' : '桥接待确认',
    ),
    translateHubText(t, '{{count}} 实体', { count: haEntityCount }),
  ].join(' · ');
}

export function buildRouteManagerHubQuickHighlights(
  snapshot = {},
  t = (label) => label,
) {
  const highlights = [];
  const aiDetail = buildRouteManagerHubAIQuickDetail(snapshot, t);
  const networkDetail = buildRouteManagerHubNetworkQuickDetail(snapshot, t);
  const dnsDetail = buildRouteManagerHubDNSQuickDetail(snapshot, t);
  const egressDetail = buildRouteManagerHubEgressQuickDetail(snapshot);
  const haDetail = buildRouteManagerHubHomeAssistantQuickDetail(snapshot, t);

  if (aiDetail) {
    highlights.push({
      key: 'ai',
      labelKey: '家庭算力编队',
      detail: aiDetail,
    });
  }

  if (networkDetail) {
    highlights.push({
      key: 'network',
      labelKey: '网络代理状态',
      detail: networkDetail,
    });
  }

  if (dnsDetail) {
    highlights.push({
      key: 'dns',
      labelKey: 'DNS 广告屏蔽',
      detail: dnsDetail,
    });
  }

  if (egressDetail) {
    highlights.push({
      key: 'egress',
      labelKey: '出口网络画像',
      detail: egressDetail,
    });
  }

  if (haDetail) {
    highlights.push({
      key: 'ha',
      labelKey: '家庭实体桥接',
      detail: haDetail,
    });
  }

  return highlights;
}

export function buildRouteManagerHubQuickPanelLinks(
  snapshot = {},
  t = (label) => label,
) {
  const translate = typeof t === 'function' ? t : (label) => label;
  const aiDetail = buildRouteManagerHubAIQuickDetail(snapshot, translate);
  const networkDetail = buildRouteManagerHubNetworkQuickDetail(
    snapshot,
    translate,
  );
  const dnsDetail = buildRouteManagerHubDNSQuickDetail(snapshot, translate);
  const egressDetail = buildRouteManagerHubEgressQuickDetail(snapshot);
  const haDetail = buildRouteManagerHubHomeAssistantQuickDetail(
    snapshot,
    translate,
  );

  return [
    {
      key: 'ai',
      label: translate('家庭算力编队'),
      href: getRouteManagerHubAIFleetHref(),
      description: aiDetail || translate('直达 AI 中心的主算力编队面板'),
    },
    {
      key: 'network_mihomo',
      label: translate('网络代理状态'),
      href: getRouteManagerHubNetworkPanelHref('mihomo'),
      description:
        networkDetail || translate('直达网络中心的 Mihomo 代理状态面板'),
    },
    {
      key: 'network_dns',
      label: translate('DNS 广告屏蔽'),
      href: getRouteManagerHubDNSSecurityHref(),
      description:
        dnsDetail || translate('直达网络中心的 DNS 广告屏蔽面板'),
    },
    {
      key: 'network_egress',
      label: translate('出口网络画像'),
      href: getRouteManagerHubEgressHref(),
      description:
        egressDetail || translate('直达网络中心的出口网络画像面板'),
    },
    {
      key: 'ha',
      label: translate('家庭实体桥接'),
      href: getRouteManagerHubHomeAssistantEntitiesHref(),
      description: haDetail || translate('直达家庭自动化的实体桥接面板'),
    },
  ];
}

export function buildRouteManagerHubFamilySummaryPills(
  snapshot = {},
  t = (label) => label,
) {
  return [
    snapshot?.primaryNode?.hostname || snapshot?.primaryNode?.nodeID
      ? translateHubText(t, '主算力 {{name}}', {
          name: snapshot.primaryNode.hostname || snapshot.primaryNode.nodeID,
        })
      : '',
    snapshot?.network?.dnsProtectionEnabled
      ? translateHubText(t, '净网已开启')
      : snapshot?.network?.dnsConfigured
        ? translateHubText(t, '净网待确认')
        : '',
    snapshot?.homeAssistant?.entityCount > 0
      ? translateHubText(t, '家庭桥接 {{count}} 实体', {
          count: snapshot.homeAssistant.entityCount,
        })
      : '',
  ].filter(Boolean);
}
