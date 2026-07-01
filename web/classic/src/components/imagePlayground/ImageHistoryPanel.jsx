import React from 'react';
import { Card, Button, Typography, Tag, Empty } from '@douyinfe/semi-ui';
import { Plus, Trash2, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  IMAGE_GEN_STATUS,
  IMAGE_HISTORY_LIMIT,
} from '../../constants/imagePlayground.constants';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const statusMeta = (status, t) => {
  switch (status) {
    case IMAGE_GEN_STATUS.SUCCESS:
      return { color: 'green', text: t('已完成') };
    case IMAGE_GEN_STATUS.FAILED:
      return { color: 'red', text: t('失败') };
    default:
      return { color: 'blue', text: t('生成中') };
  }
};

// 从一段对话里提取展示信息：标题、最新状态、成功图片数
const convSummary = (conv) => {
  const assistants = (conv.messages || []).filter(
    (m) => m.role === 'assistant',
  );
  const last = assistants[assistants.length - 1];
  const imageCount = assistants.reduce(
    (acc, m) => acc + (m.images ? m.images.length : 0),
    0,
  );
  return {
    title: conv.title || assistants[0]?.prompt || '',
    status: last ? last.status : IMAGE_GEN_STATUS.PENDING,
    imageCount,
    time: conv.updatedAt || conv.createdAt,
  };
};

const ImageHistoryPanel = ({
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
      {/* 新对话 */}
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

      {/* 历史标题 */}
      <div className='flex items-center justify-between mb-3 flex-shrink-0'>
        <div className='flex items-baseline gap-1.5'>
          <Typography.Title heading={6} className='mb-0'>
            {t('对话历史')}
          </Typography.Title>
          <Typography.Text type='tertiary' style={{ fontSize: 11 }}>
            {t('（仅保留近 {{count}} 次）', { count: IMAGE_HISTORY_LIMIT })}
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

      {/* 历史列表 */}
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
            const meta = statusMeta(summary.status, t);
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
                  <div className='flex items-center gap-2'>
                    <Tag size='small' color={meta.color} shape='circle'>
                      {meta.text}
                    </Tag>
                    {summary.imageCount > 0 && (
                      <Typography.Text className='text-xs text-gray-400'>
                        {t('{{count}} 张', { count: summary.imageCount })}
                      </Typography.Text>
                    )}
                  </div>
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

export default ImageHistoryPanel;
