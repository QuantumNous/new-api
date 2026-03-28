/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Button, Card, Empty, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { Activity, RefreshCw, Waypoints } from 'lucide-react';
import {
  buildRouteManagerHubAlertDetail,
  buildRouteManagerHubQuickPanelLinks,
  buildRouteManagerHubDashboardSnapshot,
  buildRouteManagerHubFamilySummaryPills,
  formatRouteManagerHubAlertSeverity,
  getRouteManagerHubTaskStatusColor,
  getRouteManagerHubAlertHref,
  getRouteManagerHubAlertsHref,
  formatRouteManagerHubStatus,
  getRouteManagerHubHref,
  getRouteManagerHubNodeHref,
  getRouteManagerHubNodesHref,
  formatRouteManagerHubNodeStatus,
  getRouteManagerHubScheduleHref,
  getRouteManagerHubTaskHref,
  getRouteManagerHubTasksHref,
  formatRouteManagerHubTaskStatus,
  formatRouteManagerHubTaskType,
  shouldShowRouteManagerHubEntry,
} from '../../helpers';

const { Text } = Typography;

const TONE_TO_TAG_COLOR = {
  success: 'green',
  warning: 'orange',
  danger: 'red',
};

const NODE_STATUS_COLOR = {
  online: 'green',
  stale: 'orange',
  sleep: 'grey',
  offline: 'red',
};

const ALERT_SEVERITY_COLOR = {
  critical: 'red',
  warning: 'orange',
};

const RouteManagerHubPanel = ({
  hubStatus,
  hubNodes,
  hubSchedules,
  hubTasks,
  hubAlerts,
  hubSummary,
  hubLoading,
  hubError,
  loadHubData,
  CARD_PROPS,
  t,
}) => {
  const statusInfo = formatRouteManagerHubStatus(hubStatus, t);
  const snapshot = buildRouteManagerHubDashboardSnapshot({
    onlineNodes: hubSummary?.onlineNodes,
    busyNodes: hubSummary?.busyNodes,
    pendingTasks: hubSummary?.pendingTasks,
    activeSchedules: hubSummary?.activeSchedules,
    criticalAlerts: hubSummary?.criticalAlerts,
    unacknowledgedAlerts: hubSummary?.unacknowledgedAlerts,
    ai: hubSummary?.ai,
    network: hubSummary?.network,
    homeAssistant: hubSummary?.homeAssistant,
    primaryNode: hubSummary?.primaryNode,
    nodes: hubNodes,
    schedules: hubSchedules,
    tasks: hubTasks,
    alerts: hubAlerts,
  });
  const canOpenHub = shouldShowRouteManagerHubEntry(hubStatus);
  const routeManagerHubHref = getRouteManagerHubHref();
  const routeManagerHubNodesHref = getRouteManagerHubNodesHref();
  const routeManagerHubTasksHref = getRouteManagerHubTasksHref();
  const routeManagerHubAlertsHref = getRouteManagerHubAlertsHref();
  const quickPanelLinks = buildRouteManagerHubQuickPanelLinks(snapshot, t);

  const metrics = [
    { label: t('在线节点'), value: snapshot.onlineNodes },
    { label: t('活动节点'), value: snapshot.busyNodes },
    { label: t('待处理任务'), value: snapshot.pendingTasks },
  ];
  const familySummaryPills = buildRouteManagerHubFamilySummaryPills(snapshot, t);

  return (
    <Card
      {...CARD_PROPS}
      className='shadow-sm !rounded-2xl'
      title={
        <div className='flex items-center justify-between w-full gap-2'>
          <div className='flex items-center gap-2'>
            <Waypoints size={16} />
            {t('家域中枢值守')}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={loadHubData}
              loading={hubLoading}
              size='small'
              theme='borderless'
              type='tertiary'
              className='text-gray-500 hover:text-blue-500 hover:bg-blue-50 !rounded-full'
            />
            {canOpenHub ? (
              <Button
                size='small'
                theme='solid'
                type='primary'
                onClick={() => window.location.assign(routeManagerHubHref)}
                className='!rounded-full'
              >
                {t('打开家域中枢')}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <Spin spinning={hubLoading}>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-center gap-2'>
              <Tag color={TONE_TO_TAG_COLOR[statusInfo.tone] || 'grey'}>
                {statusInfo.tone === 'success'
                  ? t('已连接')
                  : statusInfo.tone === 'warning'
                    ? t('待配置')
                    : t('异常')}
              </Tag>
              <Text type='secondary'>{hubError || statusInfo.message}</Text>
            </div>
            <div className='flex items-center gap-2 text-xs text-gray-500'>
              <Activity size={14} />
              <span>{t('主站内可直接查看家庭控制系统最近运行情况')}</span>
            </div>
          </div>

          {familySummaryPills.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {familySummaryPills.map((item) => (
                <Tag key={item} color='light-blue' size='large'>
                  {item}
                </Tag>
              ))}
            </div>
          ) : null}

          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className='rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3'
              >
                <div className='text-xs text-gray-500'>{metric.label}</div>
                <div className='mt-2 text-2xl font-semibold text-gray-900'>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div className='rounded-2xl border border-gray-100 bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <Text strong>{t('关键面板')}</Text>
              <Text type='tertiary'>{t('主站内快速切换家庭控制能力区')}</Text>
            </div>

            <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5'>
              {quickPanelLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className='rounded-xl border border-gray-100 px-4 py-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50'
                >
                  <div className='text-sm font-medium text-gray-900'>
                    {item.label}
                  </div>
                  <div className='mt-2 text-xs leading-5 text-gray-500'>
                    {item.description}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className='rounded-2xl border border-gray-100 bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <Text strong>{t('关键节点')}</Text>
              <a
                href={routeManagerHubNodesHref}
                className='text-xs font-medium text-blue-600 hover:text-blue-700'
              >
                {t('查看节点中心')}
              </a>
            </div>

            {hubNodes.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {hubNodes.slice(0, 3).map((node) => (
                  <a
                    key={node.node_id}
                    href={getRouteManagerHubNodeHref(node.node_id)}
                    className='flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-3 md:flex-row md:items-center md:justify-between'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium text-gray-900'>
                        {node.hostname || node.node_id}
                      </div>
                      <div className='mt-1 text-xs text-gray-500'>
                        {node.node_id || '-'}
                      </div>
                    </div>
                    <Tag color={NODE_STATUS_COLOR[node.status] || 'grey'}>
                      {formatRouteManagerHubNodeStatus(node.status, t)}
                    </Tag>
                  </a>
                ))}
              </div>
            ) : (
              <Empty
                title={t('暂无节点摘要')}
                description={t(
                  '中枢连接正常后，这里会显示最近在线节点和节点入口',
                )}
                image={null}
              />
            )}
          </div>

          <div className='rounded-2xl border border-gray-100 bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <Text strong>{t('关键告警')}</Text>
              <div className='flex items-center gap-3'>
                <Text type='tertiary'>
                  {t('严重')} {snapshot.criticalAlerts} · {t('未确认')}{' '}
                  {snapshot.unacknowledgedAlerts}
                </Text>
                <a
                  href={routeManagerHubAlertsHref}
                  className='text-xs font-medium text-blue-600 hover:text-blue-700'
                >
                  {t('查看告警中心')}
                </a>
              </div>
            </div>

            {snapshot.recentAlerts.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {snapshot.recentAlerts.map((alert) => (
                  <a
                    key={alert.id}
                    href={getRouteManagerHubAlertHref(alert.id)}
                    className='flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-3 md:flex-row md:items-center md:justify-between'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium text-gray-900'>
                        {alert.title || t('未命名告警')}
                      </div>
                      <div className='mt-1 text-xs text-gray-500'>
                        {buildRouteManagerHubAlertDetail(alert, t)}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {!alert.acknowledged ? (
                        <Tag color='red'>{t('待处理')}</Tag>
                      ) : null}
                      <Tag color={ALERT_SEVERITY_COLOR[alert.severity] || 'grey'}>
                        {formatRouteManagerHubAlertSeverity(alert.severity, t)}
                      </Tag>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <Empty
                title={t('暂无中枢告警')}
                description={t(
                  '中枢连接正常后，这里会显示最近告警和失败原因入口',
                )}
                image={null}
              />
            )}
          </div>

          <div className='rounded-2xl border border-gray-100 bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <Text strong>{t('关键计划')}</Text>
              <div className='flex items-center gap-3'>
                <Text type='tertiary'>
                  {t('激活')} {snapshot.activeSchedules}
                </Text>
                <a
                  href={routeManagerHubTasksHref}
                  className='text-xs font-medium text-blue-600 hover:text-blue-700'
                >
                  {t('查看任务中心')}
                </a>
              </div>
            </div>

            {snapshot.recentSchedules.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {snapshot.recentSchedules.map((schedule) => (
                  <a
                    key={schedule.id}
                    href={getRouteManagerHubScheduleHref(schedule.id)}
                    className='flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-3 md:flex-row md:items-center md:justify-between'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium text-gray-900'>
                        {schedule.name || t('未命名计划')}
                      </div>
                      <div className='mt-1 text-xs text-gray-500'>
                        {schedule.targetNodeID || '-'} · {schedule.dailyAt || '--:--'}
                      </div>
                    </div>
                    <Tag color={schedule.enabled ? 'green' : 'grey'}>
                      {schedule.enabled ? t('已启用') : t('已暂停')}
                    </Tag>
                  </a>
                ))}
              </div>
            ) : (
              <Empty
                title={t('暂无中枢计划')}
                description={t(
                  '中枢连接正常后，这里会显示最近计划和定时执行入口',
                )}
                image={null}
              />
            )}
          </div>

          <div className='rounded-2xl border border-gray-100 bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <Text strong>{t('最近任务')}</Text>
              <Text type='tertiary'>{t('展示最近 3 条调度/执行结果')}</Text>
            </div>

            {snapshot.recentTasks.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {snapshot.recentTasks.map((task) => (
                  <a
                    key={task.id}
                    href={getRouteManagerHubTaskHref(task.id)}
                    className='flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-3 md:flex-row md:items-center md:justify-between'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium text-gray-900'>
                        {task.preview || t('暂无任务预览')}
                      </div>
                      <div className='mt-1 text-xs text-gray-500'>
                        {formatRouteManagerHubTaskType(task.type, t)} ·{' '}
                        {task.targetNodeID || '-'}
                      </div>
                    </div>
                    <Tag color={getRouteManagerHubTaskStatusColor(task.status)}>
                      {formatRouteManagerHubTaskStatus(task.status, t)}
                    </Tag>
                  </a>
                ))}
              </div>
            ) : (
              <Empty
                title={t('暂无中枢任务')}
                description={t('中枢连接正常后，这里会显示最近任务和节点活动')}
                image={null}
              />
            )}
          </div>
        </div>
      </Spin>
    </Card>
  );
};

export default RouteManagerHubPanel;
