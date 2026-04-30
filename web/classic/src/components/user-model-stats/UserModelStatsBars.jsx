import React from 'react';
import { Progress, Tag } from '@douyinfe/semi-ui';

export const UserModelStatsBars = ({ items = [], activeTab, t }) => {
  if (!items.length) {
    return null;
  }

  const keyName = activeTab === 'byModel' ? 'model_name' : 'username';
  const top = [...items].sort((a, b) => (b.token_used || 0) - (a.token_used || 0)).slice(0, 8);
  const maxValue = top[0]?.token_used || 1;

  return (
    <div className='mb-4 rounded border border-gray-100 p-3'>
      <div className='mb-2 text-sm font-medium'>{t('总 Tokens Top 分布')}</div>
      <div className='space-y-2'>
        {top.map((item, idx) => {
          const ratio = Math.round(((item.token_used || 0) / maxValue) * 100);
          return (
            <div key={`${item[keyName]}-${idx}`}>
              <div className='mb-1 flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  {keyName === 'model_name' ? <Tag type='light'>{item[keyName]}</Tag> : <span>{item[keyName]}</span>}
                </div>
                <span>{item.token_used || 0}</span>
              </div>
              <Progress percent={ratio} showInfo={false} stroke='#4f46e5' />
            </div>
          );
        })}
      </div>
    </div>
  );
};
