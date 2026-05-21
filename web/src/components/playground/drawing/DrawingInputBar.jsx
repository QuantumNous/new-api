import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Toast } from '@douyinfe/semi-ui';
import { Send, ImagePlus, X } from 'lucide-react';
import {
  DEFAULT_DRAWING_MODEL,
  DRAWING_SIZES,
  MAX_UPLOAD_IMAGES,
} from '../../../constants/drawing.constants';

const DrawingInputBar = ({ onSubmit, disabled, loading, hasImage }) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(DRAWING_SIZES[0].value);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const isSubmitting = loading || submitting;
  const hasPrompt = prompt.trim().length > 0;

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > MAX_UPLOAD_IMAGES) {
      Toast.warning(t('最多上传') + ` ${MAX_UPLOAD_IMAGES} ` + t('张图片'));
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
      onOk: async () => {
        setSubmitting(true);
        try {
          await onSubmit(requestPayload);
          setPrompt('');
          setImages([]);
        } finally {
          setSubmitting(false);
        }
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
        {images.length > 0 && (
          <div className='flex gap-2 px-4 pt-3 flex-wrap'>
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
              images.length >= MAX_UPLOAD_IMAGES || disabled || isSubmitting
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
            value={size}
            onChange={setSize}
            size='small'
            style={{ width: 150 }}
            optionList={DRAWING_SIZES}
            disabled={disabled}
            className='!rounded-lg'
          />

          <div className='flex-1' />

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

export default DrawingInputBar;
