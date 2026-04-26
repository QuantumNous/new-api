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

const TokensFilters = ({
  formInitValues,
  setFormApi,
  searchTokens,
  loading,
  searching,
  t,
}) => {
  const { values, setFieldValue, handleSubmit, api } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: () => searchTokens(1),
  });

  const handleReset = () => {
    api.reset();
    setTimeout(() => {
      searchTokens();
    }, 100);
  };

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete='off'
      className='w-full xl:w-auto order-1 xl:order-2'
    >
      <div className='flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-2 w-full xl:w-auto'>
        <div className='relative w-full sm:flex-1 xl:flex-initial xl:w-56'>
          <FilterInput
            value={values.searchKeyword}
            onChange={(value) => setFieldValue('searchKeyword', value)}
            placeholder={t('搜索关键字')}
          />
        </div>

        <div className='relative w-full sm:flex-1 xl:flex-initial xl:w-56'>
          <FilterInput
            value={values.searchToken}
            onChange={(value) => setFieldValue('searchToken', value)}
            placeholder={t('密钥')}
          />
        </div>

        <div className='flex gap-2 w-full sm:w-auto'>
          <Button
            type='submit'
            variant='outline'
            isPending={loading || searching}
            className='flex-1 sm:flex-initial sm:w-auto text-sm'
            size='sm'
          >
            {t('查询')}
          </Button>

          <Button
            type='button'
            variant='outline'
            onPress={handleReset}
            className='flex-1 sm:flex-initial sm:w-auto text-sm'
            size='sm'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default TokensFilters;
