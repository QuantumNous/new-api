import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { API } from '../../../helpers';
import { DRAWING_API } from '../../../constants/drawing.constants';
import DrawingImageCard from './DrawingImageCard';

const DrawingCanvas = ({ messages, loading, activeSessionId }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCache, setImageCache] = useState({});
  const [imageLoading, setImageLoading] = useState(false);
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (messages.length > 0) setCurrentIndex(messages.length - 1);
    fetchedRef.current = new Set();
    setImageCache({});
  }, [activeSessionId]);

  useEffect(() => {
    if (messages.length > 0) setCurrentIndex(messages.length - 1);
  }, [messages.length]);

  const total = messages.length;
  const safeIndex = Math.min(currentIndex, total - 1);
  const msg = safeIndex >= 0 ? messages[safeIndex] : null;

  useEffect(() => {
    if (!msg || msg.status !== 'success') return;
    if (imageCache[msg.id] || fetchedRef.current.has(msg.id)) return;
    fetchedRef.current.add(msg.id);
    setImageLoading(true);
    API.get(DRAWING_API.MESSAGE_IMAGES(msg.session_id, msg.id))
      .then((res) => { if (res.data.success) setImageCache((prev) => ({ ...prev, [msg.id]: res.data.data })); })
      .catch(() => {})
      .finally(() => setImageLoading(false));
  }, [msg?.id, msg?.status]);

  const emptyState = (text) => (
    <div className='flex flex-col items-center justify-center h-full gap-4 px-6 text-center'>
      <div className='w-16 h-16 rounded-full flex items-center justify-center' style={{ background: 'var(--semi-color-fill-0)' }}>
        <Image size={28} style={{ color: 'var(--semi-color-text-2)' }} />
      </div>
      <p className='text-sm' style={{ color: 'var(--semi-color-text-2)' }}>{text}</p>
    </div>
  );

  if (!activeSessionId) return emptyState(t('选择或创建一个会话开始绘图'));
  if (loading) return (
    <div className='flex justify-center items-center h-full'>
      <Loader size={24} className='animate-spin' style={{ color: 'var(--semi-color-primary)' }} />
    </div>
  );
  if (!msg) return emptyState(t('输入提示词开始生成图片'));

  const goTo = (idx) => setCurrentIndex(Math.max(0, Math.min(idx, total - 1)));

  let resultImages = null;
  const cached = imageCache[msg.id];
  const resultDataSource = cached?.result_data ?? msg.result_data;
  if (resultDataSource) {
    try {
      const data = typeof resultDataSource === 'string' ? JSON.parse(resultDataSource) : resultDataSource;
      if (Array.isArray(data)) resultImages = data;
    } catch { /* ignore */ }
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      {total > 1 && (
        <div className='flex items-center justify-center gap-3 py-3 flex-shrink-0'>
          <button
            className='p-1.5 rounded-lg disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={() => goTo(safeIndex - 1)}
            disabled={safeIndex === 0}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--semi-color-fill-0)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronLeft size={16} />
          </button>
          <span className='text-xs min-w-[40px] text-center' style={{ color: 'var(--semi-color-text-2)' }}>
            {safeIndex + 1} / {total}
          </span>
          <button
            className='p-1.5 rounded-lg disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={() => goTo(safeIndex + 1)}
            disabled={safeIndex === total - 1}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--semi-color-fill-0)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className='flex-1 flex flex-col items-center justify-center px-6 min-h-0 gap-4'>
        {(msg.status === 'processing' || msg.status === 'pending') && (
          <div className='flex flex-col items-center gap-3'>
            <Loader size={28} className='animate-spin' style={{ color: 'var(--semi-color-primary)' }} />
            <span className='text-xs' style={{ color: 'var(--semi-color-text-2)' }}>{t('生成图片需要大约4-6分钟，请耐心等待')}</span>
          </div>
        )}

        {msg.status === 'failure' && (
          <div className='flex items-center gap-2 text-sm rounded-xl px-4 py-3 border' style={{
            color: 'var(--semi-color-danger)',
            background: 'var(--semi-color-danger-light-default)',
            borderColor: 'var(--semi-color-danger-light-active)',
          }}>
            <AlertCircle size={14} />
            <span>{msg.fail_reason || t('生成失败')}</span>
          </div>
        )}

        {msg.status === 'success' && (
          imageLoading && !resultImages
            ? <Loader size={24} className='animate-spin' style={{ color: 'var(--semi-color-primary)' }} />
            : resultImages && (
              <div className='w-full max-w-3xl grid gap-3' style={{ gridTemplateColumns: resultImages.length === 1 ? '1fr' : 'repeat(2, 1fr)' }}>
                {resultImages.map((item, i) => <DrawingImageCard key={i} imageData={item} />)}
              </div>
            )
        )}

        {msg.prompt && (
          <p className='text-xs text-center line-clamp-2 max-w-lg' style={{ color: 'var(--semi-color-text-2)' }}>{msg.prompt}</p>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;
