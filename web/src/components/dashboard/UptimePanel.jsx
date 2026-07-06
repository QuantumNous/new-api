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
import {
  Card,
  Button,
  Spin,
  Tabs,
  TabPane,
  Tag,
  Empty,
} from '@douyinfe/semi-ui';
import { Gauge, RefreshCw } from 'lucide-react';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const UptimePanel = ({
  uptimeData,
  uptimeLoading,
  activeUptimeTab,
  setActiveUptimeTab,
  loadUptimeData,
  uptimeLegendData,
  renderMonitorList,
  CARD_PROPS,
  t,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className='console-dashboard-card console-uptime-card shadow-sm !rounded-2xl lg:col-span-3'
      title={
        <div className='flex items-center justify-between w-full gap-2'>
          <div className='console-panel-title flex items-center gap-2'>
            <Gauge size={16} />
            {t('服务可用性')}
          </div>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={loadUptimeData}
            loading={uptimeLoading}
            size='small'
            theme='borderless'
            type='tertiary'
            className='console-uptime-refresh !rounded-full'
          />
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      {/* 内容区域 */}
      <div className='relative'>
        <Spin spinning={uptimeLoading}>
          {uptimeData.length > 0 ? (
            uptimeData.length === 1 ? (
              <ScrollableContainer maxHeight='24rem'>
                {renderMonitorList(uptimeData[0].monitors)}
              </ScrollableContainer>
            ) : (
              <Tabs
                type='card'
                collapsible
                activeKey={activeUptimeTab}
                onChange={setActiveUptimeTab}
                size='small'
              >
                {uptimeData.map((group, groupIdx) => (
                  <TabPane
                    tab={
                      <span className='flex items-center gap-2'>
                        <Gauge size={14} />
                        {group.categoryName}
                        <Tag
                          color={
                            activeUptimeTab === group.categoryName
                              ? 'red'
                              : 'grey'
                          }
                          size='small'
                          shape='circle'
                        >
                          {group.monitors ? group.monitors.length : 0}
                        </Tag>
                      </span>
                    }
                    itemKey={group.categoryName}
                    key={groupIdx}
                  >
                    <ScrollableContainer maxHeight='21.5rem'>
                      {renderMonitorList(group.monitors)}
                    </ScrollableContainer>
                  </TabPane>
                ))}
              </Tabs>
            )
          ) : (
            <div className='console-empty-state py-8'>
              <Empty
                image={null}
                imageStyle={{ display: 'none' }}
                title={t('暂无监控数据')}
                description={t('请联系管理员在系统设置中配置Uptime')}
              />
            </div>
          )}
        </Spin>
      </div>

      {/* 图例 */}
      {uptimeData.length > 0 && (
        <div className='console-uptime-legend'>
          <div className='console-uptime-legend-list'>
            {uptimeLegendData.map((legend, index) => (
              <div key={index} className='console-uptime-legend-item'>
                <div
                  className='console-uptime-legend-dot'
                  style={{ backgroundColor: legend.color }}
                />
                <span className='console-panel-muted'>{legend.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default UptimePanel;
