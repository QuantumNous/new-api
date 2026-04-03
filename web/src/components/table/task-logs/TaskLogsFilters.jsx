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

const TaskLogsFilters = ({
  formInitValues,
  setFormApi,
  handleSearchSubmit,
  handleResetFilters,
  setShowColumnSelector,
  loading,
  statsLoading,
  isAdminUser,
  t,
}) => {
  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => setFormApi(api)}
      onSubmit={handleSearchSubmit}
      allowEmpty={true}
      autoComplete='off'
      layout='vertical'
      trigger='change'
      stopValidateWithError={false}
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4'>
          <div className='col-span-1 lg:col-span-2'>
            <Form.DatePicker
              field='dateRange'
              className='w-full'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              showClear
              pure
              size='small'
            />
          </div>

          <Form.Input
            field='task_id'
            prefix={<IconSearch />}
            placeholder={t('任务 ID')}
            showClear
            pure
            size='small'
          />

          {isAdminUser && (
            <Form.Input
              field='channel_id'
              prefix={<IconSearch />}
              placeholder={t('渠道 ID')}
              showClear
              pure
              size='small'
            />
          )}
        </div>

        <div className='flex items-center justify-end gap-2'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || statsLoading}
            size='small'
          >
            {t('查询')}
          </Button>
          <Button type='tertiary' onClick={handleResetFilters} size='small'>
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
    </Form>
  );
};

export default TaskLogsFilters;
