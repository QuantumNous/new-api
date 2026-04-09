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
import { Button, Skeleton } from '@douyinfe/semi-ui';
import { Activity, Image as ImageIcon, Video } from 'lucide-react';

const StatGridCard = ({ loading, title, icon, accentClass, stats }) => {
  const items = [
    { key: 'running', label: '进行中', value: stats?.running || 0 },
    { key: 'success', label: '成功', value: stats?.success || 0 },
    { key: 'failure', label: '失败', value: stats?.failure || 0 },
  ];

  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div className='mb-4 flex items-center justify-between'>
        <div className='text-lg font-bold text-slate-900'>{title}</div>
        <div
          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}
        >
          {icon}
        </div>
      </div>

      <div className='grid grid-cols-3 gap-3'>
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
  statsRangePreset,
  handleStatsRangePresetChange,
  statsData,
  statsLoading,
  taskStatsRangePresets,
  t,
}) => {
  return (
    <div className='w-full space-y-4'>
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

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-3'>
        <StatGridCard
          loading={statsLoading}
          title={t('总任务')}
          icon={<Activity size={18} className='text-blue-700' />}
          accentClass='bg-blue-100'
          stats={statsData?.total_stats}
        />

        <StatGridCard
          loading={statsLoading}
          title={t('图片任务')}
          icon={<ImageIcon size={18} className='text-emerald-700' />}
          accentClass='bg-emerald-100'
          stats={statsData?.image_stats}
        />

        <StatGridCard
          loading={statsLoading}
          title={t('视频任务')}
          icon={<Video size={18} className='text-violet-700' />}
          accentClass='bg-violet-100'
          stats={statsData?.video_stats}
        />
      </div>
    </div>
  );
};

export default TaskLogsDashboard;
