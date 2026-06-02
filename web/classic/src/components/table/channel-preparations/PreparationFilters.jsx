import React from 'react';
import { Button, Input, Select } from '@douyinfe/semi-ui';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';

const PreparationFilters = ({
  t,
  keyword,
  setKeyword,
  group,
  setGroup,
  type,
  setType,
  handleSearch,
}) => {
  return (
    <div className='flex flex-col md:flex-row items-center gap-2 w-full'>
      <Input
        size='small'
        placeholder={t('搜索名称 / Key / 备注')}
        value={keyword}
        onChange={setKeyword}
        onEnterPress={handleSearch}
        className='w-full md:w-56'
      />
      <Input
        size='small'
        placeholder={t('分组')}
        value={group}
        onChange={setGroup}
        onEnterPress={handleSearch}
        className='w-full md:w-36'
      />
      <Select
        size='small'
        placeholder={t('渠道类型')}
        value={type}
        onChange={setType}
        showClear
        className='w-full md:w-48'
      >
        {CHANNEL_OPTIONS.map((option) => (
          <Select.Option key={option.value} value={option.value}>
            {option.label}
          </Select.Option>
        ))}
      </Select>
      <Button size='small' type='primary' onClick={handleSearch}>
        {t('搜索')}
      </Button>
    </div>
  );
};

export default PreparationFilters;
