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

const ChannelsFilters = ({
  setEditingChannel,
  setShowEdit,
  refresh,
  setShowColumnSelector,
  formInitValues,
  setFormApi,
  searchChannels,
  enableTagMode,
  groupOptions,
  loading,
  searching,
  t,
}) => {
  const { values, setFieldValue, handleSubmit, api } = useTableFilterForm({
    initValues: formInitValues,
    setFormApi,
    onSubmit: () => searchChannels(enableTagMode),
  });

  return (
    <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
      <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button
          size='sm'
          variant='primary'
          className='w-full md:w-auto'
          onPress={() => {
            setEditingChannel({
              id: undefined,
            });
            setShowEdit(true);
          }}
        >
          {t('添加渠道')}
        </Button>

        <Button
          size='sm'
          variant='outline'
          className='w-full md:w-auto'
          onPress={refresh}
        >
          {t('刷新')}
        </Button>

        <Button
          size='sm'
          variant='outline'
          onPress={() => setShowColumnSelector(true)}
          className='w-full md:w-auto'
        >
          {t('列设置')}
        </Button>
      </div>

      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto order-1 md:order-2'>
        <form
          onSubmit={handleSubmit}
          autoComplete='off'
          className='flex flex-col md:flex-row items-center gap-2 w-full'
        >
          <div className='relative w-full md:w-64'>
            <FilterInput
              value={values.searchKeyword}
              onChange={(value) => setFieldValue('searchKeyword', value)}
              placeholder={t('渠道ID，名称，密钥，API地址')}
            />
          </div>
          <div className='w-full md:w-48'>
            <FilterInput
              value={values.searchModel}
              onChange={(value) => setFieldValue('searchModel', value)}
              placeholder={t('模型关键字')}
            />
          </div>
          <div className='w-full md:w-32'>
            <FilterSelect
              value={values.searchGroup}
              onChange={(value) => {
                setFieldValue('searchGroup', value);
                setTimeout(() => {
                  searchChannels(enableTagMode);
                }, 0);
              }}
              placeholder={t('选择分组')}
              options={groupOptions}
            />
          </div>
          <Button
            size='sm'
            variant='outline'
            type='submit'
            isPending={loading || searching}
            className='w-full md:w-auto'
          >
            {t('查询')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            type='button'
            onPress={() => {
              api.reset();
              setTimeout(() => {
                refresh();
              }, 100);
            }}
            className='w-full md:w-auto'
          >
            {t('重置')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChannelsFilters;
