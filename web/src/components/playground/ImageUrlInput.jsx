/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Input, Button, Switch } from '@heroui/react';
import { FileText, Plus, X, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ImageUrlInput = ({
  imageUrls,
  imageEnabled,
  onImageUrlsChange,
  onImageEnabledChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const handleAddImageUrl = () => {
    const newUrls = [...imageUrls, ''];
    onImageUrlsChange(newUrls);
  };

  const handleUpdateImageUrl = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    onImageUrlsChange(newUrls);
  };

  const handleRemoveImageUrl = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    onImageUrlsChange(newUrls);
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center gap-2'>
          <Image
            size={16}
            className={
              imageEnabled && !disabled ? 'text-blue-500' : 'text-gray-400'
            }
          />
          <span className='text-sm font-semibold text-foreground'>
            {t('图片地址')}
          </span>
          {disabled && (
            <span className='text-xs text-orange-600'>
              ({t('已在自定义模式中忽略')})
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            isSelected={imageEnabled}
            onChange={onImageEnabledChange}
            aria-label={t('启用图片地址')}
            size='sm'
            className='flex-shrink-0'
            isDisabled={disabled}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
          <Button
            isIconOnly
            size='sm'
            variant='primary'
            onPress={handleAddImageUrl}
            className='h-6 min-w-6 rounded-full p-0'
            isDisabled={!imageEnabled || disabled}
            aria-label={t('添加图片地址')}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {!imageEnabled ? (
        <span className='mb-2 block text-xs text-gray-500'>
          {disabled
            ? t('图片功能在自定义请求体模式下不可用')
            : t('启用后可添加图片URL进行多模态对话')}
        </span>
      ) : imageUrls.length === 0 ? (
        <span className='mb-2 block text-xs text-gray-500'>
          {disabled
            ? t('图片功能在自定义请求体模式下不可用')
            : t('点击 + 按钮添加图片URL进行多模态对话')}
        </span>
      ) : (
        <span className='mb-2 block text-xs text-gray-500'>
          {t('已添加')} {imageUrls.length} {t('张图片')}
          {disabled ? ` (${t('自定义模式下不可用')})` : ''}
        </span>
      )}

      <div
        className={`space-y-2 max-h-32 overflow-y-auto image-list-scroll ${!imageEnabled || disabled ? 'opacity-50' : ''}`}
      >
        {imageUrls.map((url, index) => (
          <div key={index} className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <FileText
                size={14}
                className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
              />
              <Input
                placeholder={`https://example.com/image${index + 1}.jpg`}
                value={url}
                onChange={(event) => handleUpdateImageUrl(index, event.target.value)}
                className='rounded-lg pl-8'
                size='sm'
                isDisabled={!imageEnabled || disabled}
              />
            </div>
            <Button
              isIconOnly
              size='sm'
              variant='danger-soft'
              onPress={() => handleRemoveImageUrl(index)}
              className='h-6 min-w-6 flex-shrink-0 rounded-full p-0'
              isDisabled={!imageEnabled || disabled}
              aria-label={t('删除图片地址')}
            >
              <X size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUrlInput;
