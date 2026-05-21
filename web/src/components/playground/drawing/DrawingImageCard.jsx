import React, { useState } from 'react';
import { ImagePreview, Modal } from '@douyinfe/semi-ui';
import { Download, Maximize2, FileText } from 'lucide-react';

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
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none' />
        <div className='absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
          {imageData.revised_prompt && (
            <button
              className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
              style={{
                background: 'var(--semi-color-bg-0)',
                color: 'var(--semi-color-text-0)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setPromptVisible(true);
              }}
              aria-label='查看提示词'
            >
              <FileText size={14} />
            </button>
          )}
          <button
            className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
            style={{
              background: 'var(--semi-color-bg-0)',
              color: 'var(--semi-color-text-0)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewVisible(true);
            }}
            aria-label='放大'
          >
            <Maximize2 size={14} />
          </button>
          <button
            className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
            style={{
              background: 'var(--semi-color-bg-0)',
              color: 'var(--semi-color-text-0)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            aria-label='下载'
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
        width={480}
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
