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
import { Card, Avatar, Skeleton, Tag } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const StatsCards = ({
  groupedStatsData,
  loading,
  getTrendSpec,
  CARD_PROPS,
  CHART_CONFIG,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const cardThemes = [
    {
      accent: '#2fdcff',
      accentStrong: '#0068ff',
      accentSoft: 'rgba(47, 220, 255, 0.28)',
      surface:
        'linear-gradient(150deg, rgba(255, 255, 255, 0.98) 0%, rgba(236, 248, 255, 0.98) 56%, rgba(255, 255, 255, 0.98) 100%)',
    },
    {
      accent: '#2ef7a3',
      accentStrong: '#00b86b',
      accentSoft: 'rgba(46, 247, 163, 0.26)',
      surface:
        'linear-gradient(150deg, rgba(255, 255, 255, 0.98) 0%, rgba(238, 255, 247, 0.98) 52%, rgba(255, 255, 255, 0.98) 100%)',
    },
    {
      accent: '#ffd24a',
      accentStrong: '#ff7a18',
      accentSoft: 'rgba(255, 210, 74, 0.26)',
      surface:
        'linear-gradient(150deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 247, 229, 0.98) 52%, rgba(255, 255, 255, 0.98) 100%)',
    },
    {
      accent: '#ff6aa9',
      accentStrong: '#ff3d71',
      accentSoft: 'rgba(255, 106, 169, 0.26)',
      surface:
        'linear-gradient(150deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 239, 246, 0.98) 52%, rgba(255, 255, 255, 0.98) 100%)',
    },
  ];

  return (
    <div className='dashboard-stats-row mb-4'>
      <div className='dashboard-stats-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {groupedStatsData.map((group, idx) => {
          const theme = cardThemes[idx % cardThemes.length];

          return (
            <Card
              key={idx}
              {...CARD_PROPS}
              className='dashboard-metric-card w-full'
              style={{
                '--dashboard-accent': theme.accent,
                '--dashboard-accent-strong': theme.accentStrong,
                '--dashboard-accent-soft': theme.accentSoft,
                '--dashboard-card-surface': theme.surface,
              }}
              title={
                <div className='dashboard-card-heading'>
                  <div className='dashboard-card-title'>{group.title}</div>
                  <span className='dashboard-card-index'>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
              }
            >
              <div className='dashboard-metric-list'>
                {group.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className={`dashboard-metric-item ${item.onClick ? 'dashboard-metric-item-clickable' : ''}`}
                    onClick={item.onClick}
                  >
                    <div className='dashboard-metric-main'>
                      <Avatar
                        className='dashboard-metric-avatar'
                        size='small'
                        color={item.avatarColor}
                      >
                        {item.icon}
                      </Avatar>
                      <div className='dashboard-metric-copy'>
                        <div className='dashboard-metric-label'>
                          {item.title}
                        </div>
                        <div className='dashboard-metric-value'>
                          <Skeleton
                            loading={loading}
                            active
                            placeholder={
                              <Skeleton.Paragraph
                                active
                                rows={1}
                                style={{
                                  width: '65px',
                                  height: '24px',
                                  marginTop: '4px',
                                }}
                              />
                            }
                          >
                            {item.value}
                          </Skeleton>
                        </div>
                      </div>
                    </div>
                    {item.title === t('当前余额') ? (
                      <Tag
                        color='white'
                        shape='circle'
                        size='large'
                        className='dashboard-metric-action-tag'
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/console/topup');
                        }}
                      >
                        {t('充值')}
                      </Tag>
                    ) : (
                      !loading &&
                      item.trendData &&
                      item.trendData.length > 0 && (
                        <div className='dashboard-metric-trend'>
                          <VChart
                            spec={getTrendSpec(item.trendData, item.trendColor)}
                            option={CHART_CONFIG}
                          />
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StatsCards;
