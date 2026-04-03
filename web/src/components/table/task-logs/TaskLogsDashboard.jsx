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

import React, { useMemo } from 'react';
import { Button, Skeleton, Typography } from '@douyinfe/semi-ui';
import { IconEyeOpened } from '@douyinfe/semi-icons';
import { Activity, Image as ImageIcon, Video } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const StatValue = ({ loading, value, suffix = '' }) => (
  <Skeleton
    loading={loading}
    active
    placeholder={
      <Skeleton.Title
        style={{
          width: '72px',
          height: '28px',
          marginBottom: 0,
        }}
      />
    }
  >
    <div className='text-3xl font-black tracking-tight text-slate-900'>
      {value}
      {suffix}
    </div>
  </Skeleton>
);

const BreakdownCard = ({ loading, title, icon, accentClass, stats }) => {
  const items = [
    { key: 'running', label: '进行中', value: stats?.running || 0 },
    { key: 'success', label: '成功', value: stats?.success || 0 },
    { key: 'failure', label: '失败', value: stats?.failure || 0 },
  ];

  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='text-xs font-bold uppercase tracking-[0.18em] text-slate-400'>
            {title}
          </div>
          <div className='mt-2 text-lg font-bold text-slate-900'>{title}</div>
        </div>
        <div
          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}
        >
          {icon}
        </div>
      </div>
      <div className='mt-5 grid grid-cols-3 gap-3'>
        {items.map((item) => (
          <div key={item.key} className='rounded-2xl bg-slate-50 px-3 py-3'>
            <div className='text-xs font-medium text-slate-500'>
              {item.label}
            </div>
            <Skeleton
              loading={loading}
              active
              placeholder={
                <Skeleton.Title
                  style={{
                    width: '38px',
                    height: '20px',
                    marginTop: 8,
                    marginBottom: 0,
                  }}
                />
              }
            >
              <div className='mt-2 text-xl font-bold text-slate-900'>
                {item.value}
              </div>
            </Skeleton>
          </div>
        ))}
      </div>
    </div>
  );
};

const TaskLogsDashboard = ({
  compactMode,
  setCompactMode,
  mediaType,
  handleMediaTypeChange,
  statsRangePreset,
  handleStatsRangePresetChange,
  statsData,
  statsLoading,
  taskStatsRangePresets,
  taskMediaTypeOptions,
  t,
}) => {
  const chartSpec = useMemo(() => {
    const values = (statsData?.daily_counts || []).map((item) => ({
      date: item.date,
      total: Number(item.total || 0),
    }));

    return {
      type: 'line',
      data: [
        {
          id: 'daily-task-counts',
          values,
        },
      ],
      xField: 'date',
      yField: 'total',
      point: {
        visible: true,
        style: {
          fill: '#2563eb',
          stroke: '#ffffff',
          lineWidth: 2,
        },
      },
      line: {
        style: {
          curveType: 'monotone',
          lineWidth: 3,
          stroke: '#2563eb',
        },
      },
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          label: {
            visible: true,
            style: {
              fontSize: 11,
            },
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: {
            visible: true,
            style: {
              fontSize: 11,
            },
          },
          tick: {
            visible: false,
          },
          grid: {
            visible: true,
            style: {
              stroke: '#e2e8f0',
              lineDash: [4, 4],
            },
          },
        },
      ],
      padding: {
        top: 16,
        right: 16,
        bottom: 28,
        left: 48,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum.date,
              value: (datum) => `${datum.total}`,
            },
          ],
        },
      },
    };
  }, [statsData]);

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='space-y-3'>
          <div className='flex items-center text-orange-500'>
            <IconEyeOpened className='mr-2' />
            <Text>{t('任务仪表台')}</Text>
          </div>

          <div className='flex flex-wrap gap-2'>
            {taskStatsRangePresets.map((preset) => (
              <Button
                key={preset.key}
                theme={statsRangePreset === preset.key ? 'solid' : 'light'}
                type={statsRangePreset === preset.key ? 'primary' : 'tertiary'}
                size='small'
                onClick={() => handleStatsRangePresetChange(preset.key)}
              >
                {t(preset.label)}
              </Button>
            ))}
          </div>

          <div className='flex flex-wrap gap-2'>
            {taskMediaTypeOptions.map((option) => (
              <Button
                key={option.key}
                theme={mediaType === option.key ? 'solid' : 'light'}
                type={mediaType === option.key ? 'primary' : 'tertiary'}
                size='small'
                onClick={() => handleMediaTypeChange(option.key)}
              >
                {t(option.label)}
              </Button>
            ))}
          </div>
        </div>

        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr_1fr]'>
        <div className='rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-xs font-bold uppercase tracking-[0.18em] text-slate-400'>
                {t('正在进行的任务')}
              </div>
              <div className='mt-2 text-lg font-bold text-slate-900'>
                {t('当前筛选范围内的未完成任务')}
              </div>
            </div>
            <div className='inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200/80'>
              <Activity size={20} />
            </div>
          </div>
          <div className='mt-6'>
            <StatValue
              loading={statsLoading}
              value={statsData?.running_count || 0}
            />
          </div>
        </div>

        <BreakdownCard
          loading={statsLoading}
          title={t('图片任务')}
          icon={<ImageIcon size={18} className='text-emerald-700' />}
          accentClass='bg-emerald-100'
          stats={statsData?.image_stats}
        />

        <BreakdownCard
          loading={statsLoading}
          title={t('视频任务')}
          icon={<Video size={18} className='text-violet-700' />}
          accentClass='bg-violet-100'
          stats={statsData?.video_stats}
        />
      </div>

      <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
        <div className='mb-4'>
          <div className='text-xs font-bold uppercase tracking-[0.18em] text-slate-400'>
            {t('每天任务数')}
          </div>
          <div className='mt-2 text-lg font-bold text-slate-900'>
            {t('按天查看任务提交趋势')}
          </div>
        </div>
        <div className='h-[280px]'>
          {statsLoading ? (
            <Skeleton
              loading={true}
              active
              placeholder={
                <Skeleton.Paragraph
                  rows={8}
                  style={{
                    height: '100%',
                  }}
                />
              }
            />
          ) : (
            <VChart spec={chartSpec} />
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskLogsDashboard;
