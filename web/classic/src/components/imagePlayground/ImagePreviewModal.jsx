import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FlipVertical,
  FlipHorizontal,
  RotateCcw,
  RotateCw,
  ZoomOut,
  ZoomIn,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;

// 自定义图片预览弹层：支持上下翻转、左右翻转、左转、右转、缩小、放大
const ImagePreviewModal = ({ visible, src, onClose }) => {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const reset = useCallback(() => {
    setScale(1);
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
  }, []);

  useEffect(() => {
    if (visible) reset();
  }, [visible, src, reset]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const transform = `rotate(${rotate}deg) scale(${(flipH ? -1 : 1) * scale}, ${(flipV ? -1 : 1) * scale})`;

  const iconColor = '#ffffff';
  const actions = [
    {
      key: 'flipV',
      title: t('上下翻转'),
      icon: <FlipVertical size={22} color={iconColor} />,
      onClick: () => setFlipV((v) => !v),
    },
    {
      key: 'flipH',
      title: t('左右翻转'),
      icon: <FlipHorizontal size={22} color={iconColor} />,
      onClick: () => setFlipH((v) => !v),
    },
    {
      key: 'rotateL',
      title: t('向左旋转'),
      icon: <RotateCcw size={22} color={iconColor} />,
      onClick: () => setRotate((r) => r - 90),
    },
    {
      key: 'rotateR',
      title: t('向右旋转'),
      icon: <RotateCw size={22} color={iconColor} />,
      onClick: () => setRotate((r) => r + 90),
    },
    {
      key: 'zoomOut',
      title: t('缩小'),
      icon: <ZoomOut size={22} color={iconColor} />,
      onClick: () => setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP)),
    },
    {
      key: 'zoomIn',
      title: t('放大'),
      icon: <ZoomIn size={22} color={iconColor} />,
      onClick: () => setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP)),
    },
  ];

  return createPortal(
    <div
      className='fixed inset-0 z-[2000] flex items-center justify-center'
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        className='absolute top-5 right-6'
        onClick={onClose}
        aria-label={t('关闭')}
      >
        <X size={28} color='#ffffff' />
      </button>

      {/* 图片（上方留出空间给标题/关闭，下方留出空间给工具条）
          点击图片本身不关闭，点击图片旁边的空白处则关闭 */}
      <div
        className='flex items-center justify-center w-full px-10'
        style={{
          height: 'calc(100vh - 140px)',
          marginTop: 20,
          overflow: 'hidden',
        }}
      >
        <img
          src={src}
          alt='preview'
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90%',
            maxHeight: '100%',
            transform,
            transition: 'transform 0.2s ease',
            userSelect: 'none',
          }}
        />
      </div>

      {/* 底部工具条 */}
      <div
        className='absolute left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 rounded-full'
        style={{ bottom: 32, background: 'rgba(0,0,0,0.65)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a) => (
          <div key={a.key} className='relative group'>
            <button
              className='flex items-center justify-center rounded-full hover:bg-white/20 transition-colors'
              style={{ width: 36, height: 36, color: '#ffffff' }}
              onClick={a.onClick}
              aria-label={a.title}
            >
              {a.icon}
            </button>
            {/* 自定义提示：纯白文字，深色底，hover 显示 */}
            <span
              className='pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10 whitespace-nowrap rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity'
              style={{ background: 'rgba(0,0,0,0.85)', color: '#ffffff' }}
            >
              {a.title}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
};

export default ImagePreviewModal;
