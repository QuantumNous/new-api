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
  const shouldRenderSparkline = (trendData) => {
    if (!Array.isArray(trendData) || trendData.length < 2) {
      return false;
    }
    const finiteValues = trendData
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    if (finiteValues.length < 2) {
      return false;
    }
    return new Set(finiteValues).size > 1;
  };

  return (
    <div className='na-dashboard-grid'>
      <div className='na-dashboard-grid-inner'>
        {groupedStatsData.map((group, idx) => (
          <Card
            key={idx}
            {...CARD_PROPS}
            className={`na-dashboard-card ${group.color}`}
            title={group.title}
          >
            <div className='na-dashboard-card-body'>
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className='na-dashboard-stat-row'
                  onClick={item.onClick}
                >
                  <div className='na-dashboard-list-row'>
                    <Avatar
                      className='na-dashboard-stat-avatar'
                      size='small'
                      color={item.avatarColor}
                    >
                      {item.icon}
                    </Avatar>
                    <div>
                      <div className='na-dashboard-stat-title'>
                        {item.title}
                      </div>
                      <div className='na-dashboard-stat-value'>
                        <Skeleton
                          loading={loading}
                          active
                          placeholder={
                            <Skeleton.Paragraph
                              active
                              rows={1}
                              style={{
                                width: 'var(--na-dashboard-spark-width)',
                                height: 'var(--na-dashboard-spark-height)',
                                marginTop: 'var(--na-space-1)',
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
                      className='na-dashboard-topup-tag'
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/console/topup');
                      }}
                    >
                      {t('充值')}
                    </Tag>
                  ) : (
                    shouldRenderSparkline(item.trendData) && (
                      <div className='na-dashboard-spark'>
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
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
