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
      className='console-dashboard-panel !rounded-2xl lg:col-span-2'
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full'>
          <div className='console-dashboard-panel-title flex items-center gap-2'>
            <Bell size={16} />
            {t('系统公告')}
            <Tag color='grey' shape='circle' className='console-dashboard-chip'>
              {t('显示最新20条')}
            </Tag>
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
                <span className='console-dashboard-legend-label'>
                  {legend.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight='24rem'>
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
                        className='console-dashboard-muted text-xs'
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
          <div className='flex justify-center items-center py-8'>
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
