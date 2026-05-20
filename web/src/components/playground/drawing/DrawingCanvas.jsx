import React from 'react';
import { useTranslation } from 'react-i18next';
import { Spin } from '@douyinfe/semi-ui';
import { Image, AlertCircle, Loader } from 'lucide-react';
import DrawingImageCard from './DrawingImageCard';

const DrawingCanvas = ({ messages, loading, activeSessionId }) => {
  const { t } = useTranslation();

  if (!activeSessionId) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-400'>
        <Image size={48} className='mb-4' />
        <p className='text-lg'>{t('选择或创建一个会话开始绘图')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center h-full'>
        <Spin size='large' />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-400'>
        <Image size={48} className='mb-4' />
        <p>{t('输入提示词开始生成图片')}</p>
      </div>
    );
  }

  return (
    <div className='p-4 space-y-4'>
      {messages.map((msg) => (
        <div key={msg.id || msg.task_id} className='space-y-2'>
          {/* User prompt */}
          <div className='flex justify-end'>
            <div className='max-w-[80%] bg-blue-50 rounded-lg px-4 py-3'>
              <p className='text-sm text-gray-800'>{msg.prompt}</p>
              <div className='flex gap-2 mt-1 text-xs text-gray-500'>
                <span>{msg.model}</span>
                <span>{msg.size}</span>
                <span>{msg.quality}</span>
              </div>
              {msg.image_urls && (
                <div className='mt-2 flex gap-1 flex-wrap'>
                  {(() => {
                    try {
                      const urls = typeof msg.image_urls === 'string'
                        ? JSON.parse(msg.image_urls)
                        : msg.image_urls;
                      return Array.isArray(urls) ? urls.map((url, i) => (
                        <img
                          key={i}
                          src={url.startsWith('data:') ? url : `data:image/png;base64,${url}`}
                          alt={`input-${i}`}
                          className='w-12 h-12 object-cover rounded'
                        />
                      )) : null;
                    } catch { return null; }
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {msg.status === 'processing' || msg.status === 'pending' ? (
            <div className='flex items-center gap-2 text-gray-500 text-sm'>
              <Loader size={14} className='animate-spin' />
              <span>{t('生成中...')}</span>
            </div>
          ) : msg.status === 'failure' ? (
            <div className='flex items-center gap-2 text-red-500 text-sm'>
              <AlertCircle size={14} />
              <span>{msg.fail_reason || t('生成失败')}</span>
            </div>
          ) : msg.status === 'success' && msg.result_data ? (
            <div className='flex flex-wrap gap-3'>
              {(() => {
                try {
                  const data = typeof msg.result_data === 'string'
                    ? JSON.parse(msg.result_data)
                    : msg.result_data;
                  return Array.isArray(data) ? data.map((item, i) => (
                    <DrawingImageCard key={i} imageData={item} />
                  )) : null;
                } catch { return null; }
              })()}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default DrawingCanvas;
