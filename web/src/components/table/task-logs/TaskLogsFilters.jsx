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
  refresh,
  setShowColumnSelector,
  formApi,
  loading,
  isAdminUser,
  t,
}) => {
  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => setFormApi(api)}
      onSubmit={refresh}
      allowEmpty={true}
      autoComplete="off"
      layout="vertical"
      trigger="change"
      stopValidateWithError={false}
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* 时间选择器 */}
          <div className="col-span-1 lg:col-span-2">
            <Form.DatePicker
              field='dateRange'
              className="w-full"
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              showClear
              pure
              size="small"
            />
          </div>

          {/* 任务 ID */}
          <Form.Input
            field='task_id'
            prefix={<IconSearch />}
            placeholder={t('任务 ID')}
            showClear
            pure
            size="small"
          />

          {/* 渠道 ID - 仅管理员可见 */}
          {isAdminUser && (
            <Form.Input
              field='channel_id'
              prefix={<IconSearch />}
              placeholder={t('渠道 ID')}
              showClear
              pure
              size="small"
            />
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex gap-2">
            <Button
              type='tertiary'
              htmlType='submit'
              loading={loading}
              size="small"
            >
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => {
                if (formApi) {
                  formApi.reset();
                  // 重置后立即查询，使用setTimeout确保表单重置完成
                  setTimeout(() => {
                    refresh();
                  }, 100);
                }
              }}
              size="small"
            >
              {t('重置')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => setShowColumnSelector(true)}
              size="small"
            >
              {t('列设置')}
            </Button>
          </div>
        </div>
      </div>
    </Form>
  );
};

export default TaskLogsFilters; 