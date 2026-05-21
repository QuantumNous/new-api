import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  AlertCircle,
  Loader,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { API } from '../../../helpers';
import { DRAWING_API } from '../../../constants/drawing.constants';
import DrawingImageCard from './DrawingImageCard';

const DrawingCanvas = ({
  messages,
  pageInfo,
  loading,
  activeSessionId,
  onLoadPrevious,
  onLoadNext,
  onRetry,
  retryDisabled = false,
}) => {
  const { t } = useTranslation();
  const [imageCache, setImageCache] = useState({});
  const [imageLoading, setImageLoading] = useState(false);
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    fetchedRef.current = new Set();
    setImageCache({});
  }, [activeSessionId]);

  const total = pageInfo?.total || 0;
  const currentIndex = pageInfo?.current_index || 0;
  const msg = messages[0] || null;
  const isGenerating =
    msg?.status === 'processing' || msg?.status === 'pending';

  useEffect(() => {
    if (!msg || msg.status !== 'success') return;
    if (imageCache[msg.id] || fetchedRef.current.has(msg.id)) return;
    fetchedRef.current.add(msg.id);
    setImageLoading(true);
    API.get(DRAWING_API.MESSAGE_IMAGES(msg.session_id, msg.id))
      .then((res) => {
        if (res.data.success)
          setImageCache((prev) => ({ ...prev, [msg.id]: res.data.data }));
      })
      .catch(() => {})
      .finally(() => setImageLoading(false));
  }, [msg?.id, msg?.status]);

  const emptyState = (text) => (
    <div className='flex flex-col items-center justify-center h-full gap-4 px-6 text-center'>
      <div
        className='w-16 h-16 rounded-full flex items-center justify-center'
        style={{ background: 'var(--semi-color-fill-0)' }}
      >
        <Image size={28} style={{ color: 'var(--semi-color-text-2)' }} />
      </div>
      <p className='text-sm' style={{ color: 'var(--semi-color-text-2)' }}>
        {text}
      </p>
    </div>
  );

  if (!activeSessionId) return emptyState(t('输入提示词开始生成图片'));
  if (loading && !msg)
    return (
      <div className='flex justify-center items-center h-full'>
        <Loader
          size={24}
          className='animate-spin'
          style={{ color: 'var(--semi-color-primary)' }}
        />
      </div>
    );
  if (!msg) return emptyState(t('输入提示词开始生成图片'));

  let resultImages = null;
  const cached = imageCache[msg.id];
  const resultDataSource = cached?.result_data ?? msg.result_data;
  if (resultDataSource) {
    try {
      const data =
        typeof resultDataSource === 'string'
          ? JSON.parse(resultDataSource)
          : resultDataSource;
      if (Array.isArray(data)) resultImages = data;
    } catch {
      /* ignore */
    }
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      {total > 1 && (
        <div className='relative z-10 flex flex-shrink-0 items-center justify-center gap-3 pb-3 pt-1'>
          <button
            className='p-1.5 rounded-lg disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={onLoadPrevious}
            disabled={loading || !pageInfo?.has_prev}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--semi-color-fill-0)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className='text-xs min-w-[40px] text-center'
            style={{ color: 'var(--semi-color-text-2)' }}
          >
            {currentIndex} / {total}
          </span>
          <button
            className='p-1.5 rounded-lg disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={onLoadNext}
            disabled={loading || !pageInfo?.has_next}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--semi-color-fill-0)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div
        className={`flex-1 flex flex-col items-center px-4 sm:px-6 py-4 min-h-0 gap-4 overflow-auto overscroll-contain ${
          isGenerating ? 'justify-center' : 'justify-start sm:justify-center'
        }`}
      >
        {isGenerating && (
          <div className='flex flex-col items-center gap-3 text-center'>
            <Loader
              size={28}
              className='animate-spin'
              style={{ color: 'var(--semi-color-primary)' }}
            />
            <span
              className='text-xs'
              style={{ color: 'var(--semi-color-primary)' }}
            >
              {t('生成图片需要大约4-6分钟，请耐心等待')}
            </span>
            {msg.prompt && (
              <p
                className='text-xs line-clamp-2 max-w-lg'
                style={{ color: 'var(--semi-color-text-2)' }}
              >
                {msg.prompt}
              </p>
            )}
          </div>
        )}

        {msg.status === 'failure' && (
          <div className='flex flex-col items-center gap-3'>
            <div
              className='flex items-center gap-2 text-sm rounded-xl px-4 py-3 border'
              style={{
                color: 'var(--semi-color-danger)',
                background: 'var(--semi-color-danger-light-default)',
                borderColor: 'var(--semi-color-danger-light-active)',
              }}
            >
              <AlertCircle size={14} />
              <span>{msg.fail_reason || t('生成失败')}</span>
            </div>

            {onRetry && (
              <button
                className='inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-default disabled:opacity-50'
                style={{
                  color: 'var(--semi-color-text-1)',
                  background: 'var(--semi-color-bg-0)',
                  borderColor: 'var(--semi-color-border)',
                }}
                onClick={() => onRetry(msg)}
                disabled={retryDisabled}
                aria-label={t('重试')}
                title={t('重试')}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background =
                      'var(--semi-color-fill-0)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--semi-color-bg-0)';
                }}
              >
                <RotateCcw size={13} />
                <span>{t('重试')}</span>
              </button>
            )}
          </div>
        )}

        {msg.status === 'success' &&
          (imageLoading && !resultImages ? (
            <Loader
              size={24}
              className='animate-spin'
              style={{ color: 'var(--semi-color-primary)' }}
            />
          ) : (
            resultImages && (
              <div
                className='w-full max-w-3xl grid gap-3'
                style={{
                  gridTemplateColumns:
                    resultImages.length === 1
                      ? 'minmax(0, 1fr)'
                      : 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                }}
              >
                {resultImages.map((item, i) => (
                  <DrawingImageCard key={i} imageData={item} />
                ))}
              </div>
            )
          ))}

        {!isGenerating && msg.prompt && (
          <p
            className='text-xs text-center line-clamp-2 max-w-lg'
            style={{ color: 'var(--semi-color-text-2)' }}
          >
            {msg.prompt}
          </p>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;
