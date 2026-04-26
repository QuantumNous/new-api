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

import React, { useRef, useEffect } from 'react';
import { Button } from '@heroui/react';
import MarkdownRenderer from '../common/markdown/MarkdownRenderer';
import ThinkingContent from './ThinkingContent';
import { Loader2, Check, X, Settings, AlertTriangle } from 'lucide-react';
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

  const isThinkingStatus =
    message.status === 'loading' || message.status === 'incomplete';

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
        <div className={`${className}`}>
          <div
            className='space-y-2 rounded-lg border border-border bg-background p-3'
          >
            <div className='flex items-center gap-2'>
              <AlertTriangle size={16} className='text-orange-500 shrink-0' />
              <span className='font-semibold text-foreground'>
                {t('模型价格未配置')}
              </span>
            </div>
            <p
              className='mb-0 text-sm text-muted'
              style={{ wordBreak: 'break-word' }}
            >
              {errorText}
            </p>
            {isAdmin() && (
              <Button
                size='sm'
                variant='secondary'
                onPress={() =>
                  window.open('/console/setting?tab=ratio', '_blank')
                }
              >
                <Settings size={14} />
                {t('前往设置')}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`${className}`}>
        <span className='text-white'>{errorText}</span>
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
            className='flex items-center gap-2 rounded-lg border border-border bg-gradient-to-r from-amber-50 to-orange-50 p-2 sm:p-3'
          >
            <div className='w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm'>
              <span className='text-xs font-bold text-white'>
                S
              </span>
            </div>
            <span className='text-xs font-medium text-amber-700 sm:text-sm'>
              {t('系统消息')}
            </span>
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
          <textarea
            value={editValue}
            onChange={(event) => onEditValueChange(event.target.value)}
            placeholder={t('请输入消息内容...')}
            rows={3}
            style={{
              resize: 'vertical',
              fontSize: styleState.isMobile ? '14px' : '15px',
              lineHeight: '1.6',
            }}
            className='w-full rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-foreground outline-none transition focus:border-blue-400'
          />
          <div className='flex items-center gap-2 w-full'>
            <Button
              size='sm'
              variant='danger-soft'
              onPress={onEditCancel}
              className='flex-1'
            >
              <X size={14} />
              {t('取消')}
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onPress={onEditSave}
              isDisabled={!editValue || editValue.trim() === ''}
              className='flex-1'
            >
              <Check size={14} />
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
                  <div className='mb-3 space-y-2'>
                    {imageContents.map((imgItem, index) => (
                      <div key={index} className='max-w-sm'>
                        <img
                          src={imgItem.image_url.url}
                          alt={`用户上传的图片 ${index + 1}`}
                          className='rounded-lg max-w-full h-auto shadow-sm border'
                          style={{ maxHeight: '300px' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <div
                          className='text-red-500 text-sm p-2 bg-red-50 rounded-lg border border-red-200'
                          style={{ display: 'none' }}
                        >
                          图片加载失败: {imgItem.image_url.url}
                        </div>
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
                // Track previous content length for streaming animation.
                let prevLength = 0;
                if (isThinkingStatus && lastContentRef.current) {
                  // Only reuse previous length when current content contains it.
                  if (
                    finalDisplayableFinalContent.startsWith(
                      lastContentRef.current,
                    )
                  ) {
                    prevLength = lastContentRef.current.length;
                  }
                }

                // Update the last content reference.
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
    </div>
  );
};

export default MessageContent;
