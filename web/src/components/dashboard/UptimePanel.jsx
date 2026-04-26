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
import { Button, Chip, Spinner, Tabs } from '@heroui/react';
import { EmptyState, Widget } from '@heroui-pro/react';
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
    <Widget className={`lg:col-span-1 ${CARD_PROPS?.className || ''}`}>
      <Widget.Header className='h-12'>
        <div className='flex items-center gap-2 whitespace-nowrap'>
          <Gauge size={16} className='shrink-0' />
          <Widget.Title>{t('服务可用性')}</Widget.Title>
        </div>
        {/* Force sub-`sm` dimensions: HeroUI Button only ships sm/md/lg, so
            the trailing refresh action gets `!h-6 !w-6` overrides + a 12px
            icon to read as a quiet inline affordance instead of a full-size
            button against the compact 48px header. */}
        <Button
          isIconOnly
          isPending={uptimeLoading}
          size='sm'
          variant='ghost'
          onPress={loadUptimeData}
          className='!h-6 !w-6 !min-w-0 rounded-full text-muted hover:text-primary [&_svg]:!size-3'
        >
          <RefreshCw size={12} />
        </Button>
      </Widget.Header>
      <Widget.Content className='p-0'>
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
            <EmptyState size='sm'>
              <EmptyState.Header>
                <EmptyState.Media variant='icon'>
                  <Gauge />
                </EmptyState.Media>
                <EmptyState.Title>{t('暂无监控数据')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('请联系管理员在系统设置中配置Uptime')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </div>
      </Widget.Content>
      {uptimeData.length > 0 && (
        <Widget.Footer className='justify-center'>
          <Widget.Legend className='flex-wrap'>
            {uptimeLegendData.map((legend, index) => (
              <Widget.LegendItem key={index} color={legend.color}>
                {legend.label}
              </Widget.LegendItem>
            ))}
          </Widget.Legend>
        </Widget.Footer>
      )}
    </Widget>
  );
};

export default UptimePanel;
