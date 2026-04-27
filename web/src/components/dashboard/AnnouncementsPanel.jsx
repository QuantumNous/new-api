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
import { Card, Chip } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { Bell } from 'lucide-react';
import { marked } from 'marked';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const AnnouncementsPanel = ({
  announcementData,
  announcementLegendData,
  CARD_PROPS,
  ILLUSTRATION_SIZE,
  t,
}) => {
  return (
    <Card
      className={`rounded-2xl lg:col-span-2 ${CARD_PROPS?.className || ''}`}
      shadow='none'
    >
      <Card.Header className='border-b border-border'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full'>
          <div className='flex items-center gap-2'>
            <Bell size={16} />
            {t('系统公告')}
            <Chip size='sm' variant='secondary'>
              {t('显示最新20条')}
            </Chip>
          </div>
          {/* 图例 */}
          <div className='flex flex-wrap gap-3 text-xs'>
            {announcementLegendData.map((legend, index) => (
              <div key={index} className='flex items-center gap-1'>
                <div
                  className='w-2 h-2 rounded-full'
                  style={{
                    backgroundColor:
                      legend.color === 'grey'
                        ? '#8b9aa7'
                        : legend.color === 'blue'
                          ? '#3b82f6'
                          : legend.color === 'green'
                            ? '#10b981'
                            : legend.color === 'orange'
                              ? '#f59e0b'
                              : legend.color === 'red'
                                ? '#ef4444'
                                : '#8b9aa7',
                  }}
                />
                <span className='text-xs text-muted'>{legend.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card.Header>
      <Card.Content className='p-0'>
      <ScrollableContainer maxHeight='24rem'>
        {announcementData.length > 0 ? (
          <div className='space-y-4 p-4'>
            {announcementData.map((item, idx) => {
              const htmlExtra = item.extra ? marked.parse(item.extra) : '';
              return (
                <div key={idx} className='relative pl-5'>
                  <span className='absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-muted ring-4 ring-background' />
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
          <div className='flex justify-center items-center py-8'>
            <EmptyState size='sm'>
              <EmptyState.Header>
                <EmptyState.Media variant='icon'>
                  <Bell size={28} style={ILLUSTRATION_SIZE} />
                </EmptyState.Media>
                <EmptyState.Title>{t('暂无系统公告')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('请联系管理员在系统设置中配置公告信息')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        )}
      </ScrollableContainer>
      </Card.Content>
    </Card>
  );
};

export default AnnouncementsPanel;
