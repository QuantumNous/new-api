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
import {
  Form,
  Input,
  Select,
  Button,
  Space,
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';

const DeploymentsFilters = ({
  formInitValues,
  setFormApi,
  searchDeployments,
  loading,
  searching,
  t,
}) => {
  const handleSubmit = (values) => {
    searchDeployments(values);
  };

  const handleReset = (formApi) => {
    formApi.reset();
    formApi.submitForm();
  };

  const statusOptions = [
    { label: t('全部状态'), value: '' },
    { label: t('运行中'), value: 'running' },
    { label: t('部署中'), value: 'deploying' },
    { label: t('已停止'), value: 'stopped' },
    { label: t('错误'), value: 'error' },
    { label: t('待部署'), value: 'pending' },
  ];

  return (
    <Form
      layout='horizontal'
      onSubmit={handleSubmit}
      initValues={formInitValues}
      getFormApi={(formApi) => setFormApi(formApi)}
      className='w-full'
    >
      <div className='flex flex-col lg:flex-row gap-2 w-full'>
        <div className='flex flex-col sm:flex-row gap-2 flex-1'>
          <Form.Input
            field='searchKeyword'
            placeholder={t('搜索部署名称或模型名称')}
            prefix={<IconSearch />}
            className='flex-1'
            showClear
          />
          
          <Form.Select
            field='searchStatus'
            placeholder={t('选择状态')}
            optionList={statusOptions}
            className='w-full sm:w-40'
            showClear
          />
        </div>

        <div className='flex gap-2'>
          <Button
            htmlType='submit'
            theme='solid'
            type='primary'
            icon={<IconSearch />}
            loading={searching}
            disabled={loading}
          >
            {t('搜索')}
          </Button>
          
          <Button
            theme='outline'
            type='secondary'
            icon={<IconRefresh />}
            onClick={(e, formApi) => handleReset(formApi)}
            disabled={loading || searching}
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default DeploymentsFilters;