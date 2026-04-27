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
import { Button } from '@heroui/react';

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';
import {
  FilterDateRange,
  FilterInput,
  useTableFilterForm,
} from '../../common/ui/TableFilterForm';

const MjLogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  setShowColumnSelector,
  formApi,
  loading,
  isAdminUser,
  t,
}) => {
  const { values, setFieldValue, handleSubmit } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: refresh,
  });
  const presets = DATE_RANGE_PRESETS.map((preset) => ({
    text: t(preset.text),
    start: preset.start(),
    end: preset.end(),
  }));

  return (
    <form onSubmit={handleSubmit} autoComplete='off'>
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
          {/* 时间选择器 */}
          <div className='col-span-1 lg:col-span-2'>
            <FilterDateRange
              value={values.dateRange}
              onChange={(nextValue) => setFieldValue('dateRange', nextValue)}
              startPlaceholder={t('开始时间')}
              endPlaceholder={t('结束时间')}
              presets={presets}
            />
          </div>

          {/* 任务 ID */}
          <FilterInput
            value={values.mj_id}
            onChange={(nextValue) => setFieldValue('mj_id', nextValue)}
            placeholder={t('任务 ID')}
          />

          {/* 渠道 ID - 仅管理员可见 */}
          {isAdminUser && (
            <FilterInput
              value={values.channel_id}
              onChange={(nextValue) => setFieldValue('channel_id', nextValue)}
              placeholder={t('渠道 ID')}
            />
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className='flex justify-between items-center'>
          <div></div>
          <div className='flex gap-2'>
            <Button
              type='submit'
              variant='tertiary'
              loading={loading}
              size='sm'
            >
              {t('查询')}
            </Button>
            <Button
              variant='tertiary'
              onClick={() => {
                if (formApi) {
                  formApi.reset();
                  setTimeout(() => {
                    refresh();
                  }, 100);
                }
              }}
              size='sm'
            >
              {t('重置')}
            </Button>
            <Button
              variant='tertiary'
              onClick={() => setShowColumnSelector(true)}
              size='sm'
            >
              {t('列设置')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default MjLogsFilters;
