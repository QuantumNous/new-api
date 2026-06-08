import React, { useMemo } from 'react';
import { Button, DatePicker, Input, Select } from '@douyinfe/semi-ui';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';
import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';
import { selectFilter } from '../../../helpers';

const PreparationFilters = ({
  t,
  keyword,
  setKeyword,
  group,
  setGroup,
  groupOptions,
  dateRange,
  setDateRange,
  type,
  setType,
  total,
  preparationStats,
  handleSearch,
}) => {
  const formattedBalanceTotal = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 6,
      }).format(Number(preparationStats?.balance_total) || 0),
    [preparationStats?.balance_total],
  );

  return (
    <div className='flex flex-col xl:flex-row xl:items-center gap-2 w-full'>
      <div className='flex flex-col md:flex-row items-center gap-2 w-full xl:flex-1'>
        <Input
          size='small'
          placeholder={t('搜索名称 / Key / 备注')}
          value={keyword}
          onChange={setKeyword}
          onEnterPress={handleSearch}
          className='w-full md:w-56'
        />
        <Select
          size='small'
          placeholder={t('分组')}
          value={group || undefined}
          onChange={(value) => setGroup(value || '')}
          optionList={groupOptions || []}
          filter={selectFilter}
          showClear
          className='w-full md:w-36'
        />
        <DatePicker
          size='small'
          type='dateTimeRange'
          placeholder={[t('开始时间'), t('结束时间')]}
          value={dateRange}
          onChange={(value) => setDateRange(value || [])}
          showClear
          presets={DATE_RANGE_PRESETS.map((preset) => ({
            text: t(preset.text),
            start: preset.start(),
            end: preset.end(),
          }))}
          className='w-full md:w-72'
        />
        <Select
          size='small'
          placeholder={t('渠道类型')}
          value={type}
          onChange={setType}
          showClear
          className='w-full md:w-48'
        >
          {CHANNEL_OPTIONS.map((option) => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
        <Button size='small' type='primary' onClick={handleSearch}>
          {t('搜索')}
        </Button>
      </div>
      <div className='flex items-center gap-2 text-xs text-gray-600 xl:ml-2 xl:shrink-0'>
        <span className='rounded bg-gray-50 px-2.5 py-1'>
          {t('渠道数')}{' '}
          <span className='font-semibold text-gray-900'>{total || 0}</span>
        </span>
        <span className='rounded bg-gray-50 px-2.5 py-1'>
          {t('总余额')}{' '}
          <span className='font-semibold text-gray-900'>
            {formattedBalanceTotal}
          </span>
        </span>
      </div>
    </div>
  );
};

export default PreparationFilters;
