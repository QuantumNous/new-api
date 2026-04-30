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
  FilterSelect,
  useTableFilterForm,
} from '../../common/ui/TableFilterForm';

const LogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  setShowColumnSelector,
  formApi,
  setLogType,
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
  const logTypeOptions = [
    { value: '0', label: t('全部') },
    { value: '1', label: t('充值') },
    { value: '2', label: t('消费') },
    { value: '3', label: t('管理') },
    { value: '4', label: t('系统') },
    { value: '5', label: t('错误') },
    { value: '6', label: t('退款') },
  ];

  return (
    <form onSubmit={handleSubmit} autoComplete='off'>
      <div className='flex flex-col gap-2'>
        {/* 4 cols on lg keeps the legacy desktop look. xl bumps to 6 so a
            non-admin's 5 filters (date×2 + 4 inputs) fit on a single row;
            2xl bumps to 8 so an admin's 8 cells (date×2 + 6 inputs) line
            up on one row too — previously every filter inflated to 25% of
            the card on very wide screens (1920+) which looked broken. */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2'>
          {/* 时间选择器 */}
          <div className='col-span-1 md:col-span-2'>
            <FilterDateRange
              value={values.dateRange}
              onChange={(nextValue) => setFieldValue('dateRange', nextValue)}
              startPlaceholder={t('开始时间')}
              endPlaceholder={t('结束时间')}
              presets={presets}
            />
          </div>

          {/* 其他搜索字段 */}
          <FilterInput
            value={values.token_name}
            onChange={(nextValue) => setFieldValue('token_name', nextValue)}
            placeholder={t('令牌名称')}
          />

          <FilterInput
            value={values.model_name}
            onChange={(nextValue) => setFieldValue('model_name', nextValue)}
            placeholder={t('模型名称')}
          />

          <FilterInput
            value={values.group}
            onChange={(nextValue) => setFieldValue('group', nextValue)}
            placeholder={t('分组')}
          />

          <FilterInput
            value={values.request_id}
            onChange={(nextValue) => setFieldValue('request_id', nextValue)}
            placeholder={t('Request ID')}
          />

          {isAdminUser && (
            <>
              <FilterInput
                value={values.channel}
                onChange={(nextValue) => setFieldValue('channel', nextValue)}
                placeholder={t('渠道 ID')}
              />
              <FilterInput
                value={values.username}
                onChange={(nextValue) => setFieldValue('username', nextValue)}
                placeholder={t('用户名称')}
              />
            </>
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3'>
          {/* 日志类型选择器 */}
          <div className='w-full sm:w-40'>
            <FilterSelect
              value={values.logType}
              onChange={(nextValue) => {
                setFieldValue('logType', nextValue);
                setTimeout(() => {
                  refresh();
                }, 0);
              }}
              placeholder={t('日志类型')}
              options={logTypeOptions}
            />
          </div>

          <div className='flex gap-2 w-full sm:w-auto justify-end'>
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
                  setLogType(0);
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

export default LogsFilters;
