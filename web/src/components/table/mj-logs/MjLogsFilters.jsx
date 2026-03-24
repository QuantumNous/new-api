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
import { Button, Form } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';
import FilterAutoComplete from '../../common/ui/FilterAutoComplete';

const parseDateRangeToUnixMilliseconds = (dateRange) => {
  if (!Array.isArray(dateRange) || dateRange.length !== 2) {
    return {
      start_timestamp: 0,
      end_timestamp: 0,
    };
  }
  return {
    start_timestamp: Date.parse(dateRange[0]) || 0,
    end_timestamp: Date.parse(dateRange[1]) || 0,
  };
};

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
  const suggestionEndpoint = isAdminUser
    ? '/api/mj/suggestions'
    : '/api/mj/self/suggestions';

  const buildSuggestionParams = () => {
    const values = formApi ? formApi.getValues() : formInitValues;
    const { start_timestamp, end_timestamp } = parseDateRangeToUnixMilliseconds(
      values.dateRange,
    );
    return {
      start_timestamp,
      end_timestamp,
      mj_id: values.mj_id || '',
      channel_id: values.channel_id || '',
    };
  };

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
          {/* 时间选择器 */}
          <div className='col-span-1 lg:col-span-2'>
            <Form.DatePicker
              field='dateRange'
              className='w-full'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              showClear
              pure
              size='small'
              presets={DATE_RANGE_PRESETS.map((preset) => ({
                text: t(preset.text),
                start: preset.start(),
                end: preset.end(),
              }))}
            />
          </div>

          {/* 任务 ID */}
          <FilterAutoComplete
            field='mj_id'
            endpoint={suggestionEndpoint}
            placeholder={t('任务 ID')}
            prefix={<IconSearch />}
            buildParams={buildSuggestionParams}
            minLength={1}
          />

          {/* 渠道 ID - 仅管理员可见 */}
          {isAdminUser && (
            <FilterAutoComplete
              field='channel_id'
              endpoint={suggestionEndpoint}
              placeholder={t('渠道 ID')}
              prefix={<IconSearch />}
              buildParams={buildSuggestionParams}
              minLength={1}
            />
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className='flex justify-between items-center'>
          <div></div>
          <div className='flex gap-2'>
            <Button
              type='tertiary'
              htmlType='submit'
              loading={loading}
              size='small'
            >
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => {
                if (formApi) {
                  formApi.reset();
                  setTimeout(() => {
                    refresh();
                  }, 100);
                }
              }}
              size='small'
            >
              {t('重置')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => setShowColumnSelector(true)}
              size='small'
            >
              {t('列设置')}
            </Button>
          </div>
        </div>
      </div>
    </Form>
  );
};

export default MjLogsFilters;
