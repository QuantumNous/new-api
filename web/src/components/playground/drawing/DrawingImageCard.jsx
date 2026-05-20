import React, { useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { Download, Maximize2 } from 'lucide-react';

const DrawingImageCard = ({ imageData }) => {
  const [previewVisible, setPreviewVisible] = useState(false);

  const imageUrl = imageData.url || (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-${Date.now()}.png`;
    link.click();
  };

  return (
    <>
      <div className='relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm'>
        <img
          src={imageUrl}
          alt={imageData.revised_prompt || 'Generated image'}
          className='w-64 h-64 object-cover cursor-pointer'
          onClick={() => setPreviewVisible(true)}
        />
        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100'>
          <div className='flex gap-1'>
            <button
              className='p-1.5 bg-white/90 rounded-md hover:bg-white'
              onClick={() => setPreviewVisible(true)}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className='p-1.5 bg-white/90 rounded-md hover:bg-white'
              onClick={handleDownload}
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        {imageData.revised_prompt && (
          <div className='absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity'>
            {imageData.revised_prompt}
          </div>
        )}
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
          className='max-w-full max-h-[85vh] object-contain'
        />
      </Modal>
    </>
  );
};

export default DrawingImageCard;
