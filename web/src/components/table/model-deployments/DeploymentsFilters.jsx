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
import { Button } from '@heroui/react';
import { RefreshCw, Search } from 'lucide-react';
import {
  FilterInput,
  FilterSelect,
  useTableFilterForm,
} from '../../common/ui/TableFilterForm';

const DeploymentsFilters = ({
  formInitValues,
  setFormApi,
  searchDeployments,
  loading,
  searching,
  setShowColumnSelector,
  t,
}) => {
  const { values, setFieldValue, handleSubmit, api } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: searchDeployments,
  });

  const handleReset = () => {
    api.reset();
    setTimeout(() => {
      searchDeployments(formInitValues);
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
    <form
      onSubmit={handleSubmit}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='w-full md:w-64'>
          <FilterInput
            value={values.searchKeyword}
            onChange={(value) => setFieldValue('searchKeyword', value)}
            placeholder={t('搜索部署名称')}
          />
        </div>

        <div className='w-full md:w-48'>
          <FilterSelect
            value={values.searchStatus}
            onChange={(value) => setFieldValue('searchStatus', value)}
            placeholder={t('选择状态')}
            options={statusOptions}
          />
        </div>

        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='submit'
            variant='outline'
            isPending={searching}
            isDisabled={loading}
            size='sm'
            className='flex-1 md:flex-initial md:w-auto'
          >
            <Search size={15} />
            {t('查询')}
          </Button>

          <Button
            type='button'
            variant='outline'
            onPress={handleReset}
            isDisabled={loading || searching}
            size='sm'
            className='flex-1 md:flex-initial md:w-auto'
          >
            <RefreshCw size={15} />
            {t('重置')}
          </Button>

          <Button
            type='button'
            variant='outline'
            onPress={() => setShowColumnSelector(true)}
            size='sm'
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('列设置')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default DeploymentsFilters;
