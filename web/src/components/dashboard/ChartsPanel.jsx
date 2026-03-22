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
import {
  Button,
  Card,
  DatePicker,
  Select,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import { PieChart } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import { DATE_RANGE_PRESETS } from '../../constants/console.constants';

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
  customRangeDraft,
  timeOptions,
  activeRangePreset,
  quickRangeOptions,
  handleRangePresetChange,
  handleCustomRangeChange,
  handleCustomRangeConfirm,
  t,
}) => {
  const customRangeValue = [
    customRangeDraft.start_timestamp,
    customRangeDraft.end_timestamp,
  ];
  const hasCompleteCustomRange = customRangeValue.every(Boolean);
  const isCustomRangeOrderValid =
    !hasCompleteCustomRange ||
    Date.parse(customRangeValue[0]) <= Date.parse(customRangeValue[1]);

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
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs font-medium text-gray-500'>
            {t('时间范围')}
          </span>
          {quickRangeOptions.map((option) => {
            const isActive = activeRangePreset === option.value;
            return (
              <Button
                key={option.value}
                size='small'
                type={isActive ? 'primary' : 'tertiary'}
                theme={isActive ? 'solid' : 'borderless'}
                onClick={() => handleRangePresetChange(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        <Button
          size='small'
          type={activeRangePreset === 'custom' ? 'primary' : 'tertiary'}
          theme={activeRangePreset === 'custom' ? 'solid' : 'light'}
          onClick={() => handleRangePresetChange('custom')}
        >
          {t('自定义范围')}
        </Button>
      </div>
      {activeRangePreset === 'custom' && (
        <div className='flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between'>
          <DatePicker
            type='dateTimeRange'
            value={customRangeValue}
            onChange={(_, dateStrings) => handleCustomRangeChange(dateStrings)}
            presets={DATE_RANGE_PRESETS.map((preset) => ({
              text: t(preset.text),
              start: preset.start(),
              end: preset.end(),
            }))}
            placeholder={[t('开始时间'), t('结束时间')]}
            showClear
            size='small'
            className='w-full lg:max-w-[420px]'
          />
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end'>
            <Select
              value={customRangeDraft.default_time}
              optionList={timeOptions}
              onChange={(value) =>
                handleCustomRangeChange(customRangeValue, value)
              }
              placeholder={t('时间粒度')}
              size='small'
              className='w-full sm:w-36'
            />
            <Button
              type='primary'
              size='small'
              disabled={!hasCompleteCustomRange || !isCustomRangeOrderValid}
              onClick={handleCustomRangeConfirm}
            >
              {t('应用')}
            </Button>
          </div>
        </div>
      )}
      <div className='h-96 p-2 pt-0'>
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
