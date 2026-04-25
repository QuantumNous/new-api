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
import {
  FilterInput,
  useTableFilterForm,
} from '../../common/ui/TableFilterForm';

const ModelsFilters = ({
  formInitValues,
  setFormApi,
  searchModels,
  loading,
  searching,
  t,
}) => {
  const { values, setFieldValue, handleSubmit, api } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: searchModels,
  });

  const handleReset = () => {
    api.reset();
    setTimeout(() => {
      searchModels();
    }, 100);
  };

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete='off'
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-56'>
          <FilterInput
            value={values.searchKeyword}
            onChange={(value) => setFieldValue('searchKeyword', value)}
            placeholder={t('搜索模型名称')}
          />
        </div>

        <div className='relative w-full md:w-56'>
          <FilterInput
            value={values.searchVendor}
            onChange={(value) => setFieldValue('searchVendor', value)}
            placeholder={t('搜索供应商')}
          />
        </div>

        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='submit'
            variant='outline'
            isPending={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='sm'
          >
            {t('查询')}
          </Button>

          <Button
            type='button'
            variant='outline'
            onPress={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
            size='sm'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ModelsFilters;
