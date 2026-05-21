import React, { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Popover, Select, Toast } from '@douyinfe/semi-ui';
import { Send, ImagePlus, X } from 'lucide-react';
import {
  DEFAULT_DRAWING_MODEL,
  DRAWING_ASPECT_RATIOS,
  DRAWING_RESOLUTIONS,
  MAX_UPLOAD_IMAGES,
  resolveDrawingSize,
} from '../../../constants/drawing.constants';

const DrawingInputBar = ({
  onSubmit,
  disabled,
  loading,
  hasImage,
  referenceImage,
  balanceInfo,
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(
    DRAWING_ASPECT_RATIOS[0].value,
  );
  const [resolution, setResolution] = useState(DRAWING_RESOLUTIONS[0].value);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const isSubmitting = loading || submitting;
  const hasPrompt = prompt.trim().length > 0;
  const referenceImageSrc =
    hasPrompt && referenceImage ? resolveDrawingImageUrl(referenceImage) : null;
  const maxUploadImages = MAX_UPLOAD_IMAGES - (referenceImage ? 1 : 0);
  const size = useMemo(
    () => resolveDrawingSize(aspectRatio, resolution),
    [aspectRatio, resolution],
  );
  const aspectRatioOptions = useMemo(
    () =>
      DRAWING_ASPECT_RATIOS.map((item) => ({
        ...item,
        label: t(item.label),
      })),
    [t],
  );
  const resolutionOptions = useMemo(
    () =>
      DRAWING_RESOLUTIONS.map((item) => ({
        ...item,
        label: t(item.label),
      })),
    [t],
  );
  const aspectRatioSelectWidth = useMemo(() => {
    const selectedLabel =
      aspectRatioOptions.find((item) => item.value === aspectRatio)?.label ||
      '';
    return getSelectWidth(selectedLabel, 106);
  }, [aspectRatio, aspectRatioOptions]);
  const resolutionSelectWidth = useMemo(() => {
    const selectedLabel =
      resolutionOptions.find((item) => item.value === resolution)?.label || '';
    return getSelectWidth(selectedLabel, 72);
  }, [resolution, resolutionOptions]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > maxUploadImages) {
      Toast.warning(t('最多上传') + ` ${maxUploadImages} ` + t('张图片'));
      return;
    }
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSubmit = () => {
    if (!prompt.trim() || isSubmitting || disabled) return;

    const requestPayload = {
      prompt: prompt.trim(),
      model: DEFAULT_DRAWING_MODEL,
      size,
      quality: 'auto',
      images: [...images],
    };

    Modal.confirm({
      title: t('确认发送'),
      content: (
        <div className='text-sm leading-relaxed break-words'>
          {t('确认提交当前提示词并开始生成图片？')}
        </div>
      ),
      okText: t('确认发送'),
      cancelText: t('取消'),
      centered: true,
      className: 'drawing-submit-confirm',
      width: 'min(420px, calc(100vw - 32px))',
      bodyStyle: {
        maxHeight: 'calc(100dvh - 180px)',
        overflow: 'auto',
      },
      onOk: () => {
        scheduleAfterModalClose(() => {
          setSubmitting(true);
          scheduleAfterPaint(() => {
            void Promise.resolve()
              .then(() => onSubmit(requestPayload))
              .then(() => {
                setPrompt('');
                setImages([]);
              })
              .catch((error) => {
                console.error('Drawing submit failed', error);
              })
              .finally(() => {
                setSubmitting(false);
              });
          }, 120);
        });
      },
    });
  };

  return (
    <div className='w-full max-w-3xl mx-auto'>
      {hasImage && hasPrompt && (
        <div
          className='mb-2 px-3 py-1.5 rounded-lg text-xs border'
          style={{
            color: 'var(--semi-color-warning)',
            background: 'var(--semi-color-warning-light-default)',
            borderColor: 'var(--semi-color-warning-light-active)',
          }}
        >
          {t('此次发送将修改这张图片')}
        </div>
      )}

      <div
        className='rounded-2xl border overflow-hidden'
        style={{
          background: 'var(--semi-color-bg-0)',
          borderColor: 'var(--semi-color-border)',
        }}
      >
        {(referenceImageSrc || images.length > 0) && (
          <div className='flex gap-2 px-4 pt-3 flex-wrap'>
            {referenceImageSrc && (
              <div
                className='relative w-14 h-14 rounded-lg overflow-hidden'
                style={{
                  border: '2px solid var(--semi-color-primary)',
                }}
                title={t('结果图')}
              >
                <img
                  src={referenceImageSrc}
                  alt={t('结果图')}
                  className='w-full h-full object-cover'
                />
              </div>
            )}
            {images.map((img, i) => (
              <div key={i} className='relative w-14 h-14'>
                <img
                  src={img}
                  alt={`upload-${i}`}
                  className='w-full h-full object-cover rounded-lg'
                />
                <button
                  className='absolute -top-1 -right-1 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer transition-colors'
                  style={{
                    background: 'var(--semi-color-fill-2)',
                    color: 'var(--semi-color-text-0)',
                  }}
                  onClick={() =>
                    setImages((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('描述你想生成的图片...')}
          disabled={disabled}
          rows={hasPrompt ? 3 : 1}
          className='w-full text-sm px-4 pt-3 pb-2 resize-none outline-none leading-relaxed bg-transparent'
          style={{
            minHeight: hasPrompt ? 80 : 42,
            maxHeight: 200,
            color: 'var(--semi-color-text-0)',
          }}
        />

        <div className='flex items-center gap-2 px-3 pb-3 pt-1'>
          <button
            className='p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={
              images.length >= maxUploadImages || disabled || isSubmitting
            }
            aria-label={t('上传图片')}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = 'var(--semi-color-fill-0)';
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            multiple
            className='hidden'
            onChange={handleImageUpload}
          />

          <Select
            value={aspectRatio}
            onChange={setAspectRatio}
            size='small'
            style={{ width: aspectRatioSelectWidth }}
            dropdownStyle={{ minWidth: aspectRatioSelectWidth }}
            optionList={aspectRatioOptions}
            disabled={disabled}
            className='!rounded-lg'
          />

          <Select
            value={resolution}
            onChange={setResolution}
            size='small'
            style={{ width: resolutionSelectWidth }}
            dropdownStyle={{ minWidth: resolutionSelectWidth }}
            optionList={resolutionOptions}
            disabled={disabled}
            className='!rounded-lg'
          />

          <div className='flex-1' />

          <Popover
            trigger='click'
            position='topRight'
            showArrow
            content={<BalanceFlyoutContent balanceInfo={balanceInfo} t={t} />}
          >
            <button
              type='button'
              className='w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer'
              aria-label={t('当前余额')}
              title={t('当前余额')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--semi-color-fill-0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                className='block h-4 w-4 rounded-full'
                style={{
                  border: `3px solid ${
                    balanceInfo?.toneColor || 'var(--semi-color-text-2)'
                  }`,
                  boxShadow: '0 0 0 2px var(--semi-color-fill-0)',
                }}
              />
            </button>
          </Popover>

          <button
            onClick={handleSubmit}
            disabled={!hasPrompt || disabled || isSubmitting}
            className='w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:cursor-default'
            style={{
              background:
                !hasPrompt || disabled || isSubmitting
                  ? 'var(--semi-color-fill-1)'
                  : 'var(--semi-color-primary)',
              color:
                !hasPrompt || disabled || isSubmitting
                  ? 'var(--semi-color-text-2)'
                  : '#fff',
            }}
            aria-label={t('发送')}
          >
            {isSubmitting ? (
              <div className='w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin' />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function BalanceFlyoutContent({ balanceInfo, t }) {
  return (
    <div
      className='w-[min(78vw,260px)] py-1 text-xs'
      style={{ color: 'var(--semi-color-text-1)' }}
    >
      <div className='mb-2 flex items-center justify-between gap-3'>
        <span style={{ color: 'var(--semi-color-text-2)' }}>
          {t('当前余额')}
        </span>
        <span className='font-medium' style={{ color: balanceInfo?.toneColor }}>
          {balanceInfo?.balanceText || '$0.00'}
        </span>
      </div>

      <div
        className='mb-2 h-px'
        style={{ background: 'var(--semi-color-border)' }}
      />

      <div className='mb-1 font-medium'>{balanceInfo?.modelName}</div>
      <div className='space-y-1'>
        {balanceInfo?.pricingLoading ? (
          <div style={{ color: 'var(--semi-color-text-2)' }}>
            {t('加载中...')}
          </div>
        ) : balanceInfo?.priceItems?.length ? (
          balanceInfo.priceItems.map((item) => (
            <div key={item.key} className='flex justify-between gap-3'>
              <span style={{ color: 'var(--semi-color-text-2)' }}>
                {item.label}
              </span>
              <span className='text-right'>
                {item.value}
                {item.suffix}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--semi-color-text-2)' }}>
            {balanceInfo?.priceUnavailable || t('未找到模型价格')}
          </div>
        )}
      </div>

      {balanceInfo?.availableGenerationsText && (
        <div className='mt-2 flex items-center justify-between gap-3'>
          <span style={{ color: 'var(--semi-color-text-2)' }}>
            {t('预估可用次数')}
          </span>
          <span className='font-medium'>
            {balanceInfo.availableGenerationsText}
          </span>
        </div>
      )}

      {balanceInfo?.usedGroup && (
        <div className='mt-2' style={{ color: 'var(--semi-color-text-2)' }}>
          {t('分组')}：{balanceInfo.usedGroup}
        </div>
      )}
      <div className='mt-2' style={{ color: 'var(--semi-color-text-2)' }}>
        {t('仅供参考，以实际扣费为准')}
      </div>
    </div>
  );
}

function scheduleAfterPaint(callback, delay = 0) {
  const run = () => {
    Promise.resolve().then(callback);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(run, delay));
    return;
  }

  setTimeout(run, delay);
}

function scheduleAfterModalClose(callback) {
  scheduleAfterPaint(callback, 320);
}

function getSelectWidth(label, minWidth) {
  const visualLength = Array.from(label).reduce(
    (total, char) => total + (char.charCodeAt(0) > 255 ? 1 : 0.56),
    0,
  );
  return Math.max(minWidth, Math.ceil(visualLength * 14 + 58));
}

function resolveDrawingImageUrl(url) {
  if (!url) return null;
  if (!url.startsWith('/')) return url;
  const serverUrl = import.meta.env.VITE_REACT_APP_SERVER_URL;
  if (!serverUrl) return url;
  return `${serverUrl.replace(/\/$/, '')}${url}`;
}

export default DrawingInputBar;
