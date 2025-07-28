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
              size="small"
            />
          </div>

          {/* 其他搜索字段 */}
          <Form.Input
            field='token_name'
            prefix={<IconSearch />}
            placeholder={t('令牌名称')}
            showClear
            pure
            size="small"
          />

          <Form.Input
            field='model_name'
            prefix={<IconSearch />}
            placeholder={t('模型名称')}
            showClear
            pure
            size="small"
          />

          <Form.Input
            field='group'
            prefix={<IconSearch />}
            placeholder={t('分组')}
            showClear
            pure
            size="small"
          />

          {isAdminUser && (
            <>
              <Form.Input
                field='channel'
                prefix={<IconSearch />}
                placeholder={t('渠道 ID')}
                showClear
                pure
                size="small"
              />
              <Form.Input
                field='username'
                prefix={<IconSearch />}
                placeholder={t('用户名称')}
                showClear
                pure
                size="small"
              />
            </>
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3'>
          {/* 日志类型选择器 */}
          <div className='w-full sm:w-auto'>
            <Form.Select
              field='logType'
              placeholder={t('日志类型')}
              className='w-full sm:w-auto min-w-[120px]'
              showClear
              pure
              onChange={() => {
                // 延迟执行搜索，让表单值先更新
                setTimeout(() => {
                  refresh();
                }, 0);
              }}
              size="small"
            >
              <Form.Select.Option value='0'>
                {t('全部')}
              </Form.Select.Option>
              <Form.Select.Option value='1'>
                {t('充值')}
              </Form.Select.Option>
              <Form.Select.Option value='2'>
                {t('消费')}
              </Form.Select.Option>
              <Form.Select.Option value='3'>
                {t('管理')}
              </Form.Select.Option>
              <Form.Select.Option value='4'>
                {t('系统')}
              </Form.Select.Option>
              <Form.Select.Option value='5'>
                {t('错误')}
              </Form.Select.Option>
            </Form.Select>
          </div>

          <div className='flex gap-2 w-full sm:w-auto justify-end'>
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
                  setLogType(0);
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

export default LogsFilters; 