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

import React, { useRef } from 'react';
import { InputNumber, Select } from '@douyinfe/semi-ui';
import { Bot, Loader2, Paperclip, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayground } from '../../contexts/PlaygroundContext';
import { selectFilter } from '../../helpers';

const formatFileSize = (size = 0) => {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

const getReferenceFileIcon = (fileType) => {
  const normalizedType = String(fileType || '').toLowerCase();

  if (['pdf', 'docx', 'xlsx'].includes(normalizedType)) {
    return `/${normalizedType}.svg`;
  }

  if (['txt', 'json'].includes(normalizedType)) {
    return '/file.svg';
  }

  return null;
};

const PlaygroundComposer = ({
  detailProps,
  inputs,
  models,
  imageModels,
  videoModels,
  playgroundMode,
  customRequestMode,
  onSend,
  onInputChange,
}) => {
  const { t } = useTranslation();
  const {
    imageUrls,
    onRemoveImage,
    onSelectImageFile,
    selectedInlineFiles,
    onSelectInlineFile,
    onRemoveInlineFile,
  } = usePlayground();
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const { inputNode, sendNode, onClick } = detailProps;

  const isVideoMode = playgroundMode === 'video';
  const isImageMode = playgroundMode === 'image';
  const isFileAttachmentDisabled =
    customRequestMode || isVideoMode || isImageMode;
  const selectedImageCount = inputs.imageEnabled ? imageUrls.length : 0;
  const selectedFiles = selectedInlineFiles || [];
  const isFileExtracting = selectedFiles.some(
    (file) => file.status === 'loading',
  );
  const hasFileError = selectedFiles.some((file) => file.status === 'error');
  const hasReadyFile = selectedFiles.some(
    (file) => !file.status || file.status === 'ready',
  );
  const normalizedImageModel = String(inputs.imageModel || '').toLowerCase();
  const isQwenImageModel = normalizedImageModel.includes('qwen-image');
  const modelOptions = isVideoMode
    ? videoModels
    : isImageMode
      ? imageModels
      : models;
  const selectedModel = isVideoMode
    ? inputs.videoModel
    : isImageMode
      ? inputs.imageModel
      : inputs.model;
  const imageSizeOptions = isQwenImageModel
    ? [
        { label: '1328x1328', value: '1328x1328' },
        { label: '1024x1024', value: '1024x1024' },
        { label: '1664x928', value: '1664x928' },
        { label: '928x1664', value: '928x1664' },
        { label: '1472x1140', value: '1472x1140' },
        { label: '1140x1472', value: '1140x1472' },
      ]
    : [
        { label: '1024x1024', value: '1024x1024' },
        { label: '1024x1536', value: '1024x1536' },
        { label: '1536x1024', value: '1536x1024' },

        { label: '2048x2048', value: '2048x2048' },
        { label: '2048x1152', value: '2048x1152' },
        { label: '1152x2048', value: '1152x2048' },

        { label: '2160x3840', value: '2160x3840' },
        { label: 'auto', value: 'auto' },
      ];
  const styledSendNode = React.cloneElement(sendNode, {
    className: `composer-send-button ${sendNode.props.className || ''}`,
    disabled: Boolean(
      isFileExtracting || hasFileError || (sendNode.props.disabled && !hasReadyFile),
    ),
    onClick: (event) => {
      if (isFileExtracting || hasFileError) {
        return;
      }

      if (sendNode.props.disabled && hasReadyFile) {
        event?.stopPropagation?.();
        onSend?.('', []);
        return;
      }

      sendNode.props.onClick?.(event);
    },
    title: isFileExtracting
      ? t('文件解析中，请稍候')
      : hasFileError
        ? t('文件解析失败，请重新选择文件')
      : sendNode.props.title,
  });

  return (
    <div className='new-playground-composer-wrap'>
      <div className='new-playground-composer' onClick={onClick}>
        {inputs.imageEnabled && imageUrls.length > 0 && (
          <div className='reference-image-list'>
            {imageUrls.map((url, index) => (
              <div
                key={`${index}-${url.slice(0, 24)}`}
                className='reference-image-item'
              >
                <img
                  src={url}
                  alt={t('图片 {{index}}', { index: index + 1 })}
                  className='reference-image-preview'
                />
                <button
                  type='button'
                  className='reference-image-remove'
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveImage?.(index);
                  }}
                  aria-label={t('删除')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!isFileAttachmentDisabled && selectedFiles.length > 0 && (
          <div className='reference-file-list'>
            {selectedFiles.map((file, index) => (
              <div
                key={file.id || `${file.name}-${file.size}-${index}`}
                className={`reference-file-item reference-file-item-${file.status || 'ready'}`}
              >
                {getReferenceFileIcon(file.kind) ? (
                  <img
                    src={getReferenceFileIcon(file.kind)}
                    alt=''
                    className='reference-file-icon'
                    aria-hidden={true}
                  />
                ) : (
                  <span
                    className='reference-file-type-badge'
                    aria-hidden={true}
                  >
                    {String(file.kind || 'file').toUpperCase()}
                  </span>
                )}
                <span className='reference-file-meta'>
                  <span className='reference-file-name'>{file.name}</span>
                  <span className='reference-file-size'>
                    {file.status === 'loading' && (
                      <>
                        <Loader2
                          size={11}
                          className='reference-file-status-icon'
                        />
                        {t('文件解析中')}
                      </>
                    )}
                    {file.status === 'error' && t('文件解析失败')}
                    {(!file.status || file.status === 'ready') &&
                      formatFileSize(file.size)}
                  </span>
                </span>
                <button
                  type='button'
                  className='reference-file-remove'
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveInlineFile?.(index);
                  }}
                  aria-label={t('移除文件')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className='composer-input-row'>{inputNode}</div>

        <div className='composer-controls'>
          <div className='composer-control-row'>
            <div className='composer-control-left'>
              <div className='reference-images'>
                <button
                  className={`reference-upload ${inputs.imageEnabled ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!inputs.imageEnabled) {
                      onInputChange('imageEnabled', true);
                    }
                    fileInputRef.current?.click();
                  }}
                  type='button'
                  aria-label={t('参考图片')}
                  title={t('支持 JPEG、PNG、Webp')}
                >
                  <Plus size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/jpeg,image/png,image/webp'
                  className='hidden'
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      onSelectImageFile?.(file);
                    }
                    event.target.value = '';
                  }}
                />
              </div>

              <span className='composer-reference-count'>
                {t('已选择 {{selected}} / {{total}}', {
                  selected: selectedImageCount,
                  total: 10,
                })}
              </span>

              <Select
                value={selectedModel}
                optionList={modelOptions}
                filter={selectFilter}
                autoClearSearchValue={false}
                disabled={customRequestMode}
                onChange={(value) =>
                  onInputChange(
                    isVideoMode
                      ? 'videoModel'
                      : isImageMode
                        ? 'imageModel'
                        : 'model',
                    value,
                  )
                }
                prefix={<Bot size={16} className='mx-2' />}
                className='composer-model-select'
                dropdownStyle={{ maxWidth: 420 }}
                position='top'
              />

              {isImageMode && (
                <div className='video-options'>
                  <Select
                    value={inputs.imageSize}
                    optionList={imageSizeOptions}
                    onChange={(value) => onInputChange('imageSize', value)}
                    className='video-option-control'
                    position='top'
                  />
                  <Select
                    value={inputs.imageQuality}
                    optionList={[
                      { label: 'auto', value: 'auto' },
                      { label: 'high', value: 'high' },
                      { label: 'medium', value: 'medium' },
                      { label: 'low', value: 'low' },
                    ]}
                    onChange={(value) => onInputChange('imageQuality', value)}
                    className='video-option-control image-quality-control'
                    position='top'
                  />
                  <Select
                    value={inputs.outputFormat}
                    optionList={[
                      { label: 'png', value: 'png' },
                      { label: 'jpeg', value: 'jpeg' },
                      { label: 'webp', value: 'webp' },
                    ]}
                    onChange={(value) => onInputChange('outputFormat', value)}
                    className='video-option-control output-format-control'
                    position='top'
                  />
                </div>
              )}
              {isVideoMode && (
                <div className='video-options'>
                  <Select
                    value={inputs.videoRatio}
                    optionList={[
                      { label: '16:9', value: '16:9' },
                      { label: '9:16', value: '9:16' },
                      { label: '1:1', value: '1:1' },
                      { label: '4:3', value: '4:3' },
                      { label: '3:4', value: '3:4' },
                    ]}
                    onChange={(value) => onInputChange('videoRatio', value)}
                    className='video-option-control video-ratio-control'
                    position='top'
                  />
                  <InputNumber
                    min={1}
                    max={30}
                    value={inputs.videoDuration}
                    suffix={t('秒')}
                    onChange={(value) => onInputChange('videoDuration', value)}
                    className='video-option-control video-duration-control'
                  />
                </div>
              )}
            </div>

            <div className='composer-send-row'>
              <button
                className={`composer-attach-button ${selectedFiles.length > 0 ? 'is-active' : ''}`}
                disabled={isFileAttachmentDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isFileAttachmentDisabled) {
                    return;
                  }
                  pdfInputRef.current?.click();
                }}
                type='button'
                aria-label={t('上传文件')}
                title={
                  isFileAttachmentDisabled
                    ? t('文件上传仅支持聊天模式')
                    : t('仅支持 PDF、DOCX、XLSX、TXT、JSON 文件')
                }
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={pdfInputRef}
                type='file'
                accept='application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,text/plain,.txt,application/json,.json,.doc,.xls'
                className='hidden'
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onSelectInlineFile?.(file);
                  }
                  event.target.value = '';
                }}
              />
              {styledSendNode}
            </div>
          </div>
        </div>
      </div>
      <div className='composer-disclaimer'>
        {t('AI 可能会出错，请核实重要信息。')}
      </div>
    </div>
  );
};

export default PlaygroundComposer;
