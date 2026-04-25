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
  FilterSelect,
  useTableFilterForm,
} from '../../common/ui/TableFilterForm';

const UsersFilters = ({
  formInitValues,
  setFormApi,
  searchUsers,
  loadUsers,
  activePage,
  pageSize,
  groupOptions,
  loading,
  searching,
  t,
}) => {
  const { values, setFieldValue, handleSubmit, api } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: () => {
      searchUsers(1, pageSize);
    },
  });

  const handleReset = () => {
    api.reset();
    setTimeout(() => {
      loadUsers(1, pageSize);
    }, 100);
  };

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete='off'
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-64'>
          <FilterInput
            value={values.searchKeyword}
            onChange={(value) => setFieldValue('searchKeyword', value)}
            placeholder={t('支持搜索用户的 ID、用户名、显示名称和邮箱地址')}
          />
        </div>
        <div className='w-full md:w-48'>
          <FilterSelect
            value={values.searchGroup}
            onChange={(value) => {
              setFieldValue('searchGroup', value);
              setTimeout(() => {
                searchUsers(1, pageSize);
              }, 100);
            }}
            placeholder={t('选择分组')}
            options={groupOptions}
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

export default UsersFilters;
