import React from 'react';
import { useTranslation } from 'react-i18next';
import { Spin } from '@douyinfe/semi-ui';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';

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
    <div className='flex flex-col h-full'>
      <div className='px-3 pt-4 pb-2 flex-shrink-0'>
        <button
          onClick={onCreate}
          className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer'
          style={{ color: 'var(--semi-color-text-0)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = 'var(--semi-color-fill-0)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = 'transparent')
          }
        >
          <Plus size={15} />
          {t('新建会话')}
        </button>
      </div>

      <div className='flex-1 overflow-auto px-3 pb-4'>
        {loading ? (
          <div className='flex justify-center py-8'>
            <Spin size='small' />
          </div>
        ) : sessions.length === 0 ? (
          <p
            className='text-center text-xs py-8'
            style={{ color: 'var(--semi-color-text-2)' }}
          >
            {t('暂无会话')}
          </p>
        ) : (
          <div className='space-y-0.5'>
            {sessions.map((item) => {
              const isActive = activeSessionId === item.session_id;
              const imageCount = Number(item.image_count || 0);
              return (
                <div
                  key={item.session_id}
                  onClick={() => onSelect(item.session_id)}
                  className='group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors'
                  style={{
                    background: isActive
                      ? 'var(--semi-color-primary-light-default)'
                      : 'transparent',
                    color: isActive
                      ? 'var(--semi-color-primary)'
                      : 'var(--semi-color-text-1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        'var(--semi-color-fill-0)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <ImageIcon size={14} className='flex-shrink-0 opacity-60' />
                  <span className='flex-1 truncate text-sm'>
                    {item.title || t('未命名会话')}
                  </span>
                  <span
                    className='inline-flex h-6 min-w-9 flex-shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-xs'
                    style={{
                      color: 'var(--semi-color-text-2)',
                      background: 'var(--semi-color-fill-0)',
                    }}
                    title={t('生成图片数')}
                    aria-label={t('生成图片数')}
                  >
                    <ImageIcon size={12} />
                    <span>{imageCount}</span>
                  </span>
                  <button
                    className='flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors'
                    style={{ color: 'var(--semi-color-danger)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.session_id);
                    }}
                    aria-label={t('删除会话')}
                    title={t('删除会话')}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        'var(--semi-color-danger-light-default)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingSessionList;
