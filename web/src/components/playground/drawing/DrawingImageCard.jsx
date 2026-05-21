import React, { useState } from 'react';
import { ImagePreview, Modal } from '@douyinfe/semi-ui';
import { Download, FileText } from 'lucide-react';

const DrawingImageCard = ({ imageData }) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);

  const imageUrl = resolveDrawingImageUrl(imageData.url);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-${Date.now()}.png`;
    link.click();
  };

  return (
    <>
      <div className='w-full'>
        <div
          className='relative group rounded-xl overflow-hidden w-full cursor-zoom-in'
          style={{ border: '1px solid var(--semi-color-border)' }}
          onClick={() => setPreviewVisible(true)}
        >
          <img
            src={imageUrl}
            alt={imageData.revised_prompt || 'Generated image'}
            className='w-full object-cover block'
          />
          <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none' />
        </div>

        <div className='mt-2 flex items-center justify-center gap-2'>
          {imageData.revised_prompt && (
            <button
              className='flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer transition-colors'
              style={{ color: 'var(--semi-color-text-2)' }}
              onClick={(e) => {
                e.stopPropagation();
                setPromptVisible(true);
              }}
              aria-label='查看提示词'
              title='查看提示词'
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--semi-color-fill-0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <FileText size={14} />
            </button>
          )}
          <button
            className='flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer transition-colors'
            style={{ color: 'var(--semi-color-text-2)' }}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            aria-label='下载'
            title='下载'
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--semi-color-fill-0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <ImagePreview
        src={imageUrl}
        visible={previewVisible}
        onVisibleChange={(visible) => setPreviewVisible(visible)}
        zoomStep={0.2}
        maxZoom={6}
        minZoom={0.2}
        previewTitle={imageData.revised_prompt || 'Generated image'}
        setDownloadName={() => `generated-${Date.now()}.png`}
      />

      <Modal
        visible={promptVisible}
        onCancel={() => setPromptVisible(false)}
        footer={null}
        title='Revised Prompt'
        width='min(480px, calc(100vw - 32px))'
        bodyStyle={{
          maxHeight: 'calc(100dvh - 180px)',
          overflow: 'auto',
        }}
      >
        <p
          className='text-sm leading-relaxed'
          style={{ color: 'var(--semi-color-text-0)' }}
        >
          {imageData.revised_prompt}
        </p>
      </Modal>
    </>
  );
};

function resolveDrawingImageUrl(url) {
  if (!url) return null;
  if (!url.startsWith('/')) return url;
  const serverUrl = import.meta.env.VITE_REACT_APP_SERVER_URL;
  if (!serverUrl) return url;
  return `${serverUrl.replace(/\/$/, '')}${url}`;
}

export default DrawingImageCard;
