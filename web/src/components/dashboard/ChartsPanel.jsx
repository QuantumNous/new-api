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
import { Card, Tabs, TabPane } from '@douyinfe/semi-ui';
import { PieChart, DollarSign, Coins } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';

const ChartsPanel = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  CARD_PROPS,
  CHART_CONFIG,
  FLEX_CENTER_GAP2,
  hasApiInfoPanel,
  t,
  displayMode,
  onDisplayModeChange,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className={`!rounded-2xl ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
          <div className={FLEX_CENTER_GAP2}>
            <PieChart size={16} />
            {t('模型数据分析')}
          </div>
          <div className='flex items-center gap-2'>
            {activeChartTab === '1' && (
              <div
                className='flex items-center gap-1 bg-[var(--semi-color-fill-0)] rounded px-1.5 py-1 cursor-pointer hover:bg-[var(--semi-color-fill-1)] transition-colors'
                onClick={() => onDisplayModeChange(displayMode === 'QUOTA' ? 'TOKENS' : 'QUOTA')}
                title={displayMode === 'QUOTA' ? t('切换为 Token') : t('切换为金额')}
              >
                {displayMode === 'QUOTA' ? (
                  <DollarSign size={14} className='text-[var(--semi-color-text-2)]' />
                ) : (
                  <Coins size={14} className='text-[var(--semi-color-text-2)]' />
                )}
              </div>
            )}
            <Tabs
              type='slash'
              activeKey={activeChartTab}
              onChange={setActiveChartTab}
            >
              <TabPane tab={<span>{t('消耗分布')}</span>} itemKey='1' />
              <TabPane tab={<span>{t('消耗趋势')}</span>} itemKey='2' />
              <TabPane tab={<span>{t('调用次数分布')}</span>} itemKey='3' />
              <TabPane tab={<span>{t('调用次数排行')}</span>} itemKey='4' />
            </Tabs>
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='h-96 p-2'>
        {activeChartTab === '1' && (
          <VChart spec={spec_line} option={CHART_CONFIG} />
        )}
        {activeChartTab === '2' && (
          <VChart spec={spec_model_line} option={CHART_CONFIG} />
        )}
        {activeChartTab === '3' && (
          <VChart spec={spec_pie} option={CHART_CONFIG} />
        )}
        {activeChartTab === '4' && (
          <VChart spec={spec_rank_bar} option={CHART_CONFIG} />
        )}
      </div>
    </Card>
  );
};

export default ChartsPanel;
