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
import { Avatar, Button, Card, Skeleton } from '@heroui/react';
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
  return (
    <div className='mb-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {groupedStatsData.map((group, idx) => (
          <Card
            key={idx}
            className={`${group.color} w-full rounded-2xl border-0 ${CARD_PROPS?.className || ''}`}
            shadow='none'
          >
            <Card.Header>
              <Card.Title className='text-base'>{group.title}</Card.Title>
            </Card.Header>
            <Card.Content className='space-y-4'>
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className='flex items-center justify-between cursor-pointer'
                  onClick={item.onClick}
                >
                  <div className='flex items-center'>
                    <Avatar
                      className='mr-3'
                      size='sm'
                      color={item.avatarColor}
                    >
                      <Avatar.Fallback>{item.icon}</Avatar.Fallback>
                    </Avatar>
                    <div>
                      <div className='text-xs text-muted'>{item.title}</div>
                      <div className='text-lg font-semibold tabular-nums text-foreground'>
                        {loading ? (
                          <Skeleton className='mt-1 h-6 w-16 rounded-lg' />
                        ) : (
                          item.value
                        )}
                      </div>
                    </div>
                  </div>
                  {item.title === t('当前余额') ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      onPress={() => navigate('/console/topup')}
                    >
                      {t('充值')}
                    </Button>
                  ) : (
                    (loading ||
                      (item.trendData && item.trendData.length > 0)) && (
                      <div className='w-24 h-10'>
                        <VChart
                          spec={getTrendSpec(item.trendData, item.trendColor)}
                          option={CHART_CONFIG}
                        />
                      </div>
                    )
                  )}
                </div>
              ))}
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
