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
import { Avatar, Button, Skeleton } from '@heroui/react';
import { Widget } from '@heroui-pro/react';
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
      {/* Use 2-col through `lg` so each KPI card has enough room for the
          avatar + label + value + sparkline row, then collapse to 4-col only
          at xl where the main area is wide enough for ~280px per card. */}
      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
        {groupedStatsData.map((group, idx) => (
          <Widget
            key={idx}
            className={`w-full ${group.color || ''} ${CARD_PROPS?.className || ''}`}
          >
            <Widget.Header className='h-12'>{group.title}</Widget.Header>
            {/* Tighten the default Widget.Content p-4 to p-3 so the inner shell
                still has room for value + sparkline/button on narrow widths. */}
            <Widget.Content className='space-y-4 p-3'>
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className='flex items-center justify-between gap-2 cursor-pointer'
                  onClick={item.onClick}
                >
                  <div className='flex items-center min-w-0 flex-1'>
                    <Avatar
                      className='mr-2 shrink-0'
                      size='sm'
                      color={item.avatarColor}
                    >
                      <Avatar.Fallback>{item.icon}</Avatar.Fallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <div className='text-xs text-muted'>{item.title}</div>
                      <div className='text-base font-semibold tabular-nums text-foreground'>
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
                      className='shrink-0'
                      size='sm'
                      variant='secondary'
                      onPress={() => navigate('/console/topup')}
                    >
                      {t('充值')}
                    </Button>
                  ) : (
                    (loading ||
                      (item.trendData && item.trendData.length > 0)) && (
                      <div className='w-24 h-10 shrink-0'>
                        <VChart
                          spec={getTrendSpec(item.trendData, item.trendColor)}
                          option={CHART_CONFIG}
                        />
                      </div>
                    )
                  )}
                </div>
              ))}
            </Widget.Content>
          </Widget>
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
