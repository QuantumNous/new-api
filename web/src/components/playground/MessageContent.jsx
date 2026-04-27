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

import React, { useRef, useEffect, useState } from 'react';
import { Typography, TextArea, Button, Modal } from '@douyinfe/semi-ui';
import MarkdownRenderer from '../common/markdown/MarkdownRenderer';
import ThinkingContent from './ThinkingContent';
import {
  Loader2,
  Check,
  X,
  Settings,
  AlertTriangle,
  ZoomIn,
  Download,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isAdmin } from '../../helpers/utils';

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
  const previewContainerRef = useRef(null);
  const previewPanStateRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);

  const isThinkingStatus =
    message.status === 'loading' || message.status === 'incomplete';
  const hasImageContent =
    Array.isArray(message.content) &&
    message.content.some((item) => item.type === 'image_url');

  useEffect(() => {
    if (!isThinkingStatus) {
      previousContentLengthRef.current = 0;
      lastContentRef.current = '';
    }
  }, [isThinkingStatus]);

  useEffect(() => {
    if (previewImageUrl) {
      setPreviewScale(1);
      setIsPreviewPanning(false);
      if (previewContainerRef.current) {
        previewContainerRef.current.scrollTo({ left: 0, top: 0 });
      }
    }
  }, [previewImageUrl]);

  const clampScale = (scale) => Math.min(6, Math.max(0.5, scale));

  const handlePreviewZoom = (delta) => {
    setPreviewScale((prev) => clampScale(Number((prev + delta).toFixed(2))));
  };

  const handlePreviewWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    setPreviewScale((prev) => clampScale(Number((prev + delta).toFixed(2))));
  };

  const handlePreviewDownload = () => {
    if (!previewImageUrl) return;

    const link = document.createElement('a');
    link.href = previewImageUrl;
    link.download = `playground-image-${Date.now()}.png`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stopPreviewPanning = () => {
    setIsPreviewPanning(false);
    previewPanStateRef.current.pointerId = null;
  };

  const handlePreviewPointerDown = (event) => {
    if (previewScale <= 1 || !previewContainerRef.current) return;

    previewPanStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: previewContainerRef.current.scrollLeft,
      scrollTop: previewContainerRef.current.scrollTop,
    };
    setIsPreviewPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewPointerMove = (event) => {
    if (
      !isPreviewPanning ||
      previewPanStateRef.current.pointerId !== event.pointerId ||
      !previewContainerRef.current
    ) {
      return;
    }

    const deltaX = event.clientX - previewPanStateRef.current.startX;
    const deltaY = event.clientY - previewPanStateRef.current.startY;

    previewContainerRef.current.scrollLeft =
      previewPanStateRef.current.scrollLeft - deltaX;
    previewContainerRef.current.scrollTop =
      previewPanStateRef.current.scrollTop - deltaY;
  };

  const handlePreviewPointerUp = (event) => {
    if (previewPanStateRef.current.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    stopPreviewPanning();
  };

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
        <div className={`${className}`}>
          <div
            className='rounded-lg p-3 space-y-2'
            style={{
              background: 'var(--semi-color-bg-0)',
              border: '1px solid var(--semi-color-border)',
            }}
          >
            <div className='flex items-center gap-2'>
              <AlertTriangle size={16} className='text-orange-500 shrink-0' />
              <Typography.Text strong className='!text-[var(--semi-color-text-0)]'>
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
                onClick={() => window.open('/console/setting?tab=ratio', '_blank')}
              >
                {t('前往设置')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`${className}`}>
        <Typography.Text className='text-white'>{errorText}</Typography.Text>
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
    !hasImageContent &&
    !finalExtractedThinkingContent &&
    (!finalDisplayableFinalContent ||
      finalDisplayableFinalContent.trim() === '')
  ) {
    return (
      <div
        className={`${className} flex items-center gap-2 sm:gap-4 bg-gradient-to-r from-purple-50 to-indigo-50`}
      >
        <div className='w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg'>
          <Loader2
            className='animate-spin text-white'
            size={styleState.isMobile ? 16 : 20}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {message.role === 'system' && (
        <div className='mb-2 sm:mb-4'>
          <div
            className='flex items-center gap-2 p-2 sm:p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg'
            style={{ border: '1px solid var(--semi-color-border)' }}
          >
            <div className='w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm'>
              <Typography.Text className='text-white text-xs font-bold'>
                S
              </Typography.Text>
            </div>
            <Typography.Text className='text-amber-700 text-xs sm:text-sm font-medium'>
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
        <div className='space-y-3'>
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
            className='!border-blue-200 focus:!border-blue-400 !bg-blue-50/50'
          />
          <div className='flex items-center gap-2 w-full'>
            <Button
              size='small'
              type='danger'
              theme='light'
              icon={<X size={14} />}
              onClick={onEditCancel}
              className='flex-1'
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
              className='flex-1'
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

            return (
              <div>
                {imageContents.length > 0 && (
                  <div className='mb-3 flex flex-wrap gap-3'>
                    {imageContents.map((imgItem, index) => (
                      <div
                        key={index}
                        className='group'
                        style={{
                          width: styleState.isMobile ? '132px' : '168px',
                        }}
                      >
                        <button
                          type='button'
                          className='relative block w-full overflow-hidden rounded-xl border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5'
                          onClick={() => setPreviewImageUrl(imgItem.image_url.url)}
                        >
                          <img
                            src={imgItem.image_url.url}
                            alt={`${t('图片预览')} ${index + 1}`}
                            className='block w-full object-cover'
                            style={{
                              height: styleState.isMobile ? '132px' : '168px',
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div
                            className='hidden items-center justify-center text-red-500 text-xs p-3 bg-red-50'
                            style={{
                              height: styleState.isMobile ? '132px' : '168px',
                            }}
                          >
                            {t('图片加载失败')}
                          </div>
                          <div className='pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 py-2 text-white opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100'>
                            <Typography.Text
                              className='!text-white !text-xs'
                            >
                              {t('点击查看大图')}
                            </Typography.Text>
                            <ZoomIn size={14} />
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {textContent &&
                  textContent.text &&
                  typeof textContent.text === 'string' &&
                  textContent.text.trim() !== '' && (
                    <div
                      className={`prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'user-message' : ''}`}
                    >
                      <MarkdownRenderer
                        content={textContent.text}
                        className={
                          message.role === 'user' ? 'user-message' : ''
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
                  <div className='prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm'>
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
                  className={`prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'user-message' : ''}`}
                >
                  <MarkdownRenderer
                    content={message.content}
                    className={message.role === 'user' ? 'user-message' : ''}
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

      <Modal
        title={t('图片预览')}
        visible={!!previewImageUrl}
        footer={null}
        onCancel={() => {
          setPreviewImageUrl('');
          setPreviewScale(1);
          stopPreviewPanning();
        }}
        width={styleState.isMobile ? '94vw' : 960}
        centered
        bodyStyle={{
          padding: styleState.isMobile ? 12 : 20,
        }}
      >
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Button
              icon={<Minus size={14} />}
              theme='light'
              type='tertiary'
              size='small'
              onClick={() => handlePreviewZoom(-0.2)}
              disabled={previewScale <= 0.5}
            >
              {t('缩小')}
            </Button>
            <Button
              icon={<Plus size={14} />}
              theme='light'
              type='tertiary'
              size='small'
              onClick={() => handlePreviewZoom(0.2)}
              disabled={previewScale >= 6}
            >
              {t('放大')}
            </Button>
            <Button
              icon={<RotateCcw size={14} />}
              theme='light'
              type='tertiary'
              size='small'
              onClick={() => setPreviewScale(1)}
            >
              {t('重置')}
            </Button>
            <Typography.Text className='text-xs sm:text-sm text-[var(--semi-color-text-1)]'>
              {t('缩放')}: {Math.round(previewScale * 100)}%
            </Typography.Text>
          </div>
          <Button
            icon={<Download size={14} />}
            theme='solid'
            type='primary'
            size='small'
            onClick={handlePreviewDownload}
          >
            {t('下载图片')}
          </Button>
        </div>

        <div
          ref={previewContainerRef}
          className='overflow-auto rounded-xl'
          style={{
            background: 'var(--semi-color-fill-0)',
            minHeight: styleState.isMobile ? '240px' : '320px',
            maxHeight: styleState.isMobile ? '72vh' : '80vh',
            cursor:
              previewScale > 1 ? (isPreviewPanning ? 'grabbing' : 'grab') : 'default',
            userSelect: isPreviewPanning ? 'none' : 'auto',
            touchAction: previewScale > 1 ? 'none' : 'auto',
          }}
          onWheel={handlePreviewWheel}
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={stopPreviewPanning}
          onPointerLeave={handlePreviewPointerUp}
        >
          {previewImageUrl && (
            <div
              className='flex min-h-full min-w-full items-center justify-center p-3'
              style={{
                minWidth: previewScale > 1 ? `${previewScale * 100}%` : '100%',
              }}
            >
              <img
                src={previewImageUrl}
                alt={t('图片预览')}
                className='block rounded-lg shadow-sm'
                draggable={false}
                style={{
                  width: previewScale <= 1 ? '100%' : `${previewScale * 100}%`,
                  maxWidth: 'none',
                  maxHeight:
                    previewScale <= 1
                      ? styleState.isMobile
                        ? '70vh'
                        : '78vh'
                      : 'none',
                  objectFit: 'contain',
                  transition: 'width 0.12s ease-out',
                }}
              />
            </div>
          )}
        </div>
        <Typography.Text className='mt-3 block text-xs text-[var(--semi-color-text-2)]'>
          {previewScale > 1
            ? t('可使用滚轮继续缩放，并按住拖拽平移查看细节')
            : t('可使用滚轮继续缩放查看细节')}
        </Typography.Text>
      </Modal>
    </div>
  );
};

export default MessageContent;
