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
import { Tabs } from '@heroui/react';
import { Widget } from '@heroui-pro/react';
import { PieChart } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';

const ChartsPanel = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_user_rank,
  spec_user_trend,
  isAdminUser,
  CARD_PROPS,
  CHART_CONFIG,
  FLEX_CENTER_GAP2,
  hasApiInfoPanel,
  t,
}) => {
  // Build static tab items so the underlying RAC collection sees a stable
  // list (HeroUI Tabs is a `react-aria-components` Tabs and rejects raw
  // conditional children inside <Tabs.List/>).
  const tabItems = [
    { id: '1', title: t('消耗分布'), spec: spec_line },
    { id: '2', title: t('调用趋势'), spec: spec_model_line },
    { id: '3', title: t('调用次数分布'), spec: spec_pie },
    { id: '4', title: t('调用次数排行'), spec: spec_rank_bar },
    isAdminUser && { id: '5', title: t('用户消耗排行'), spec: spec_user_rank },
    isAdminUser && { id: '6', title: t('用户消耗趋势'), spec: spec_user_trend },
  ].filter(Boolean);

  return (
    <Widget
      className={`${hasApiInfoPanel ? 'lg:col-span-2 xl:col-span-3' : ''} ${CARD_PROPS?.className || ''}`}
    >
      {/* The Tabs strip carries 4–6 entries and only fits on the same row as
          the title at xl+, so keep the header column-stacked through lg and
          let the tab list scroll horizontally when it would otherwise squeeze
          tab labels into vertical CJK character columns. */}
      <Widget.Header className='h-auto min-h-12 flex-col items-start gap-3 py-3 xl:flex-row xl:items-center'>
        <div className={`${FLEX_CENTER_GAP2} whitespace-nowrap`}>
          <PieChart size={16} className='shrink-0' />
          <Widget.Title>{t('模型数据分析')}</Widget.Title>
        </div>
        <div className='-mx-1 w-full overflow-x-auto px-1 xl:w-auto'>
          <Tabs
            selectedKey={activeChartTab}
            onSelectionChange={(key) => setActiveChartTab(String(key))}
            variant='secondary'
          >
            <Tabs.List aria-label={t('模型数据分析')}>
              {tabItems.map((item) => (
                <Tabs.Tab
                  key={item.id}
                  id={item.id}
                  className='whitespace-nowrap text-xs'
                >
                  {item.title}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
      </Widget.Header>
      <Widget.Content className='p-0'>
        <div className='h-96 p-2'>
          {tabItems.map(
            (item) =>
              activeChartTab === item.id && (
                <VChart key={item.id} spec={item.spec} option={CHART_CONFIG} />
              ),
          )}
        </div>
      </Widget.Content>
    </Widget>
  );
};

export default ChartsPanel;
