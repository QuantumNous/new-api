/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import dayjs from 'dayjs';
import { Button, Form } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

// Reuse the standard usage-logs preset list, but swap "近 30 天" for "上个月"
// — month-aligned buckets matter most when comparing against a supplier
// bill that is itself organised by calendar month.
const RECONCILE_DATE_PRESETS = (t) =>
  DATE_RANGE_PRESETS.map((preset) =>
    preset.text === '近 30 天'
      ? {
          text: t('上个月'),
          start: () => dayjs().subtract(1, 'month').startOf('month').toDate(),
          end: () => dayjs().subtract(1, 'month').endOf('month').toDate(),
        }
      : { ...preset, text: t(preset.text) },
  );

const ReconcileFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  resetFilter,
  channels,
  loading,
  exportMonth,
  exporting,
  t,
}) => {
  // 多选语义：空集 = 全部渠道，所以不再放"全部渠道"哨兵项
  const channelOptions = channels.map((c) => ({
    label: `${c.id} - ${c.name}`,
    value: c.id,
  }));

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => setFormApi(api)}
      onSubmit={refresh}
      allowEmpty={true}
      autoComplete='off'
      layout='vertical'
      trigger='change'
      stopValidateWithError={false}
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
          <div className='col-span-1 lg:col-span-2'>
            <Form.DatePicker
              field='dateRange'
              className='w-full'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              showClear
              pure
              size='small'
              presets={RECONCILE_DATE_PRESETS(t)}
            />
          </div>
          <Form.Select
            field='channelIds'
            placeholder={t('渠道（留空 = 全部）')}
            optionList={channelOptions}
            className='w-full'
            multiple
            maxTagCount={3}
            filter
            showClear
            pure
            size='small'
          />
          <Form.Input
            field='modelName'
            prefix={<IconSearch />}
            placeholder={t('模型名称')}
            showClear
            pure
            size='small'
          />
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading}
            size='small'
          >
            {t('查询')}
          </Button>
          <Button type='tertiary' onClick={resetFilter} size='small'>
            {t('重置')}
          </Button>
          <Button
            type='tertiary'
            onClick={exportMonth}
            loading={exporting}
            disabled={exporting}
            size='small'
          >
            {t('导出')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default ReconcileFilters;
