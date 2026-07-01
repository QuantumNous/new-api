import React from 'react';
import { Card, Button, Typography, Tag } from '@douyinfe/semi-ui';
import { Plus, Trash2, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  VIDEO_STATUS,
  VIDEO_HISTORY_LIMIT,
} from '../../constants/videoPlayground.constants';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const statusMeta = (status, progress, t) => {
  switch (status) {
    case VIDEO_STATUS.COMPLETED:
      return { color: 'green', text: t('已完成') };
    case VIDEO_STATUS.FAILED:
      return { color: 'red', text: t('失败') };
    case VIDEO_STATUS.CANCELED:
      return { color: 'grey', text: t('已取消') };
    case VIDEO_STATUS.IN_PROGRESS:
      return {
        color: 'blue',
        text:
          typeof progress === 'number' && progress > 0
            ? `${t('生成中')} ${progress}%`
            : t('生成中'),
      };
    default:
      return { color: 'blue', text: t('排队中') };
  }
};

const convSummary = (conv) => {
  const assistants = (conv.messages || []).filter(
    (m) => m.role === 'assistant',
  );
  const last = assistants[assistants.length - 1];
  return {
    title: conv.title || assistants[0]?.prompt || '',
    status: last ? last.status : VIDEO_STATUS.QUEUED,
    progress: last ? last.progress : 0,
    count: assistants.filter((m) => m.status === VIDEO_STATUS.COMPLETED).length,
    time: conv.updatedAt || conv.createdAt,
  };
};

const VideoHistoryPanel = ({
  history,
  onNewConversation,
  onClear,
  onDelete,
  onOpen,
  styleState,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      className='h-full flex flex-col'
      bordered={false}
      bodyStyle={{
        padding: styleState?.isMobile ? '16px' : '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Button
        theme='outline'
        type='primary'
        icon={<Plus size={16} />}
        onClick={onNewConversation}
        block
        className='!rounded-lg mb-4 flex-shrink-0'
      >
        {t('新对话')}
      </Button>

      <div className='flex items-center justify-between mb-3 flex-shrink-0'>
        <div className='flex items-baseline gap-1.5'>
          <Typography.Title heading={6} className='mb-0'>
            {t('对话历史')}
          </Typography.Title>
          <Typography.Text type='tertiary' style={{ fontSize: 11 }}>
            {t('（仅保留近 {{count}} 次）', { count: VIDEO_HISTORY_LIMIT })}
          </Typography.Text>
        </div>
        {history.length > 0 && (
          <Button
            theme='borderless'
            type='danger'
            size='small'
            icon={<Trash2 size={14} />}
            onClick={onClear}
          >
            {t('清空')}
          </Button>
        )}
      </div>

      <div className='flex-1 overflow-y-auto space-y-2 pg-history-scroll'>
        {history.length === 0 ? (
          <div className='h-full flex flex-col items-center justify-center text-gray-400'>
            <History size={32} className='mb-2' />
            <Typography.Text type='tertiary'>
              {t('暂无对话历史')}
            </Typography.Text>
          </div>
        ) : (
          history.map((item) => {
            const summary = convSummary(item);
            const meta = statusMeta(summary.status, summary.progress, t);
            return (
              <div
                key={item.id}
                onClick={() => onOpen(item)}
                className='p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition-colors'
              >
                <div className='flex items-start justify-between gap-2'>
                  <Typography.Text strong className='text-sm truncate flex-1'>
                    {item.model}
                  </Typography.Text>
                  <Button
                    theme='borderless'
                    type='tertiary'
                    size='small'
                    icon={<Trash2 size={14} />}
                    className='!text-gray-400 !p-0 !min-w-0'
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                  />
                </div>
                <Typography.Text
                  className='text-xs text-gray-500 block mt-1 truncate'
                  ellipsis={{ showTooltip: true }}
                >
                  {summary.title}
                </Typography.Text>
                <div className='flex items-center justify-between mt-2'>
                  <Tag size='small' color={meta.color} shape='circle'>
                    {meta.text}
                  </Tag>
                  <Typography.Text className='text-xs text-gray-400'>
                    {formatTime(summary.time)}
                  </Typography.Text>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default VideoHistoryPanel;
