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
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const AnnouncementsPanel = ({
  announcementData,
  announcementLegendData,
  CARD_PROPS,
  ILLUSTRATION_SIZE,
  t
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className="shadow-sm !rounded-2xl lg:col-span-2"
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <Bell size={16} />
            {t('系统公告')}
            <Tag color="white" shape="circle">
              {t('显示最新20条')}
            </Tag>
          </div>
          {/* 图例 */}
          <div className="flex flex-wrap gap-3 text-xs">
            {announcementLegendData.map((legend, index) => (
              <div key={index} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: legend.color === 'grey' ? '#8b9aa7' :
                      legend.color === 'blue' ? '#3b82f6' :
                        legend.color === 'green' ? '#10b981' :
                          legend.color === 'orange' ? '#f59e0b' :
                            legend.color === 'red' ? '#ef4444' : '#8b9aa7'
                  }}
                />
                <span className="text-gray-600">{legend.label}</span>
              </div>
            ))}
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight="24rem">
        {announcementData.length > 0 ? (
          <Timeline mode="alternate">
            {announcementData.map((item, idx) => (
              <Timeline.Item
                key={idx}
                type={item.type || 'default'}
                time={item.time}
              >
                <div>
                  <div
                    dangerouslySetInnerHTML={{ __html: marked.parse(item.content || '') }}
                  />
                  {item.extra && (
                    <div
                      className="text-xs text-gray-500"
                      dangerouslySetInnerHTML={{ __html: marked.parse(item.extra) }}
                    />
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <div className="flex justify-center items-center py-8">
            <Empty
              image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
              darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
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