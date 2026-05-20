import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, List, Spin } from '@douyinfe/semi-ui';
import { Plus, Trash2, MessageSquare } from 'lucide-react';

const DrawingSessionList = ({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onCreate,
  loading,
}) => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col h-full p-3'>
      <Button
        icon={<Plus size={16} />}
        theme='solid'
        className='w-full mb-3'
        onClick={onCreate}
      >
        {t('新建会话')}
      </Button>

      {loading ? (
        <div className='flex justify-center py-8'>
          <Spin />
        </div>
      ) : (
        <div className='flex-1 overflow-auto'>
          <List
            dataSource={sessions}
            renderItem={(item) => (
              <div
                key={item.session_id}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer mb-1 group transition-colors ${
                  activeSessionId === item.session_id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelect(item.session_id)}
              >
                <div className='flex items-center gap-2 flex-1 min-w-0'>
                  <MessageSquare size={14} className='flex-shrink-0 text-gray-400' />
                  <span className='truncate text-sm'>
                    {item.title || t('未命名会话')}
                  </span>
                </div>
                <Button
                  icon={<Trash2 size={14} />}
                  type='tertiary'
                  theme='borderless'
                  size='small'
                  className='opacity-0 group-hover:opacity-100 flex-shrink-0'
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.session_id);
                  }}
                />
              </div>
            )}
            emptyContent={
              <div className='text-center text-gray-400 py-8 text-sm'>
                {t('暂无会话')}
              </div>
            }
          />
        </div>
      )}
    </div>
  );
};

export default DrawingSessionList;
