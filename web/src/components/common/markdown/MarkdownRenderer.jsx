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

import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import './markdown.css';
import RemarkMath from 'remark-math';
import RemarkBreaks from 'remark-breaks';
import RehypeKatex from 'rehype-katex';
import RemarkGfm from 'remark-gfm';
import RehypeHighlight from 'rehype-highlight';
import { useRef, useState, useEffect, useMemo } from 'react';
import mermaid from 'mermaid';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import clsx from 'clsx';
import { Button, Tooltip, Toast } from '@douyinfe/semi-ui';
import { copy, rehypeSplitWordsIntoSpans } from '../../../helpers';
import { IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export function Mermaid(props) {
  const ref = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (props.code && ref.current) {
      mermaid
        .run({
          nodes: [ref.current],
          suppressErrors: true,
        })
        .catch((e) => {
          setHasError(true);
          console.error('[Mermaid] ', e.message);
        });
    }
  }, [props.code]);

  function viewSvgInNewWindow() {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([text], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  if (hasError) {
    return null;
  }

  return (
    <div
      className={clsx(
        'mermaid-container',
        'na-markdown-panel',
        'na-markdown-mermaid',
      )}
      ref={ref}
      onClick={() => viewSvgInNewWindow()}
    >
      {props.code}
    </div>
  );
}

function SandboxedHtmlPreview({ code }) {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(150);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const height =
            doc.documentElement.scrollHeight || doc.body.scrollHeight;
          setIframeHeight(Math.min(Math.max(height + 16, 60), 600));
        }
      } catch {
        // sandbox restrictions may prevent access, that's fine
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [code]);

  return (
    <iframe
      ref={iframeRef}
      sandbox='allow-same-origin'
      srcDoc={code}
      title='HTML Preview'
      className='na-markdown-preview-frame'
      style={{
        height: `${iframeHeight}px`,
      }}
    />
  );
}

export function PreCode(props) {
  const ref = useRef(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const { t } = useTranslation();

  const renderArtifacts = useDebouncedCallback(() => {
    if (!ref.current) return;
    const mermaidDom = ref.current.querySelector('code.language-mermaid');
    if (mermaidDom) {
      setMermaidCode(mermaidDom.innerText);
    }
    const htmlDom = ref.current.querySelector('code.language-html');
    const refText = ref.current.querySelector('code')?.innerText;
    if (htmlDom) {
      setHtmlCode(htmlDom.innerText);
    } else if (
      refText?.startsWith('<!DOCTYPE') ||
      refText?.startsWith('<svg') ||
      refText?.startsWith('<?xml')
    ) {
      setHtmlCode(refText);
    }
  }, 600);

  // 处理代码块的换行
  useEffect(() => {
    if (ref.current) {
      const codeElements = ref.current.querySelectorAll('code');
      const wrapLanguages = [
        '',
        'md',
        'markdown',
        'text',
        'txt',
        'plaintext',
        'tex',
        'latex',
      ];
      codeElements.forEach((codeElement) => {
        let languageClass = codeElement.className.match(/language-(\w+)/);
        let name = languageClass ? languageClass[1] : '';
        if (wrapLanguages.includes(name)) {
          codeElement.style.whiteSpace = 'pre-wrap';
        }
      });
      setTimeout(renderArtifacts, 1);
    }
  }, []);

  return (
    <>
      <pre ref={ref} className='na-markdown-pre'>
        <div className='copy-code-button na-markdown-copy-tools'>
          <Tooltip content={t('复制代码')}>
            <Button
              size='small'
              theme='borderless'
              icon={<IconCopy />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ref.current) {
                  const codeElement = ref.current.querySelector('code');
                  const code = codeElement?.textContent ?? '';
                  copy(code).then((success) => {
                    if (success) {
                      Toast.success(t('代码已复制到剪贴板'));
                    } else {
                      Toast.error(t('复制失败，请手动复制'));
                    }
                  });
                }
              }}
              className='na-markdown-copy-button'
            />
          </Tooltip>
        </div>
        {props.children}
      </pre>
      {mermaidCode.length > 0 && (
        <Mermaid code={mermaidCode} key={mermaidCode} />
      )}
      {htmlCode.length > 0 && (
        <div className='na-markdown-html-preview'>
          <div className='na-markdown-html-label'>HTML预览:</div>
          <SandboxedHtmlPreview code={htmlCode} />
        </div>
      )}
    </>
  );
}

function CustomCode(props) {
  const ref = useRef(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showToggle, setShowToggle] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (ref.current) {
      const codeHeight = ref.current.scrollHeight;
      setShowToggle(codeHeight > 400);
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [props.children]);

  const toggleCollapsed = () => {
    setCollapsed((collapsed) => !collapsed);
  };

  const renderShowMoreButton = () => {
    if (showToggle && collapsed) {
      return (
        <div className='na-markdown-more'>
          <Button size='small' onClick={toggleCollapsed} theme='solid'>
            {t('显示更多')}
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className='na-markdown-code-wrap'>
      <code
        className={clsx(props?.className, 'na-markdown-code')}
        ref={ref}
        style={{
          maxHeight: collapsed ? '25rem' : 'none',
        }}
      >
        {props.children}
      </code>
      {renderShowMoreButton()}
    </div>
  );
}

function escapeBrackets(text) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}

function tryWrapHtmlCode(text) {
  // 尝试包装HTML代码
  if (text.includes('```')) {
    return text;
  }
  return text
    .replace(
      /([`]*?)(\w*?)([\n\r]*?)(<!DOCTYPE html>)/g,
      (match, quoteStart, lang, newLine, doctype) => {
        return !quoteStart ? '\n```html\n' + doctype : match;
      },
    )
    .replace(
      /(<\/body>)([\r\n\s]*?)(<\/html>)([\n\r]*)([`]*)([\n\r]*?)/g,
      (match, bodyEnd, space, htmlEnd, newLine, quoteEnd) => {
        return !quoteEnd ? bodyEnd + space + htmlEnd + '\n```\n' : match;
      },
    );
}

function _MarkdownContent(props) {
  const {
    content,
    className,
    animated = false,
    previousContentLength = 0,
  } = props;

  const escapedContent = useMemo(() => {
    return tryWrapHtmlCode(escapeBrackets(content));
  }, [content]);

  // 判断是否为用户消息
  const isUserMessage = className && className.includes('user-message');
  const userMessageClass = isUserMessage ? 'na-markdown-user' : '';

  const rehypePluginsBase = useMemo(() => {
    const base = [
      RehypeKatex,
      [
        RehypeHighlight,
        {
          detect: false,
          ignoreMissing: true,
        },
      ],
    ];
    if (animated) {
      base.push([rehypeSplitWordsIntoSpans, { previousContentLength }]);
    }
    return base;
  }, [animated, previousContentLength]);

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={rehypePluginsBase}
      components={{
        pre: PreCode,
        code: CustomCode,
        p: (pProps) => (
          <p
            {...pProps}
            dir='auto'
            className={clsx('na-markdown-paragraph', userMessageClass)}
          />
        ),
        a: (aProps) => {
          const href = aProps.href || '';
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure style={{ margin: 'var(--na-space-3) 0' }}>
                <audio controls src={href} style={{ width: '100%' }}></audio>
              </figure>
            );
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video
                controls
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  margin: 'var(--na-space-3) 0',
                }}
              >
                <source src={href} />
              </video>
            );
          }
          const isInternal = /^\/#/i.test(href);
          const target = isInternal ? '_self' : (aProps.target ?? '_blank');
          return (
            <a
              {...aProps}
              target={target}
              className={clsx('na-markdown-link', userMessageClass)}
            />
          );
        },
        h1: (props) => (
          <h1
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h1',
              userMessageClass,
            )}
          />
        ),
        h2: (props) => (
          <h2
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h2',
              userMessageClass,
            )}
          />
        ),
        h3: (props) => (
          <h3
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h3',
              userMessageClass,
            )}
          />
        ),
        h4: (props) => (
          <h4
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h4',
              userMessageClass,
            )}
          />
        ),
        h5: (props) => (
          <h5
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h5',
              userMessageClass,
            )}
          />
        ),
        h6: (props) => (
          <h6
            {...props}
            className={clsx(
              'na-markdown-heading',
              'na-markdown-h6',
              userMessageClass,
            )}
          />
        ),
        blockquote: (props) => (
          <blockquote
            {...props}
            className={clsx('na-markdown-blockquote', userMessageClass)}
          />
        ),
        ul: (props) => (
          <ul
            {...props}
            className={clsx('na-markdown-list', userMessageClass)}
          />
        ),
        ol: (props) => (
          <ol
            {...props}
            className={clsx('na-markdown-list', userMessageClass)}
          />
        ),
        li: (props) => (
          <li
            {...props}
            className={clsx('na-markdown-list-item', userMessageClass)}
          />
        ),
        table: (props) => (
          <div className='na-markdown-table-wrap'>
            <table
              {...props}
              className={clsx('na-markdown-table', userMessageClass)}
            />
          </div>
        ),
        th: (props) => (
          <th
            {...props}
            className={clsx(
              'na-markdown-table-cell',
              'na-markdown-table-head',
              userMessageClass,
            )}
          />
        ),
        td: (props) => (
          <td
            {...props}
            className={clsx('na-markdown-table-cell', userMessageClass)}
          />
        ),
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(_MarkdownContent);

export function MarkdownRenderer(props) {
  const {
    content,
    loading,
    fontSize = 14,
    fontFamily = 'inherit',
    className,
    style,
    animated = false,
    previousContentLength = 0,
    ...otherProps
  } = props;

  return (
    <div
      className={clsx('markdown-body', className)}
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        lineHeight: '1.6',
        color: 'var(--semi-color-text-0)',
        ...style,
      }}
      dir='auto'
      {...otherProps}
    >
      {loading ? (
        <div className='na-markdown-loading'>
          <div className='na-markdown-spinner' />
          正在渲染...
        </div>
      ) : (
        <MarkdownContent
          content={content}
          className={className}
          animated={animated}
          previousContentLength={previousContentLength}
        />
      )}
    </div>
  );
}

export default MarkdownRenderer;
