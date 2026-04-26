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

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Tooltip, Toast } from '@douyinfe/semi-ui';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copy } from '../../helpers';

const PERFORMANCE_CONFIG = {
  MAX_DISPLAY_LENGTH: 50000, // 最大显示字符数
  PREVIEW_LENGTH: 5000, // 预览长度
  VERY_LARGE_MULTIPLIER: 2, // 超大内容倍数
};

const codeThemeStyles = {
  container: {
    backgroundColor: 'var(--na-color-dark-surface)',
    color: 'var(--na-color-ivory)',
    fontFamily: 'var(--na-font-mono)',
    fontSize: 'var(--na-text-label)',
    lineHeight: 'var(--na-leading-body)',
    borderRadius: 'var(--na-radius-input)',
    border: 'var(--na-space-px) solid var(--semi-color-border)',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: 'var(--na-shadow-card)',
  },
  content: {
    height: '100%',
    overflowY: 'auto',
    overflowX: 'auto',
    padding: 'var(--na-space-4)',
    margin: 0,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    background: 'var(--na-color-dark-surface)',
  },
  actionButton: {
    position: 'absolute',
    zIndex: 'var(--na-z-sidebar)',
    backgroundColor: 'var(--na-code-action-bg)',
    border: 'var(--na-space-px) solid var(--na-code-action-border)',
    color: 'var(--na-color-ivory)',
    borderRadius: 'var(--na-radius-subtle)',
    transition:
      'transform var(--na-motion-duration-fast) var(--na-motion-ease-standard), background-color var(--na-motion-duration-base) var(--na-motion-ease-standard)',
  },
  actionButtonHover: {
    backgroundColor: 'var(--na-code-action-bg-hover)',
    borderColor: 'var(--na-code-action-border-hover)',
    transform: 'scale(1.05)',
  },
  noContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--na-text-tertiary)',
    fontSize: 'var(--na-text-caption)',
    fontStyle: 'italic',
    backgroundColor: 'var(--semi-color-fill-0)',
    borderRadius: 'var(--na-radius-input)',
  },
  performanceWarning: {
    padding: 'var(--na-space-2) var(--na-space-3)',
    backgroundColor: 'var(--semi-color-warning-light-default)',
    border: 'var(--na-space-px) solid var(--semi-color-warning)',
    borderRadius: 'var(--na-radius-subtle)',
    color: 'var(--semi-color-warning)',
    fontSize: 'var(--na-text-label)',
    marginBottom: 'var(--na-space-2)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--na-space-2)',
  },
};

const escapeHtml = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const highlightJson = (str) => {
  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(str)) !== null) {
    // Escape non-token text (structural chars like {, }, [, ], :, comma, whitespace)
    result += escapeHtml(str.slice(lastIndex, match.index));

    const token = match[0];
    let color = 'var(--semi-color-success)';
    if (/^"/.test(token)) {
      color = /:$/.test(token)
        ? 'var(--semi-color-info)'
        : 'var(--na-accent-primary-hover)';
    } else if (/true|false|null/.test(token)) {
      color = 'var(--semi-color-primary)';
    }
    // Escape token content before wrapping in span
    result += `<span style="color: ${color}">${escapeHtml(token)}</span>`;
    lastIndex = tokenRegex.lastIndex;
  }

  // Escape remaining text
  result += escapeHtml(str.slice(lastIndex));
  return result;
};

const linkRegex = /(https?:\/\/(?:[^\s<"'\]),;&}]|&amp;)+)/g;

const linkifyHtml = (html) => {
  const parts = html.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (part.startsWith('<')) return part;
      return part.replace(
        linkRegex,
        (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`,
      );
    })
    .join('');
};

const isJsonLike = (content, language) => {
  if (language === 'json') return true;
  const trimmed = content.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
};

const formatContent = (content) => {
  if (!content) return '';

  if (typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2);
    } catch (e) {
      return String(content);
    }
  }

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return content;
    }
  }

  return String(content);
};

const CodeViewer = ({ content, title, language = 'json' }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isHoveringCopy, setIsHoveringCopy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const formattedContent = useMemo(() => formatContent(content), [content]);

  const contentMetrics = useMemo(() => {
    const length = formattedContent.length;
    const isLarge = length > PERFORMANCE_CONFIG.MAX_DISPLAY_LENGTH;
    const isVeryLarge =
      length >
      PERFORMANCE_CONFIG.MAX_DISPLAY_LENGTH *
        PERFORMANCE_CONFIG.VERY_LARGE_MULTIPLIER;
    return { length, isLarge, isVeryLarge };
  }, [formattedContent.length]);

  const displayContent = useMemo(() => {
    if (!contentMetrics.isLarge || isExpanded) {
      return formattedContent;
    }
    return (
      formattedContent.substring(0, PERFORMANCE_CONFIG.PREVIEW_LENGTH) +
      '\n\n// ... 内容被截断以提升性能 ...'
    );
  }, [formattedContent, contentMetrics.isLarge, isExpanded]);

  const highlightedContent = useMemo(() => {
    if (contentMetrics.isVeryLarge && !isExpanded) {
      return escapeHtml(displayContent);
    }

    if (isJsonLike(displayContent, language)) {
      return highlightJson(displayContent);
    }

    return escapeHtml(displayContent);
  }, [displayContent, language, contentMetrics.isVeryLarge, isExpanded]);

  const renderedContent = useMemo(() => {
    return linkifyHtml(highlightedContent);
  }, [highlightedContent]);

  const handleCopy = useCallback(async () => {
    try {
      const textToCopy =
        typeof content === 'object' && content !== null
          ? JSON.stringify(content, null, 2)
          : content;

      const success = await copy(textToCopy);
      setCopied(true);
      Toast.success(t('已复制到剪贴板'));
      setTimeout(() => setCopied(false), 2000);

      if (!success) {
        throw new Error('Copy operation failed');
      }
    } catch (err) {
      Toast.error(t('复制失败'));
      console.error('Copy failed:', err);
    }
  }, [content, t]);

  const handleToggleExpand = useCallback(() => {
    if (contentMetrics.isVeryLarge && !isExpanded) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsExpanded(true);
        setIsProcessing(false);
      }, 100);
    } else {
      setIsExpanded(!isExpanded);
    }
  }, [isExpanded, contentMetrics.isVeryLarge]);

  if (!content) {
    const placeholderText =
      {
        preview: t('正在构造请求体预览...'),
        request: t('暂无请求数据'),
        response: t('暂无响应数据'),
      }[title] || t('暂无数据');

    return (
      <div style={codeThemeStyles.noContent}>
        <span>{placeholderText}</span>
      </div>
    );
  }

  const warningTop = contentMetrics.isLarge
    ? 'calc(var(--na-space-12) + var(--na-space-1))'
    : 'var(--na-space-3)';
  const contentPadding = contentMetrics.isLarge
    ? 'calc(var(--na-space-12) + var(--na-space-1))'
    : 'var(--na-space-4)';

  return (
    <div style={codeThemeStyles.container} className='h-full'>
      {/* 性能警告 */}
      {contentMetrics.isLarge && (
        <div style={codeThemeStyles.performanceWarning}>
          <span>⚡</span>
          <span>
            {contentMetrics.isVeryLarge
              ? t('内容较大，已启用性能优化模式')
              : t('内容较大，部分功能可能受限')}
          </span>
        </div>
      )}

      {/* 复制按钮 */}
      <div
        style={{
          ...codeThemeStyles.actionButton,
          ...(isHoveringCopy ? codeThemeStyles.actionButtonHover : {}),
          top: warningTop,
          right: 'var(--na-space-3)',
        }}
        onMouseEnter={() => setIsHoveringCopy(true)}
        onMouseLeave={() => setIsHoveringCopy(false)}
      >
        <Tooltip content={copied ? t('已复制') : t('复制代码')}>
          <Button
            icon={<Copy size={14} />}
            onClick={handleCopy}
            size='small'
            theme='borderless'
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: copied
                ? 'var(--semi-color-success)'
                : 'var(--na-color-ivory)',
              padding: 'var(--na-space-1-5)',
            }}
          />
        </Tooltip>
      </div>

      {/* 代码内容 */}
      <div
        style={{
          ...codeThemeStyles.content,
          paddingTop: contentPadding,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        className='model-settings-scroll'
      >
        {isProcessing ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '12.5rem',
              color: 'var(--na-text-tertiary)',
            }}
          >
            <div
              style={{
                width: 'var(--na-space-5)',
                height: 'var(--na-space-5)',
                border:
                  'calc(var(--na-space-px) * 2) solid var(--na-color-charcoal)',
                borderTop:
                  'calc(var(--na-space-px) * 2) solid var(--na-text-tertiary)',
                borderRadius: 'var(--na-radius-full)',
                animation: 'spin 1s linear infinite',
                marginRight: 'var(--na-space-2)',
              }}
            />
            {t('正在处理大内容...')}
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
        )}
      </div>

      {/* 展开/收起按钮 */}
      {contentMetrics.isLarge && !isProcessing && (
        <div
          style={{
            ...codeThemeStyles.actionButton,
            bottom: 'var(--na-space-3)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <Tooltip content={isExpanded ? t('收起内容') : t('显示完整内容')}>
            <Button
              icon={
                isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              }
              onClick={handleToggleExpand}
              size='small'
              theme='borderless'
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--na-color-ivory)',
                padding: 'var(--na-space-1-5) var(--na-space-3)',
              }}
            >
              {isExpanded ? t('收起') : t('展开')}
              {!isExpanded && (
                <span
                  style={{
                    fontSize: 'var(--na-text-label)',
                    opacity: 0.7,
                    marginLeft: 'var(--na-space-1)',
                  }}
                >
                  (+
                  {Math.round(
                    (contentMetrics.length -
                      PERFORMANCE_CONFIG.PREVIEW_LENGTH) /
                      1000,
                  )}
                  K)
                </span>
              )}
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default CodeViewer;
