import React from 'react';
import { Button, DatePicker, TagInput } from '@douyinfe/semi-ui';
import { Download, Search } from 'lucide-react';

export const UserModelStatsFilters = ({
  inputs,
  onInputChange,
  onSearch,
  onExport,
  t,
}) => {
  return (
    <div className='flex flex-wrap items-center gap-3 mb-4'>
      <DatePicker
        type='dateTimeRange'
        value={[inputs.start_timestamp, inputs.end_timestamp]}
        onChange={(val) => {
          if (Array.isArray(val) && val.length === 2) {
            onInputChange('start_timestamp', val[0]);
            onInputChange('end_timestamp', val[1]);
          }
        }}
        style={{ width: 320 }}
      />
      <TagInput
        placeholder={t('用户名')}
        value={inputs.username ? inputs.username.split(',').filter(Boolean) : []}
        onChange={(v) => onInputChange('username', Array.isArray(v) ? v.join(',') : '')}
        style={{ width: 200 }}
      />
      <TagInput
        placeholder={t('模型名')}
        value={inputs.model_name ? inputs.model_name.split(',').filter(Boolean) : []}
        onChange={(v) => onInputChange('model_name', Array.isArray(v) ? v.join(',') : '')}
        style={{ width: 200 }}
      />
      <TagInput
        placeholder={t('用户分组')}
        value={inputs.user_group ? inputs.user_group.split(',').filter(Boolean) : []}
        onChange={(v) => onInputChange('user_group', Array.isArray(v) ? v.join(',') : '')}
        style={{ width: 200 }}
      />
      <Button theme='solid' icon={<Search size={14} />} onClick={onSearch}>
        {t('查询')}
      </Button>
      <Button icon={<Download size={14} />} onClick={onExport} style={{ marginLeft: 'auto' }}>
        {t('导出 CSV')}
      </Button>
    </div>
  );
};
