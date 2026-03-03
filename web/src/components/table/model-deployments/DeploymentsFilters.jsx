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

import React, { useRef } from 'react';
import { Form, Button } from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';

const DeploymentsFilters = ({
  formInitValues,
  setFormApi,
  searchDeployments,
  loading,
  searching,
  setShowColumnSelector,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleSubmit = (values) => {
    searchDeployments(values);
  };

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      formApiRef.current.submitForm();
    }, 0);
  };

  const statusOptions = [
    { label: t('全部状态'), value: '' },
    { label: t('运行中'), value: 'running' },
    { label: t('已完成'), value: 'completed' },
    { label: t('失败'), value: 'failed' },
    { label: t('部署请求中'), value: 'deployment requested' },
    { label: t('终止请求中'), value: 'termination requested' },
    { label: t('已销毁'), value: 'destroyed' },
  ];

  return (
    <Form
      layout='horizontal'
      onSubmit={handleSubmit}
      initValues={formInitValues}
      getFormApi={(formApi) => {
        setFormApi(formApi);
        formApiRef.current = formApi;
      }}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='w-full md:w-64'>
          <Form.Input
            field='searchKeyword'
            placeholder={t('搜索部署名称')}
            prefix={<IconSearch />}
            showClear
            size='small'
            pure
          />
        </div>

        <div className='w-full md:w-48'>
          <Form.Select
            field='searchStatus'
            placeholder={t('选择状态')}
            optionList={statusOptions}
            className='w-full'
            showClear
            size='small'
            pure
          />
        </div>

        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            htmlType='submit'
            type='tertiary'
            icon={<IconSearch />}
            loading={searching}
            disabled={loading}
            size='small'
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('查询')}
          </Button>

          <Button
            type='tertiary'
            icon={<IconRefresh />}
            onClick={handleReset}
            disabled={loading || searching}
            size='small'
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('重置')}
          </Button>

          <Button
            type='tertiary'
            onClick={() => setShowColumnSelector(true)}
            size='small'
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('列设置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default DeploymentsFilters;
