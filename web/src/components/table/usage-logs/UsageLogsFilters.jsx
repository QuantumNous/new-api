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
import { useTranslation } from 'react-i18next';
import { Button, Form } from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch, IconSetting } from '@douyinfe/semi-icons';

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

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
  const { i18n } = useTranslation();

  const handleReset = () => {
    if (!formApi) {
      return;
    }
    formApi.reset();
    setLogType(0);
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
      className='log-filter-form'
    >
      <div className='log-filter-layout'>
        <div className='log-filter-grid'>
          <div className='log-filter-item log-filter-range'>
            <Form.DatePicker
              field='dateRange'
              className='log-filter-date'
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

          <div className='log-filter-item'>
            <Form.Input
              field='token_name'
              prefix={<IconSearch />}
              placeholder={t('令牌名称')}
              showClear
              pure
              size='default'
              className='log-filter-control'
            />
          </div>

          <div className='log-filter-item'>
            <Form.Input
              field='model_name'
              prefix={<IconSearch />}
              placeholder={t('模型名称')}
              showClear
              pure
              size='default'
              className='log-filter-control'
            />
          </div>

          <div className='log-filter-item'>
            <Form.Input
              field='group'
              prefix={<IconSearch />}
              placeholder={t('分组')}
              showClear
              pure
              size='default'
              className='log-filter-control'
            />
          </div>

          <div className='log-filter-item'>
            <Form.Input
              field='request_id'
              prefix={<IconSearch />}
              placeholder={t('Request ID')}
              showClear
              pure
              size='default'
              className='log-filter-control'
            />
          </div>

          {isAdminUser && (
            <>
              <div className='log-filter-item'>
                <Form.Input
                  field='channel'
                  prefix={<IconSearch />}
                  placeholder={t('渠道 ID')}
                  showClear
                  pure
                  size='default'
                  className='log-filter-control'
                />
              </div>
              <div className='log-filter-item'>
                <Form.Input
                  field='username'
                  prefix={<IconSearch />}
                  placeholder={t('用户名称')}
                  showClear
                  pure
                  size='default'
                  className='log-filter-control'
                />
              </div>
            </>
          )}
        </div>

        <div className='log-filter-toolbar'>
          <Form.Select
            key={`usage-log-type-select-${i18n.resolvedLanguage || i18n.language}`}
            field='logType'
            placeholder={t('选择日志类型')}
            className='log-filter-select'
            showClear
            pure
            onChange={() => {
              setTimeout(() => {
                refresh();
              }, 0);
            }}
            size='default'
          >
            <Form.Select.Option value='0'>{t('全部')}</Form.Select.Option>
            <Form.Select.Option value='1'>{t('充值')}</Form.Select.Option>
            <Form.Select.Option value='2'>{t('消费')}</Form.Select.Option>
            <Form.Select.Option value='3'>{t('管理')}</Form.Select.Option>
            <Form.Select.Option value='4'>{t('系统')}</Form.Select.Option>
            <Form.Select.Option value='5'>{t('错误')}</Form.Select.Option>
            <Form.Select.Option value='6'>{t('退款')}</Form.Select.Option>
          </Form.Select>

          <div className='log-filter-actions'>
            <Button
              type='primary'
              theme='solid'
              htmlType='submit'
              loading={loading}
              size='default'
              icon={<IconSearch />}
              className='log-filter-button log-filter-button-primary'
            >
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              onClick={handleReset}
              size='default'
              icon={<IconRefresh />}
              className='log-filter-button'
            >
              {t('重置')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => setShowColumnSelector(true)}
              size='default'
              icon={<IconSetting />}
              className='log-filter-button'
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
