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
import { Card, Tag, Timeline, Empty } from '@douyinfe/semi-ui';
import { Bell } from 'lucide-react';
import { marked } from 'marked';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
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
      {...CARD_PROPS}
      className='na-dashboard-panel lg:col-span-2'
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full'>
          <div className='flex items-center gap-2'>
            <Bell size={16} />
            {t('系统公告')}
            <Tag color='white' shape='circle'>
              {t('显示最新20条')}
            </Tag>
          </div>
          {/* 图例 */}
          <div className='na-dashboard-legend'>
            {announcementLegendData.map((legend, index) => (
              <div key={index} className='na-dashboard-legend-item'>
                <div
                  className='na-dashboard-status-dot'
                  style={{
                    backgroundColor:
                      legend.color === 'grey'
                        ? 'var(--na-text-tertiary)'
                        : legend.color === 'blue'
                          ? 'var(--na-color-info)'
                          : legend.color === 'green'
                            ? 'var(--na-color-success)'
                            : legend.color === 'orange'
                              ? 'var(--na-color-warning)'
                              : legend.color === 'red'
                                ? 'var(--na-color-error)'
                                : 'var(--na-text-tertiary)',
                  }}
                />
                <span className='na-dashboard-legend-label'>
                  {legend.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight='var(--na-space-96)'>
        {announcementData.length > 0 ? (
          <Timeline mode='left'>
            {announcementData.map((item, idx) => {
              const htmlExtra = item.extra ? marked.parse(item.extra) : '';
              return (
                <Timeline.Item
                  key={idx}
                  type={item.type || 'default'}
                  time={`${item.relative ? item.relative + ' ' : ''}${item.time}`}
                  extra={
                    item.extra ? (
                      <div
                        className='na-dashboard-meta'
                        dangerouslySetInnerHTML={{ __html: htmlExtra }}
                      />
                    ) : null
                  }
                >
                  <div>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(item.content || ''),
                      }}
                    />
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        ) : (
          <div className='na-dashboard-empty'>
            <Empty
              image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
              darkModeImage={
                <IllustrationConstructionDark style={ILLUSTRATION_SIZE} />
              }
              title={t('暂无系统公告')}
              description={t('请联系管理员在系统设置中配置公告信息')}
            />
          </div>
        )}
      </ScrollableContainer>
    </Card>
  );
};

export default AnnouncementsPanel;
