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
import { Button, Card } from '@douyinfe/semi-ui';
import {
  Activity,
  BarChart3,
  LineChart,
  PieChart,
  Trophy,
  Users,
} from 'lucide-react';
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
  const chartTabs = [
    {
      key: '1',
      label: t('消耗分布'),
      icon: PieChart,
      tone: 'cyan',
    },
    {
      key: '2',
      label: t('调用趋势'),
      icon: LineChart,
      tone: 'blue',
    },
    {
      key: '3',
      label: t('调用次数分布'),
      icon: Activity,
      tone: 'green',
    },
    {
      key: '4',
      label: t('调用次数排行'),
      icon: BarChart3,
      tone: 'orange',
    },
  ];

  if (isAdminUser) {
    chartTabs.push(
      {
        key: '5',
        label: t('用户消耗排行'),
        icon: Trophy,
        tone: 'pink',
      },
      {
        key: '6',
        label: t('用户消耗趋势'),
        icon: Users,
        tone: 'violet',
      },
    );
  }

  return (
    <Card
      {...CARD_PROPS}
      className={`dashboard-chart-panel !rounded-[2rem] ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
      title={
        <div className='dashboard-chart-header'>
          <div className='dashboard-chart-copy'>
            <div className='dashboard-panel-eyebrow'>{t('分析')}</div>
            <div className='dashboard-chart-title-group'>
              <div className={FLEX_CENTER_GAP2}>
                <PieChart size={16} />
                {t('模型数据分析')}
              </div>
              <p className='dashboard-chart-subtitle'>
                {t('按模型查看消耗分布、调用趋势与排行。')}
              </p>
            </div>
          </div>
          <div className='dashboard-chart-tabs-wrap'>
            <div className='dashboard-chart-filter-grid'>
              {chartTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeChartTab === tab.key;

                return (
                  <Button
                    key={tab.key}
                    theme='borderless'
                    className={`dashboard-chart-filter dashboard-chart-filter-${tab.tone} ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveChartTab(tab.key)}
                  >
                    <span className='dashboard-chart-tab-icon'>
                      <Icon size={15} strokeWidth={2.2} />
                    </span>
                    <span className='dashboard-chart-tab-label'>
                      <span className='dashboard-chart-tab-text'>{tab.label}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='dashboard-chart-stage'>
        {activeChartTab === '1' && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_line} option={CHART_CONFIG} />
          </div>
        )}
        {activeChartTab === '2' && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_model_line} option={CHART_CONFIG} />
          </div>
        )}
        {activeChartTab === '3' && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_pie} option={CHART_CONFIG} />
          </div>
        )}
        {activeChartTab === '4' && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_rank_bar} option={CHART_CONFIG} />
          </div>
        )}
        {activeChartTab === '5' && isAdminUser && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_user_rank} option={CHART_CONFIG} />
          </div>
        )}
        {activeChartTab === '6' && isAdminUser && (
          <div className='dashboard-chart-canvas'>
            <VChart spec={spec_user_trend} option={CHART_CONFIG} />
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChartsPanel;
