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
import { Button, Card, Chip, Spinner, Tabs } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
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
  ILLUSTRATION_SIZE,
  t,
}) => {
  return (
    <Card
      className={`rounded-2xl lg:col-span-1 ${CARD_PROPS?.className || ''}`}
      shadow='none'
    >
      <Card.Header className='border-b border-border'>
        <div className='flex items-center justify-between w-full gap-2'>
          <div className='flex items-center gap-2'>
            <Gauge size={16} />
            {t('服务可用性')}
          </div>
          <Button
            isIconOnly
            isPending={uptimeLoading}
            size='sm'
            variant='ghost'
            onPress={loadUptimeData}
            className='rounded-full text-muted hover:text-primary'
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </Card.Header>
      <Card.Content className='p-0'>
        {/* 内容区域 */}
        <div className='relative'>
          {uptimeLoading ? (
            <div className='flex min-h-48 items-center justify-center'>
              <Spinner size='sm' />
            </div>
          ) : uptimeData.length > 0 ? (
            uptimeData.length === 1 ? (
              <ScrollableContainer maxHeight='24rem'>
                {renderMonitorList(uptimeData[0].monitors)}
              </ScrollableContainer>
            ) : (
              <Tabs
                selectedKey={activeUptimeTab}
                onSelectionChange={(key) => setActiveUptimeTab(String(key))}
                variant='secondary'
                className='p-3'
              >
                <Tabs.List aria-label={t('服务可用性')}>
                  {uptimeData.map((group) => (
                    <Tabs.Tab key={group.categoryName} id={group.categoryName}>
                      <span className='flex items-center gap-2'>
                        <Gauge size={14} />
                        {group.categoryName}
                        <Chip
                          color={
                            activeUptimeTab === group.categoryName
                              ? 'danger'
                              : 'default'
                          }
                          size='sm'
                        >
                          {group.monitors ? group.monitors.length : 0}
                        </Chip>
                      </span>
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                {uptimeData.map((group) => (
                  <Tabs.Panel key={group.categoryName} id={group.categoryName}>
                    <ScrollableContainer maxHeight='21.5rem'>
                      {renderMonitorList(group.monitors)}
                    </ScrollableContainer>
                  </Tabs.Panel>
                ))}
              </Tabs>
            )
          ) : (
            <div className='flex justify-center items-center py-8'>
              <EmptyState size='sm'>
                <EmptyState.Header>
                  <EmptyState.Media variant='icon'>
                    <Gauge size={28} style={ILLUSTRATION_SIZE} />
                  </EmptyState.Media>
                  <EmptyState.Title>{t('暂无监控数据')}</EmptyState.Title>
                  <EmptyState.Description>
                    {t('请联系管理员在系统设置中配置Uptime')}
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            </div>
          )}
        </div>

      {/* 图例 */}
        {uptimeData.length > 0 && (
          <div className='p-3 border-t border-border rounded-b-2xl'>
            <div className='flex flex-wrap gap-3 text-xs justify-center'>
              {uptimeLegendData.map((legend, index) => (
                <div key={index} className='flex items-center gap-1'>
                  <div
                    className='w-2 h-2 rounded-full'
                    style={{ backgroundColor: legend.color }}
                  />
                  <span className='text-muted'>{legend.label}</span>
                </div>
              ))}
              </div>
            </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default UptimePanel;
