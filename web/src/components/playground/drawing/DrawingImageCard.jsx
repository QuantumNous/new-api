import React, { useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { Download, Maximize2, FileText } from 'lucide-react';

const DrawingImageCard = ({ imageData }) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);

  const imageUrl =
    imageData.url ||
    (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-${Date.now()}.png`;
    link.click();
  };

  return (
    <>
      <div className='relative group rounded-xl overflow-hidden w-full' style={{ border: '1px solid var(--semi-color-border)' }}>
        <img
          src={imageUrl}
          alt={imageData.revised_prompt || 'Generated image'}
          className='w-full object-cover cursor-pointer block'
          onClick={() => setPreviewVisible(true)}
        />
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors' />
        <div className='absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
          {imageData.revised_prompt && (
            <button
              className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
              style={{ background: 'var(--semi-color-bg-0)', color: 'var(--semi-color-text-0)' }}
              onClick={() => setPromptVisible(true)}
              aria-label='查看提示词'
            >
              <FileText size={14} />
            </button>
          )}
          <button
            className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
            style={{ background: 'var(--semi-color-bg-0)', color: 'var(--semi-color-text-0)' }}
            onClick={() => setPreviewVisible(true)}
            aria-label='放大'
          >
            <Maximize2 size={14} />
          </button>
          <button
            className='p-1.5 rounded-lg shadow cursor-pointer transition-colors'
            style={{ background: 'var(--semi-color-bg-0)', color: 'var(--semi-color-text-0)' }}
            onClick={handleDownload}
            aria-label='下载'
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <Modal
        visible={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width='auto'
        style={{ maxWidth: '90vw' }}
        bodyStyle={{ padding: 0 }}
        closable
      >
        <img
          src={imageUrl}
          alt={imageData.revised_prompt || 'Generated image'}
          className='max-w-full max-h-[85vh] object-contain block'
        />
      </Modal>

      <Modal
        visible={promptVisible}
        onCancel={() => setPromptVisible(false)}
        footer={null}
        title='Revised Prompt'
        width={480}
      >
        <p className='text-sm leading-relaxed' style={{ color: 'var(--semi-color-text-0)' }}>
          {imageData.revised_prompt}
        </p>
      </Modal>
    </>
  );
};

export default DrawingImageCard;
