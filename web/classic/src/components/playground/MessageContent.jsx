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

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Typography,
  TextArea,
  Button,
  ImagePreview,
  Tooltip,
  Toast,
} from '@douyinfe/semi-ui';
import MarkdownRenderer from '../common/markdown/MarkdownRenderer';
import ThinkingContent from './ThinkingContent';
import {
  Loader2,
  Check,
  X,
  Settings,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isAdmin } from '../../helpers/utils';

const getMessageFileType = (fileItem) => {
  const explicitType = String(fileItem?.file?.file_type || '').toLowerCase();

  if (explicitType) {
    return explicitType;
  }

  const filename = String(
    fileItem?.file?.filename || fileItem?.file?.file_name || '',
  ).toLowerCase();
  const lastDot = filename.lastIndexOf('.');

  return lastDot === -1 ? 'file' : filename.slice(lastDot + 1);
};

const getMessageFileIcon = (fileType) => {
  const normalizedType = String(fileType || '').toLowerCase();

  if (['pdf', 'docx', 'xlsx'].includes(normalizedType)) {
    return `/${normalizedType}.svg`;
  }

  if (['txt', 'json'].includes(normalizedType)) {
    return '/file.svg';
  }

  return null;
};

const MessageContent = ({
  message,
  className,
  styleState,
  onToggleReasoningExpansion,
  isEditing = false,
  onEditSave,
  onEditCancel,
  editValue,
  onEditValueChange,
}) => {
  const { t } = useTranslation();
  const previousContentLengthRef = useRef(0);
  const lastContentRef = useRef('');
  const [previewState, setPreviewState] = useState({
    visible: false,
    images: [],
    index: 0,
  });

  const isThinkingStatus =
    message.status === 'loading' || message.status === 'incomplete';

  const openImagePreview = useCallback((images, index) => {
    setPreviewState({
      visible: true,
      images,
      index,
    });
  }, []);

  const closeImagePreview = useCallback(() => {
    setPreviewState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const changePreviewImage = useCallback((nextIndex) => {
    setPreviewState((prev) => ({
      ...prev,
      index: nextIndex,
    }));
  }, []);

  const previewImages = previewState.images;
  const previewImageCount = previewImages.length;

  const handlePreviewDownload = useCallback(
    async (src, index) => {
      if (!src) {
        return;
      }

      const fileName = `playground-image-${index + 1}.png`;

      if (src.startsWith('data:image/')) {
        const link = document.createElement('a');
        link.href = src;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error('download failed');
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        window.open(src, '_blank', 'noopener,noreferrer');
        Toast.warning(t('下载失败，已为你打开原图'));
      }
    },
    [t],
  );

  const renderPreviewHeader = useCallback(() => {
    return (
      <div className='playground-image-preview-header-content'>
        <Typography.Text className='playground-image-preview-title'>
          {t('图片预览')}
        </Typography.Text>
        {previewImageCount > 1 && (
          <Typography.Text className='playground-image-preview-count'>
            {t('第 {{current}} 张，共 {{total}} 张', {
              current: previewState.index + 1,
              total: previewImageCount,
            })}
          </Typography.Text>
        )}
      </div>
    );
  }, [previewImageCount, previewState.index, t]);

  const renderPreviewMenu = useCallback(
    ({
      min,
      max,
      zoom,
      ratio,
      disabledPrev,
      disabledNext,
      onDownload,
      onNext,
      onPrev,
      onRatioClick,
      onRotateLeft,
      onZoomIn,
      onZoomOut,
    }) => {
      return (
        <div className='playground-image-preview-menu'>
          <div className='playground-image-preview-menu-group'>
            <Tooltip content={t('上一张图片')}>
              <Button
                theme='borderless'
                className='playground-image-preview-button'
                onClick={onPrev}
                disabled={disabledPrev}
              >
                <span className='playground-image-preview-button-text'>
                  {t('上一张')}
                </span>
              </Button>
            </Tooltip>
            <Typography.Text className='playground-image-preview-scale'>
              {Math.round(zoom)}%
            </Typography.Text>
            <Tooltip content={t('下一张图片')}>
              <Button
                theme='borderless'
                className='playground-image-preview-button'
                onClick={onNext}
                disabled={disabledNext}
              >
                <span className='playground-image-preview-button-text'>
                  {t('下一张')}
                </span>
              </Button>
            </Tooltip>
          </div>

          <div className='playground-image-preview-menu-group'>
            <Tooltip content={t('缩小图片')}>
              <Button
                theme='borderless'
                icon={<ZoomOut size={16} />}
                className='playground-image-preview-button'
                onClick={onZoomOut}
                disabled={zoom === min}
              />
            </Tooltip>
            <Tooltip content={t('放大图片')}>
              <Button
                theme='borderless'
                icon={<ZoomIn size={16} />}
                className='playground-image-preview-button'
                onClick={onZoomIn}
                disabled={zoom === max}
              />
            </Tooltip>
            <Tooltip
              content={
                ratio === 'adaptation' ? t('查看原始尺寸') : t('自适应显示')
              }
            >
              <Button
                theme='borderless'
                className='playground-image-preview-button playground-image-preview-mode-button'
                onClick={onRatioClick}
              >
                <span className='playground-image-preview-button-text'>
                  {ratio === 'adaptation' ? t('原始尺寸') : t('自适应')}
                </span>
              </Button>
            </Tooltip>
            <Tooltip content={t('向左旋转')}>
              <Button
                theme='borderless'
                icon={<RotateCcw size={16} />}
                className='playground-image-preview-button'
                onClick={onRotateLeft}
              />
            </Tooltip>
            <Tooltip content={t('下载图片')}>
              <Button
                theme='borderless'
                icon={<Download size={16} />}
                className='playground-image-preview-button'
                onClick={onDownload}
              />
            </Tooltip>
          </div>
        </div>
      );
    },
    [t],
  );

  useEffect(() => {
    if (!isThinkingStatus) {
      previousContentLengthRef.current = 0;
      lastContentRef.current = '';
    }
  }, [isThinkingStatus]);

  if (message.status === 'error') {
    let errorText;

    if (Array.isArray(message.content)) {
      const textContent = message.content.find((item) => item.type === 'text');
      errorText =
        textContent && textContent.text && typeof textContent.text === 'string'
          ? textContent.text
          : t('请求发生错误');
    } else if (typeof message.content === 'string') {
      errorText = message.content;
    } else {
      errorText = t('请求发生错误');
    }

    if (message.errorCode === 'model_price_error') {
      return (
        <div
          className={`playground-message-content playground-message-error ${className || ''}`}
        >
          <div
            className='playground-error-card rounded-lg p-3 space-y-2'
            style={{
              background: 'var(--semi-color-bg-0)',
              border: '1px solid var(--semi-color-border)',
            }}
          >
            <div className='flex items-center gap-2'>
              <AlertTriangle size={16} className='text-orange-500 shrink-0' />
              <Typography.Text
                strong
                className='!text-[var(--semi-color-text-0)]'
              >
                {t('模型价格未配置')}
              </Typography.Text>
            </div>
            <Typography.Paragraph
              className='!text-[var(--semi-color-text-1)] !text-sm !mb-0'
              style={{ wordBreak: 'break-word' }}
            >
              {errorText}
            </Typography.Paragraph>
            {isAdmin() && (
              <Button
                size='small'
                theme='light'
                type='warning'
                icon={<Settings size={14} />}
                onClick={() =>
                  window.open('/console/setting?tab=ratio', '_blank')
                }
              >
                {t('前往设置')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`playground-message-content playground-message-error ${className || ''}`}
      >
        <div className='playground-error-card rounded-lg p-3 space-y-2'>
          <div className='playground-error-heading flex items-center gap-2'>
            <AlertTriangle
              size={16}
              className='playground-error-icon shrink-0'
            />
            <Typography.Text strong className='playground-error-title'>
              {t('请求发生错误')}
            </Typography.Text>
          </div>
          <Typography.Paragraph
            className='playground-error-text !mb-0'
            style={{ wordBreak: 'break-word' }}
          >
            {errorText}
          </Typography.Paragraph>
        </div>
      </div>
    );
  }

  let currentExtractedThinkingContent = null;
  let currentDisplayableFinalContent = '';
  let thinkingSource = null;

  const getTextContent = (content) => {
    if (Array.isArray(content)) {
      const textItem = content.find((item) => item.type === 'text');
      return textItem && textItem.text && typeof textItem.text === 'string'
        ? textItem.text
        : '';
    } else if (typeof content === 'string') {
      return content;
    }
    return '';
  };

  currentDisplayableFinalContent = getTextContent(message.content);

  if (message.role === 'assistant') {
    let baseContentForDisplay = getTextContent(message.content);
    let combinedThinkingContent = '';

    if (message.reasoningContent) {
      combinedThinkingContent = message.reasoningContent;
      thinkingSource = 'reasoningContent';
    }

    if (baseContentForDisplay.includes('<think>')) {
      const thinkTagRegex = /<think>([\s\S]*?)<\/think>/g;
      let match;
      let thoughtsFromPairedTags = [];
      let replyParts = [];
      let lastIndex = 0;

      while ((match = thinkTagRegex.exec(baseContentForDisplay)) !== null) {
        replyParts.push(
          baseContentForDisplay.substring(lastIndex, match.index),
        );
        thoughtsFromPairedTags.push(match[1]);
        lastIndex = match.index + match[0].length;
      }
      replyParts.push(baseContentForDisplay.substring(lastIndex));

      if (thoughtsFromPairedTags.length > 0) {
        const pairedThoughtsStr = thoughtsFromPairedTags.join('\n\n---\n\n');
        if (combinedThinkingContent) {
          combinedThinkingContent += '\n\n---\n\n' + pairedThoughtsStr;
        } else {
          combinedThinkingContent = pairedThoughtsStr;
        }
        thinkingSource = thinkingSource
          ? thinkingSource + ' & <think> tags'
          : '<think> tags';
      }

      baseContentForDisplay = replyParts.join('');
    }

    if (isThinkingStatus) {
      const lastOpenThinkIndex = baseContentForDisplay.lastIndexOf('<think>');
      if (lastOpenThinkIndex !== -1) {
        const fragmentAfterLastOpen =
          baseContentForDisplay.substring(lastOpenThinkIndex);
        if (!fragmentAfterLastOpen.includes('</think>')) {
          const unclosedThought = fragmentAfterLastOpen
            .substring('<think>'.length)
            .trim();
          if (unclosedThought) {
            if (combinedThinkingContent) {
              combinedThinkingContent += '\n\n---\n\n' + unclosedThought;
            } else {
              combinedThinkingContent = unclosedThought;
            }
            thinkingSource = thinkingSource
              ? thinkingSource + ' + streaming <think>'
              : 'streaming <think>';
          }
          baseContentForDisplay = baseContentForDisplay.substring(
            0,
            lastOpenThinkIndex,
          );
        }
      }
    }

    currentExtractedThinkingContent = combinedThinkingContent || null;
    currentDisplayableFinalContent = baseContentForDisplay
      .replace(/<\/?think>/g, '')
      .trim();
  }

  const finalExtractedThinkingContent = currentExtractedThinkingContent;
  const finalDisplayableFinalContent = currentDisplayableFinalContent;

  if (
    message.role === 'assistant' &&
    isThinkingStatus &&
    !finalExtractedThinkingContent &&
    (!finalDisplayableFinalContent ||
      finalDisplayableFinalContent.trim() === '')
  ) {
    return (
      <div
        className={`playground-message-content playground-message-assistant ${className || ''} playground-message-loading-state flex items-center gap-2 sm:gap-4`}
      >
        <div className='playground-message-loading-indicator w-5 h-5 rounded-full flex items-center justify-center shadow-lg'>
          <Loader2
            className='playground-message-loading-icon animate-spin'
            size={styleState.isMobile ? 16 : 20}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`playground-message-content playground-message-${message.role} ${className || ''}`}
    >
      {message.role === 'system' && (
        <div className='playground-system-message mb-2 sm:mb-4'>
          <div
            className='playground-system-banner flex items-center gap-2 p-2 sm:p-3 rounded-lg'
            style={{ border: '1px solid var(--semi-color-border)' }}
          >
            <div className='playground-system-banner-icon w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-sm'>
              <Typography.Text className='playground-system-banner-icon-text text-xs font-bold'>
                S
              </Typography.Text>
            </div>
            <Typography.Text className='playground-system-banner-text text-xs sm:text-sm font-medium'>
              {t('系统消息')}
            </Typography.Text>
          </div>
        </div>
      )}

      {message.role === 'assistant' && (
        <ThinkingContent
          message={message}
          finalExtractedThinkingContent={finalExtractedThinkingContent}
          thinkingSource={thinkingSource}
          styleState={styleState}
          onToggleReasoningExpansion={onToggleReasoningExpansion}
        />
      )}

      {isEditing ? (
        <div className='playground-message-editor space-y-3'>
          <TextArea
            value={editValue}
            onChange={(value) => onEditValueChange(value)}
            placeholder={t('请输入消息内容...')}
            autosize={{ minRows: 3, maxRows: 12 }}
            style={{
              resize: 'vertical',
              fontSize: styleState.isMobile ? '14px' : '15px',
              lineHeight: '1.6',
            }}
            className='playground-message-editor-input'
          />
          <div className='playground-message-editor-actions flex items-center gap-2 w-full'>
            <Button
              size='small'
              type='danger'
              theme='light'
              icon={<X size={14} />}
              onClick={onEditCancel}
              className='playground-message-editor-cancel flex-1'
            >
              {t('取消')}
            </Button>
            <Button
              size='small'
              type='warning'
              theme='solid'
              icon={<Check size={14} />}
              onClick={onEditSave}
              disabled={!editValue || editValue.trim() === ''}
              className='playground-message-editor-save flex-1'
            >
              {t('保存')}
            </Button>
          </div>
        </div>
      ) : (
        (() => {
          if (Array.isArray(message.content)) {
            const textContent = message.content.find(
              (item) => item.type === 'text',
            );
            const imageContents = message.content.filter(
              (item) => item.type === 'image_url',
            );
            const fileContents = message.content.filter(
              (item) => item.type === 'file',
            );

            return (
              <div>
                {fileContents.length > 0 && (
                  <div className='playground-message-file-list mb-3'>
                    {fileContents.map((fileItem, index) => {
                      const filename =
                        fileItem?.file?.filename ||
                        fileItem?.file?.file_name ||
                        t('文件');
                      const fileType = getMessageFileType(fileItem);
                      const fileIcon = getMessageFileIcon(fileType);

                      return (
                        <div
                          key={`${filename}-${index}`}
                          className='playground-message-file-item'
                        >
                          {fileIcon ? (
                            <img
                              src={fileIcon}
                              alt=''
                              className='playground-message-file-icon'
                              aria-hidden={true}
                            />
                          ) : (
                            <span
                              className='playground-message-file-type-badge'
                              aria-hidden={true}
                            >
                              {String(fileType || 'file').toUpperCase()}
                            </span>
                          )}
                          <span className='playground-message-file-name'>
                            {filename}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {imageContents.length > 0 && (
                  <div className='mb-3 space-y-2'>
                    {(() => {
                      const imageUrls = imageContents
                        .map((item) => item?.image_url?.url)
                        .filter(
                          (url) => typeof url === 'string' && url.trim() !== '',
                        );

                      return imageContents.map((imgItem, index) => (
                        <div key={index} className='max-w-sm'>
                          <img
                            src={imgItem.image_url.url}
                            alt={t('图片 {{index}}', { index: index + 1 })}
                            className='playground-message-image rounded-lg max-w-full h-auto shadow-sm border'
                            style={{ maxHeight: '300px' }}
                            onClick={() => openImagePreview(imageUrls, index)}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const overlayNode =
                                e.target.parentElement?.querySelector(
                                  '.playground-message-image-overlay',
                                );
                              const errorNode =
                                e.target.parentElement?.querySelector(
                                  '.playground-message-image-error',
                                );
                              if (overlayNode) {
                                overlayNode.style.display = 'none';
                              }
                              if (errorNode) {
                                errorNode.style.display = 'block';
                              }
                            }}
                          />
                          <div className='playground-message-image-overlay'>
                            {t('点击预览图片')}
                          </div>
                          <div
                            className='playground-message-image-error text-sm p-2 rounded-lg border'
                            style={{ display: 'none' }}
                          >
                            {t('图片加载失败')}: {imgItem.image_url.url}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {textContent &&
                  textContent.text &&
                  typeof textContent.text === 'string' &&
                  textContent.text.trim() !== '' && (
                    <div
                      className={`playground-markdown prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'playground-user-markdown user-message' : 'playground-assistant-markdown'}`}
                    >
                      <MarkdownRenderer
                        content={textContent.text}
                        className={
                          message.role === 'user'
                            ? 'playground-user-markdown user-message'
                            : ''
                        }
                        animated={false}
                        previousContentLength={0}
                      />
                    </div>
                  )}
              </div>
            );
          }

          if (typeof message.content === 'string') {
            if (message.role === 'assistant') {
              if (
                finalDisplayableFinalContent &&
                finalDisplayableFinalContent.trim() !== ''
              ) {
                // 获取上一次的内容长度
                let prevLength = 0;
                if (isThinkingStatus && lastContentRef.current) {
                  // 只有当前内容包含上一次内容时，才使用上一次的长度
                  if (
                    finalDisplayableFinalContent.startsWith(
                      lastContentRef.current,
                    )
                  ) {
                    prevLength = lastContentRef.current.length;
                  }
                }

                // 更新最后内容的引用
                if (isThinkingStatus) {
                  lastContentRef.current = finalDisplayableFinalContent;
                }

                return (
                  <div className='playground-markdown playground-assistant-markdown prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm'>
                    <MarkdownRenderer
                      content={finalDisplayableFinalContent}
                      className=''
                      animated={isThinkingStatus}
                      previousContentLength={prevLength}
                    />
                  </div>
                );
              }
            } else {
              return (
                <div
                  className={`playground-markdown prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'playground-user-markdown user-message' : 'playground-assistant-markdown'}`}
                >
                  <MarkdownRenderer
                    content={message.content}
                    className={
                      message.role === 'user'
                        ? 'playground-user-markdown user-message'
                        : ''
                    }
                    animated={false}
                    previousContentLength={0}
                  />
                </div>
              );
            }
          }

          return null;
        })()
      )}

      <ImagePreview
        src={previewImages}
        visible={previewState.visible}
        currentIndex={previewState.index}
        onChange={changePreviewImage}
        onVisibleChange={(visible) => {
          if (!visible) {
            closeImagePreview();
            return;
          }
          setPreviewState((prev) => ({ ...prev, visible }));
        }}
        onDownload={handlePreviewDownload}
        renderHeader={renderPreviewHeader}
        renderPreviewMenu={renderPreviewMenu}
        previewCls='playground-image-preview'
        showTooltip={false}
        closable
        infinite={false}
        zoomStep={0.25}
        minZoom={0.5}
        maxZoom={5}
        prevTip={t('上一张图片')}
        nextTip={t('下一张图片')}
        zoomInTip={t('放大图片')}
        zoomOutTip={t('缩小图片')}
        rotateTip={t('向左旋转')}
        downloadTip={t('下载图片')}
        adaptiveTip={t('自适应显示')}
        originTip={t('查看原始尺寸')}
      />
    </div>
  );
};

export default MessageContent;
