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
import { IconRefresh, IconSearch, IconSetting } from '@douyinfe/semi-icons';

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

const TaskLogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  setShowColumnSelector,
  formApi,
  loading,
  isAdminUser,
  t,
}) => {
  const handleReset = () => {
    if (!formApi) {
      return;
    }
    formApi.reset();
    setTimeout(() => {
      refresh();
    }, 100);
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
      className='task-filter-form'
    >
      <div className='task-filter-row'>
        <div className='task-filter-fields'>
          <div className='task-filter-item task-filter-range'>
            <Form.DatePicker
              field='dateRange'
              className='task-filter-date'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              showClear
              pure
              size='default'
              presets={DATE_RANGE_PRESETS.map((preset) => ({
                text: t(preset.text),
                start: preset.start(),
                end: preset.end(),
              }))}
            />
          </div>

          <div className='task-filter-item'>
            <Form.Input
              field='task_id'
              prefix={<IconSearch />}
              placeholder={t('任务 ID')}
              showClear
              pure
              size='default'
              className='task-filter-control'
            />
          </div>

          {isAdminUser && (
            <div className='task-filter-item'>
              <Form.Input
                field='channel_id'
                prefix={<IconSearch />}
                placeholder={t('渠道 ID')}
                showClear
                pure
                size='default'
                className='task-filter-control'
              />
            </div>
          )}
        </div>

        <div className='task-filter-actions'>
          <Button
            type='primary'
            theme='solid'
            htmlType='submit'
            loading={loading}
            size='default'
            icon={<IconSearch />}
            className='task-filter-button task-filter-button-primary'
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={handleReset}
            size='default'
            icon={<IconRefresh />}
            className='task-filter-button'
          >
            {t('重置')}
          </Button>
          <Button
            type='tertiary'
            onClick={() => setShowColumnSelector(true)}
            size='default'
            icon={<IconSetting />}
            className='task-filter-button'
          >
            {t('列设置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default TaskLogsFilters;
