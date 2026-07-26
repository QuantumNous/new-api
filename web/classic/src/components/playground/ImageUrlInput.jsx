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

import React, { useRef, useCallback } from 'react';
import {
  Typography,
  Button,
  Switch,
  Toast,
  Tooltip,
  Image as SemiImage,
} from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { X, Image, HelpCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const ImageUrlInput = ({
  imageUrls,
  imageEnabled,
  onImageUrlsChange,
  onImageEnabledChange,
  disabled = false,
  // 复用于图片/视频体验区:自定义标题、问号提示、必填(红星+隐藏启用开关)。
  label,
  tooltip,
  required = false,
  // 单文件大小上限(MB;0/未传=不限)。视频体验区按 maxInputMB 兜住上传成本。
  maxMB = 0,
  // 最多可上传张数(0/未传=不限)。达到上限后隐藏拖拽框(单帧槽=1,参考图=1~3)。
  maxCount = 0,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleRemoveImageUrl = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    onImageUrlsChange(newUrls);
  };

  const handleFiles = useCallback(
    async (files) => {
      if (!imageEnabled || disabled) return;
      // 一次多选/多拖时按剩余槽位截断,避免超过 maxCount(不再依赖上层 slice 兜底)。
      const remaining =
        maxCount > 0 ? maxCount - (imageUrls?.length || 0) : Infinity;
      if (remaining <= 0) {
        Toast.warning({
          content: t('最多上传 {{count}} 张', { count: maxCount }),
          duration: 2,
        });
        return;
      }
      const results = [];
      let overflow = false;
      for (const file of files) {
        if (results.length >= remaining) {
          overflow = true;
          break;
        }
        if (maxMB > 0 && file.size > maxMB * 1024 * 1024) {
          Toast.error({
            content: t('文件不能超过 {{size}} MB', { size: maxMB }),
            duration: 2,
          });
          continue;
        }
        try {
          const base64 = await readFileAsBase64(file);
          results.push(base64);
        } catch {
          Toast.error({ content: t('图片读取失败'), duration: 2 });
        }
      }
      if (results.length > 0) {
        onImageUrlsChange([...imageUrls, ...results]);
        Toast.success({ content: t('图片已添加'), duration: 2 });
      }
      if (overflow) {
        Toast.warning({
          content: t('最多上传 {{count}} 张', { count: maxCount }),
          duration: 2,
        });
      }
    },
    [imageEnabled, disabled, imageUrls, onImageUrlsChange, maxMB, maxCount, t],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    disabled: !imageEnabled || disabled,
    noClick: true,
    onDrop: handleFiles,
  });

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    e.target.value = '';
  };

  const isActive = imageEnabled && !disabled;
  // 达到张数上限则隐藏拖拽框(拖满即收起,移除后再出现)。
  const reachedMax = maxCount > 0 && (imageUrls?.length || 0) >= maxCount;

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      {/* 标题行 */}
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center gap-2'>
          <Image
            size={16}
            className={isActive ? 'text-blue-500' : 'text-gray-400'}
          />
          <Typography.Text strong className='text-sm'>
            {label || t('上传图片')}
            {required && (
              <span style={{ color: 'var(--semi-color-danger)' }}> *</span>
            )}
          </Typography.Text>
          {tooltip && (
            <Tooltip content={tooltip} position='top'>
              <HelpCircle size={14} className='text-gray-400 cursor-help' />
            </Tooltip>
          )}
          {/* 「自定义模式忽略」文案仅用于文本体验区(带启用开关);必填模式不显示 */}
          {!required && disabled && (
            <Typography.Text className='text-xs text-orange-600'>
              ({t('已在自定义模式中忽略')})
            </Typography.Text>
          )}
        </div>
        {/* 必填(图生图/图生视频/首尾帧)不给启用开关——上传是硬性要求 */}
        {!required && (
          <Switch
            checked={imageEnabled}
            onChange={onImageEnabledChange}
            checkedText={t('启用')}
            uncheckedText={t('停用')}
            size='small'
            className='flex-shrink-0'
            disabled={disabled}
          />
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 拖拽 / 上传区域（开启且未达张数上限时显示，拖满自动收起） */}
      {isActive && !reachedMax && (
        <div
          {...getRootProps()}
          onClick={handleFileButtonClick}
          className={[
            'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 mb-2 cursor-pointer transition-colors',
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50',
          ].join(' ')}
        >
          <input {...getInputProps()} />
          <IconUpload
            size='large'
            className={isDragActive ? 'text-blue-400' : 'text-gray-400'}
          />
          <Typography.Text className='text-xs text-gray-500 text-center'>
            {isDragActive
              ? t('松开以添加图片')
              : t('拖拽图片到此处，或点击选择文件')}
          </Typography.Text>
        </div>
      )}

      {!isActive && (
        <Typography.Text className='text-xs text-gray-400 block mb-1'>
          {disabled
            ? t('图片功能在自定义请求体模式下不可用')
            : t('启用后可上传图片进行多模态对话')}
        </Typography.Text>
      )}

      {/* 已上传图片:只展示预览缩略图,点击放大看原图(Semi Image 默认 preview=true,
          单图即可全屏预览);右上角 × 移除。达到上限后拖拽框已收起,此处即最终态。 */}
      {isActive && imageUrls.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {imageUrls.map((url, index) => (
            <div key={index} className='relative'>
              <SemiImage
                src={url}
                width={64}
                height={64}
                alt={`image-${index + 1}`}
                className='object-cover rounded-lg border border-gray-200'
                style={{ objectFit: 'cover', borderRadius: 8 }}
              />
              <Button
                icon={<X size={12} />}
                size='small'
                theme='solid'
                type='danger'
                onClick={() => handleRemoveImageUrl(index)}
                className='!absolute !-top-2 !-right-2 !rounded-full !w-5 !h-5 !p-0 !min-w-0 flex-shrink-0'
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUrlInput;
