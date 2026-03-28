export function shouldShowRouteManagerHubEntry(status) {
  return Boolean(status?.configured);
}

export function getRouteManagerHubHref() {
  return '/hub/';
}

export function getRouteManagerHubSidebarItems(t = (label) => label) {
  const translate = typeof t === 'function' ? t : (label) => label;

  return [
    {
      itemKey: 'hub_overview',
      text: translate('家域中枢总览'),
      to: getRouteManagerHubHref(),
    },
    {
      itemKey: 'hub_nodes',
      text: translate('节点中心'),
      to: getRouteManagerHubNodesHref(),
    },
    {
      itemKey: 'hub_tasks',
      text: translate('任务中心'),
      to: getRouteManagerHubTasksHref(),
    },
    {
      itemKey: 'hub_alerts',
      text: translate('告警中心'),
      to: getRouteManagerHubAlertsHref(),
    },
    {
      itemKey: 'hub_ai_fleet',
      text: translate('家庭算力编队'),
      to: getRouteManagerHubAIFleetHref(),
    },
    {
      itemKey: 'hub_network_mihomo',
      text: translate('网络代理状态'),
      to: getRouteManagerHubNetworkPanelHref('mihomo'),
    },
    {
      itemKey: 'hub_network_dns',
      text: translate('DNS 广告屏蔽'),
      to: getRouteManagerHubDNSSecurityHref(),
    },
    {
      itemKey: 'hub_network_egress',
      text: translate('出口网络画像'),
      to: getRouteManagerHubEgressHref(),
    },
    {
      itemKey: 'hub_ha_entities',
      text: translate('家庭实体桥接'),
      to: getRouteManagerHubHomeAssistantEntitiesHref(),
    },
  ];
}

export function getRouteManagerHubNodesHref() {
  return '/hub/?view=nodes';
}

export function getRouteManagerHubAlertsHref() {
  return '/hub/?view=alerts';
}

export function getRouteManagerHubTasksHref() {
  return '/hub/?view=tasks';
}

export function getRouteManagerHubAIFleetHref() {
  return '/hub/?view=ai&panel=fleet';
}

export function getRouteManagerHubNetworkPanelHref(panel = 'mihomo') {
  const normalizedPanel = typeof panel === 'string' ? panel.trim() : '';
  return normalizedPanel
    ? `/hub/?view=network&panel=${encodeURIComponent(normalizedPanel)}`
    : '/hub/?view=network';
}

export function getRouteManagerHubDNSSecurityHref() {
  return getRouteManagerHubNetworkPanelHref('dns');
}

export function getRouteManagerHubEgressHref() {
  return getRouteManagerHubNetworkPanelHref('egress');
}

export function getRouteManagerHubHomeAssistantEntitiesHref() {
  return '/hub/?view=ha&panel=entities';
}

export function getRouteManagerHubTaskHref(taskID) {
  const normalizedTaskID = Number(taskID) || 0;
  if (normalizedTaskID <= 0) {
    return getRouteManagerHubHref();
  }

  return `/hub/?view=tasks&task_id=${normalizedTaskID}`;
}

export function getRouteManagerHubNodeHref(nodeID) {
  const normalizedNodeID = typeof nodeID === 'string' ? nodeID.trim() : '';
  if (!normalizedNodeID) {
    return getRouteManagerHubNodesHref();
  }

  return `/hub/?view=nodes&node_id=${encodeURIComponent(normalizedNodeID)}`;
}

export function getRouteManagerHubAlertHref(alertID) {
  const normalizedAlertID = typeof alertID === 'string' ? alertID.trim() : '';
  if (!normalizedAlertID) {
    return getRouteManagerHubAlertsHref();
  }

  return `/hub/?view=alerts&alert_id=${encodeURIComponent(normalizedAlertID)}`;
}

export function getRouteManagerHubScheduleHref(scheduleID) {
  const normalizedScheduleID = Number(scheduleID) || 0;
  if (normalizedScheduleID <= 0) {
    return getRouteManagerHubTasksHref();
  }

  return `/hub/?view=tasks&schedule_id=${normalizedScheduleID}`;
}
