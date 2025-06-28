import React, { useRef, useEffect } from 'react';
import {
  Typography,
  TextArea,
  Button,
} from '@douyinfe/semi-ui';
import MarkdownRenderer from '../common/markdown/MarkdownRenderer';
import ThinkingContent from './ThinkingContent';
import {
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MessageContent = ({
  message,
  className,
  styleState,
  onToggleReasoningExpansion,
  isEditing = false,
  onEditSave,
  onEditCancel,
  editValue,
  onEditValueChange
}) => {
  const { t } = useTranslation();
  const previousContentLengthRef = useRef(0);
  const lastContentRef = useRef('');

  const isThinkingStatus = message.status === 'loading' || message.status === 'incomplete';

  useEffect(() => {
    if (!isThinkingStatus) {
      previousContentLengthRef.current = 0;
      lastContentRef.current = '';
    }
  }, [isThinkingStatus]);

  if (message.status === 'error') {
    let errorText;

    if (Array.isArray(message.content)) {
      const textContent = message.content.find(item => item.type === 'text');
      errorText = textContent && textContent.text && typeof textContent.text === 'string'
        ? textContent.text
        : t('请求发生错误');
    } else if (typeof message.content === 'string') {
      errorText = message.content;
    } else {
      errorText = t('请求发生错误');
    }

    return (
      <div className={`${className} flex items-center p-4 bg-red-50 rounded-xl`}>
        <Typography.Text type="danger" className="text-sm">
          {errorText}
        </Typography.Text>
      </div>
    );
  }

  let currentExtractedThinkingContent = null;
  let currentDisplayableFinalContent = "";
  let thinkingSource = null;

  const getTextContent = (content) => {
    if (Array.isArray(content)) {
      const textItem = content.find(item => item.type === 'text');
      return textItem && textItem.text && typeof textItem.text === 'string' ? textItem.text : '';
    } else if (typeof content === 'string') {
      return content;
    }
    return '';
  };

  currentDisplayableFinalContent = getTextContent(message.content);

  if (message.role === 'assistant') {
    let baseContentForDisplay = getTextContent(message.content);
    let combinedThinkingContent = "";

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
        replyParts.push(baseContentForDisplay.substring(lastIndex, match.index));
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
        thinkingSource = thinkingSource ? thinkingSource + ' & <think> tags' : '<think> tags';
      }

      baseContentForDisplay = replyParts.join('');
    }

    if (isThinkingStatus) {
      const lastOpenThinkIndex = baseContentForDisplay.lastIndexOf('<think>');
      if (lastOpenThinkIndex !== -1) {
        const fragmentAfterLastOpen = baseContentForDisplay.substring(lastOpenThinkIndex);
        if (!fragmentAfterLastOpen.includes('</think>')) {
          const unclosedThought = fragmentAfterLastOpen.substring('<think>'.length).trim();
          if (unclosedThought) {
            if (combinedThinkingContent) {
              combinedThinkingContent += '\n\n---\n\n' + unclosedThought;
            } else {
              combinedThinkingContent = unclosedThought;
            }
            thinkingSource = thinkingSource ? thinkingSource + ' + streaming <think>' : 'streaming <think>';
          }
          baseContentForDisplay = baseContentForDisplay.substring(0, lastOpenThinkIndex);
        }
      }
    }

    currentExtractedThinkingContent = combinedThinkingContent || null;
    currentDisplayableFinalContent = baseContentForDisplay.replace(/<\/?think>/g, '').trim();
  }

  const finalExtractedThinkingContent = currentExtractedThinkingContent;
  const finalDisplayableFinalContent = currentDisplayableFinalContent;

  if (message.role === 'assistant' &&
    isThinkingStatus &&
    !finalExtractedThinkingContent &&
    (!finalDisplayableFinalContent || finalDisplayableFinalContent.trim() === '')) {
    return (
      <div className={`${className} flex items-center gap-2 sm:gap-4 bg-gradient-to-r from-purple-50 to-indigo-50`}>
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Loader2 className="animate-spin text-white" size={styleState.isMobile ? 16 : 20} />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {message.role === 'system' && (
        <div className="mb-2 sm:mb-4">
          <div className="flex items-center gap-2 p-2 sm:p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg" style={{ border: '1px solid var(--semi-color-border)' }}>
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Typography.Text className="text-white text-xs font-bold">S</Typography.Text>
            </div>
            <Typography.Text className="text-amber-700 text-xs sm:text-sm font-medium">
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
        <div className="space-y-3">
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
            className="!border-blue-200 focus:!border-blue-400 !bg-blue-50/50"
          />
          <div className="flex items-center gap-2 w-full">
            <Button
              size="small"
              type="danger"
              theme="light"
              icon={<X size={14} />}
              onClick={onEditCancel}
              className="flex-1"
            >
              {t('取消')}
            </Button>
            <Button
              size="small"
              type="warning"
              theme="solid"
              icon={<Check size={14} />}
              onClick={onEditSave}
              disabled={!editValue || editValue.trim() === ''}
              className="flex-1"
            >
              {t('保存')}
            </Button>
          </div>
        </div>
      ) : (
        (() => {
          if (Array.isArray(message.content)) {
            const textContent = message.content.find(item => item.type === 'text');
            const imageContents = message.content.filter(item => item.type === 'image_url');

            return (
              <div>
                {imageContents.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {imageContents.map((imgItem, index) => (
                      <div key={index} className="max-w-sm">
                        <img
                          src={imgItem.image_url.url}
                          alt={`用户上传的图片 ${index + 1}`}
                          className="rounded-lg max-w-full h-auto shadow-sm border"
                          style={{ maxHeight: '300px' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <div
                          className="text-red-500 text-sm p-2 bg-red-50 rounded-lg border border-red-200"
                          style={{ display: 'none' }}
                        >
                          图片加载失败: {imgItem.image_url.url}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {textContent && textContent.text && typeof textContent.text === 'string' && textContent.text.trim() !== '' && (
                  <div className={`prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'user-message' : ''}`}>
                    <MarkdownRenderer
                      content={textContent.text}
                      className={message.role === 'user' ? 'user-message' : ''}
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
              if (finalDisplayableFinalContent && finalDisplayableFinalContent.trim() !== '') {
                // 获取上一次的内容长度
                let prevLength = 0;
                if (isThinkingStatus && lastContentRef.current) {
                  // 只有当前内容包含上一次内容时，才使用上一次的长度
                  if (finalDisplayableFinalContent.startsWith(lastContentRef.current)) {
                    prevLength = lastContentRef.current.length;
                  }
                }

                // 更新最后内容的引用
                if (isThinkingStatus) {
                  lastContentRef.current = finalDisplayableFinalContent;
                }

                return (
                  <div className="prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm">
                    <MarkdownRenderer
                      content={finalDisplayableFinalContent}
                      className=""
                      animated={isThinkingStatus}
                      previousContentLength={prevLength}
                    />
                  </div>
                );
              }
            } else {
              return (
                <div className={`prose prose-xs sm:prose-sm prose-gray max-w-none overflow-x-auto text-xs sm:text-sm ${message.role === 'user' ? 'user-message' : ''}`}>
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