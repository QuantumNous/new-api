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
      className='dashboard-announcements-panel !rounded-[2rem] lg:col-span-2'
      title={
        <div className='dashboard-panel-header dashboard-announcements-header'>
          <div className='dashboard-panel-eyebrow'>
            <span>{t('更新')}</span>

            <div className='dashboard-legend-list'>
              {announcementLegendData.map((legend, index) => (
                <div key={index} className='dashboard-legend-item'>
                  <div
                    className='dashboard-legend-dot'
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
                  <span className='dashboard-legend-label'>{legend.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className='dashboard-panel-title-row'>
            <Bell size={16} />
            {t('系统公告')}
            <Tag color='white' shape='circle' className='dashboard-panel-badge'>
              {t('显示最新20条')}
            </Tag>
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer
        maxHeight='24rem'
        className='dashboard-panel-scroll-wrap'
        contentClassName='dashboard-panel-scroll dashboard-announcements-scroll'
        fadeIndicatorClassName='dashboard-panel-fade'
      >
        {announcementData.length > 0 ? (
          <Timeline mode='left' className='dashboard-announcements-timeline'>
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
                        className='dashboard-announcement-extra'
                        dangerouslySetInnerHTML={{ __html: htmlExtra }}
                      />
                    ) : null
                  }
                >
                  <div className='dashboard-announcement-content'>
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
          <div className='dashboard-panel-empty py-8'>
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
