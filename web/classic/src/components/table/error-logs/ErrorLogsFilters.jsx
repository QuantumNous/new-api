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

const ErrorLogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  setShowColumnSelector,
  formApi,
  loading,
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

          <Form.Select
            field='error_category'
            placeholder={t('错误分类')}
            className='w-full'
            showClear
            pure
            size='small'
            onChange={() => {
              setTimeout(() => {
                refresh();
              }, 0);
            }}
          >
            <Form.Select.Option value=''>{t('全部类型')}</Form.Select.Option>
            <Form.Select.Option value='auth'>
              {t('鉴权失败')}
            </Form.Select.Option>
            <Form.Select.Option value='rate_limit'>
              {t('限流')}
            </Form.Select.Option>
            <Form.Select.Option value='channel'>{t('渠道')}</Form.Select.Option>
            <Form.Select.Option value='validation'>
              {t('校验')}
            </Form.Select.Option>
            <Form.Select.Option value='quota'>{t('额度')}</Form.Select.Option>
            <Form.Select.Option value='upstream'>
              {t('上游错误')}
            </Form.Select.Option>
            <Form.Select.Option value='other'>{t('其他')}</Form.Select.Option>
          </Form.Select>

          <Form.Input
            field='username'
            prefix={<IconSearch />}
            placeholder={t('用户名称')}
            showClear
            pure
            size='small'
          />

          <Form.Input
            field='token_name'
            prefix={<IconSearch />}
            placeholder={t('令牌名称')}
            showClear
            pure
            size='small'
          />

          <Form.Input
            field='model_name'
            prefix={<IconSearch />}
            placeholder={t('模型名称')}
            showClear
            pure
            size='small'
          />

          <Form.Input
            field='channel'
            prefix={<IconSearch />}
            placeholder={t('渠道 ID')}
            showClear
            pure
            size='small'
          />

          <Form.Input
            field='request_id'
            prefix={<IconSearch />}
            placeholder={t('Request ID')}
            showClear
            pure
            size='small'
          />

          <Form.Input
            field='keyword'
            prefix={<IconSearch />}
            placeholder={t('关键词')}
            showClear
            pure
            size='small'
          />
        </div>

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

export default ErrorLogsFilters;
