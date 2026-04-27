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
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
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
  ILLUSTRATION_SIZE,
  t,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className='dashboard-uptime-panel !rounded-[2rem] lg:col-span-1'
      title={
        <div className='dashboard-panel-header dashboard-uptime-header'>
          <div>
            <div className='dashboard-panel-eyebrow'>{t('监控')}</div>
            <div className='dashboard-panel-title-row'>
              <Gauge size={16} />
              {t('服务可用性')}
            </div>
          </div>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={loadUptimeData}
            loading={uptimeLoading}
            size='small'
            theme='borderless'
            type='tertiary'
            className='dashboard-uptime-refresh'
          />
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='dashboard-uptime-body'>
        <Spin spinning={uptimeLoading}>
          {uptimeData.length > 0 ? (
            uptimeData.length === 1 ? (
              <ScrollableContainer
                maxHeight='24rem'
                className='dashboard-panel-scroll-wrap'
                contentClassName='dashboard-panel-scroll'
                fadeIndicatorClassName='dashboard-panel-fade'
              >
                {renderMonitorList(uptimeData[0].monitors)}
              </ScrollableContainer>
            ) : (
              <Tabs
                type='card'
                collapsible
                className='dashboard-uptime-tabs'
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
                          className='dashboard-uptime-count'
                        >
                          {group.monitors ? group.monitors.length : 0}
                        </Tag>
                      </span>
                    }
                    itemKey={group.categoryName}
                    key={groupIdx}
                  >
                    <ScrollableContainer
                      maxHeight='21.5rem'
                      className='dashboard-panel-scroll-wrap'
                      contentClassName='dashboard-panel-scroll'
                      fadeIndicatorClassName='dashboard-panel-fade'
                    >
                      {renderMonitorList(group.monitors)}
                    </ScrollableContainer>
                  </TabPane>
                ))}
              </Tabs>
            )
          ) : (
            <div className='dashboard-panel-empty py-8'>
              <Empty
                image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
                darkModeImage={
                  <IllustrationConstructionDark style={ILLUSTRATION_SIZE} />
                }
                title={t('暂无监控数据')}
                description={t('请联系管理员在系统设置中配置Uptime')}
              />
            </div>
          )}
        </Spin>
      </div>

      {uptimeData.length > 0 && (
        <div className='dashboard-uptime-legend'>
          <div className='dashboard-legend-list justify-center'>
            {uptimeLegendData.map((legend, index) => (
              <div key={index} className='dashboard-legend-item'>
                <div
                  className='dashboard-legend-dot'
                  style={{ backgroundColor: legend.color }}
                />
                <span className='dashboard-legend-label'>{legend.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default UptimePanel;
