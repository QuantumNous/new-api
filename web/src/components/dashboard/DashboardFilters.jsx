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
import { Button, DatePicker, Input, Select } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const DashboardFilters = ({
  inputs,
  dataExportDefaultTime,
  timeOptions,
  dimensionOptions,
  metricOptions,
  handleInputChange,
  handleSearch,
  handleReset,
  loading,
  isAdminUser,
  t,
}) => {
  return (
    <div className='mb-4 rounded-xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] p-4'>
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6'>
          <Select
            value={inputs.analysis_dimension}
            optionList={dimensionOptions}
            placeholder={t('分组维度')}
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'analysis_dimension')}
          />

          <Select
            value={inputs.analysis_metric}
            optionList={metricOptions}
            placeholder={t('统计口径')}
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'analysis_metric')}
          />

          <DatePicker
            value={inputs.start_timestamp}
            type='dateTime'
            placeholder={t('起始时间')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'start_timestamp')}
          />

          <DatePicker
            value={inputs.end_timestamp}
            type='dateTime'
            placeholder={t('结束时间')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'end_timestamp')}
          />

          <Select
            value={dataExportDefaultTime}
            optionList={timeOptions}
            placeholder={t('时间粒度')}
            showClear
            pure
            size='small'
            onChange={(value) =>
              handleInputChange(value, 'data_export_default_time')
            }
          />

          {isAdminUser && (
            <Input
              value={inputs.username}
              prefix={<IconSearch />}
              placeholder={t('用户名称')}
              showClear
              pure
              size='small'
              onChange={(value) => handleInputChange(value, 'username')}
            />
          )}

          <Input
            value={inputs.model_name}
            placeholder={t('模型')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'model_name')}
          />

          <Input
            value={inputs.provider_key_id}
            placeholder={t('上游 Key ID')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'provider_key_id')}
          />

          <Input
            value={inputs.channel}
            placeholder={t('渠道 ID')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'channel')}
          />

          <Input
            value={inputs.token_id}
            placeholder={t('令牌 ID')}
            showClear
            pure
            size='small'
            onChange={(value) => handleInputChange(value, 'token_id')}
          />
        </div>

        <div className='text-xs text-[var(--semi-color-text-2)]'>
          {t(
            '分组维度决定图表按模型、上游 Key、渠道或令牌中的哪一类聚合；统计口径决定查看原价还是成本价',
          )}
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='tertiary'
            size='small'
            loading={loading}
            onClick={handleSearch}
          >
            {t('查询')}
          </Button>
          <Button type='tertiary' size='small' onClick={handleReset}>
            {t('重置')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;
