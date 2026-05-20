import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button, Toast } from '@douyinfe/semi-ui';
import { Send, ImagePlus, X } from 'lucide-react';
import {
  DRAWING_MODELS,
  DRAWING_SIZES,
  DRAWING_QUALITIES,
  MAX_UPLOAD_IMAGES,
} from '../../../constants/drawing.constants';

const DrawingInputBar = ({ onSubmit, disabled, loading }) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(DRAWING_MODELS[0].value);
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('auto');
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > MAX_UPLOAD_IMAGES) {
      Toast.warning(t('最多上传') + ` ${MAX_UPLOAD_IMAGES} ` + t('张图片'));
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!prompt.trim() || loading || disabled) return;
    onSubmit({ prompt: prompt.trim(), model, size, quality, images });
    setPrompt('');
    setImages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className='p-4'>
      {/* Image previews */}
      {images.length > 0 && (
        <div className='flex gap-2 mb-3 flex-wrap'>
          {images.map((img, i) => (
            <div key={i} className='relative w-16 h-16'>
              <img
                src={img}
                alt={`upload-${i}`}
                className='w-full h-full object-cover rounded-md border'
              />
              <button
                className='absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center'
                onClick={() => removeImage(i)}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls row */}
      <div className='flex gap-2 mb-3 flex-wrap items-center'>
        <Select
          value={model}
          onChange={setModel}
          size='small'
          style={{ width: 140 }}
          optionList={DRAWING_MODELS}
        />
        <Select
          value={size}
          onChange={setSize}
          size='small'
          style={{ width: 150 }}
          optionList={DRAWING_SIZES}
        />
        <Select
          value={quality}
          onChange={setQuality}
          size='small'
          style={{ width: 110 }}
          optionList={DRAWING_QUALITIES}
        />
        <Button
          icon={<ImagePlus size={16} />}
          type='tertiary'
          theme='borderless'
          size='small'
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_UPLOAD_IMAGES}
        />
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={handleImageUpload}
        />
      </div>

      {/* Input row */}
      <div className='flex gap-2'>
        <Input
          value={prompt}
          onChange={setPrompt}
          onKeyDown={handleKeyDown}
          placeholder={t('描述你想生成的图片...')}
          size='large'
          className='flex-1'
          disabled={disabled}
        />
        <Button
          icon={<Send size={16} />}
          theme='solid'
          size='large'
          onClick={handleSubmit}
          loading={loading}
          disabled={!prompt.trim() || disabled}
        />
      </div>
    </div>
  );
};

export default DrawingInputBar;
