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
import { Chip } from '@heroui/react';
import { EmptyState, Widget } from '@heroui-pro/react';
import { Bell } from 'lucide-react';
import { marked } from 'marked';
import ScrollableContainer from '../common/ui/ScrollableContainer';

// Map known legend swatch keys to concrete CSS colors so the dot
// renders consistently regardless of the active theme.
const LEGEND_COLOR_MAP = {
  grey: '#8b9aa7',
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
};

const AnnouncementsPanel = ({
  announcementData,
  announcementLegendData,
  CARD_PROPS,
  t,
}) => {
  return (
    <Widget className={`lg:col-span-2 ${CARD_PROPS?.className || ''}`}>
      <Widget.Header className='h-auto min-h-12 flex-col items-start gap-2 py-3 lg:flex-row lg:items-center'>
        <div className='flex items-center gap-2 whitespace-nowrap'>
          <Bell size={16} className='shrink-0' />
          <Widget.Title>{t('系统公告')}</Widget.Title>
          <Chip size='sm' variant='secondary'>
            {t('显示最新20条')}
          </Chip>
        </div>
        <Widget.Legend className='flex-wrap'>
          {announcementLegendData.map((legend, index) => (
            <Widget.LegendItem
              key={index}
              color={LEGEND_COLOR_MAP[legend.color] || legend.color}
            >
              {legend.label}
            </Widget.LegendItem>
          ))}
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content className='p-0'>
        <ScrollableContainer maxHeight='24rem'>
          {announcementData.length > 0 ? (
            <div className='space-y-4 p-4'>
              {announcementData.map((item, idx) => {
                const htmlExtra = item.extra ? marked.parse(item.extra) : '';
                return (
                  <div key={idx} className='relative pl-5'>
                    <span className='absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-muted ring-4 ring-surface' />
                    <div className='text-xs text-muted'>
                      {`${item.relative ? item.relative + ' ' : ''}${item.time}`}
                    </div>
                    <div
                      className='prose prose-sm mt-1 max-w-none dark:prose-invert text-foreground'
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(item.content || ''),
                      }}
                    />
                    {item.extra ? (
                      <div
                        className='prose prose-xs mt-2 max-w-none text-xs text-muted dark:prose-invert'
                        dangerouslySetInnerHTML={{ __html: htmlExtra }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState size='sm'>
              <EmptyState.Header>
                <EmptyState.Media variant='icon'>
                  <Bell />
                </EmptyState.Media>
                <EmptyState.Title>{t('暂无系统公告')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('请联系管理员在系统设置中配置公告信息')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </ScrollableContainer>
      </Widget.Content>
    </Widget>
  );
};

export default AnnouncementsPanel;
