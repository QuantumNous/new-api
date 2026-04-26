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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { copy, showSuccess } from '../../helpers';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import {
  defaultDocId,
  docsAliases,
  docsBaseUrl,
  docsById,
  docsTree,
} from './docsData';

const getHashDocId = () => {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!hash) {
    return defaultDocId;
  }
  return docsAliases[hash] || hash;
};

const getDocFromHash = () => {
  const hashDocId = getHashDocId();
  return docsById[hashDocId] ? hashDocId : defaultDocId;
};

const normalizeApifoxMarkdown = (markdown) =>
  markdown
    .replace(/^:::highlight\s+\S+\s*(.*)$/gm, (_, title) =>
      title ? `> ${title}` : '>',
    )
    .replace(/^:::\s*$/gm, '');

const stripHeadingText = (value) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractHeadings = (markdown, docId, docTitle) => {
  const headings = [];
  let inCodeFence = false;

  markdown.split(/\r?\n/).forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }

    if (inCodeFence) {
      return;
    }

    const match = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line.trim());
    if (!match) {
      return;
    }

    const title = stripHeadingText(match[2]);
    if (!title) {
      return;
    }

    headings.push({
      id: `${docId}-heading-${headings.length}`,
      level: match[1].length,
      title,
      isPageTitle:
        headings.length === 0 && match[1].length === 1 && title === docTitle,
    });
  });

  return headings;
};

function SidebarDocLink({ id, activeId }) {
  const doc = docsById[id];
  if (!doc) {
    return null;
  }

  return (
    <a
      href={`#${doc.id}`}
      className={activeId === doc.id ? 'is-current' : ''}
      title={doc.title}
    >
      {doc.method && <small>{doc.method}</small>}
      <span>{doc.title}</span>
    </a>
  );
}

function SidebarItem({ item, activeId }) {
  if (typeof item === 'string') {
    return <SidebarDocLink id={item} activeId={activeId} />;
  }

  return (
    <div className='na-docs-sidebar-group'>
      <p>{item.title}</p>
      <div className='na-docs-sidebar-children'>
        {item.items.map((child) => (
          <SidebarItem
            activeId={activeId}
            item={child}
            key={typeof child === 'string' ? child : child.title}
          />
        ))}
      </div>
    </div>
  );
}

const Docs = () => {
  const markdownRef = useRef(null);
  const tocScrollTimersRef = useRef([]);
  const [activeId, setActiveId] = useState(getDocFromHash);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const activeDoc = docsById[activeId] || docsById[defaultDocId];
  const endpoint = activeDoc.path ? `${docsBaseUrl}${activeDoc.path}` : '';
  const renderedMarkdown = useMemo(
    () => normalizeApifoxMarkdown(activeDoc.markdown),
    [activeDoc.markdown],
  );
  const headingItems = useMemo(
    () => extractHeadings(renderedMarkdown, activeDoc.id, activeDoc.title),
    [activeDoc.id, activeDoc.title, renderedMarkdown],
  );
  const tocItems = useMemo(() => {
    const withoutPageTitle = headingItems.filter((item) => !item.isPageTitle);
    return withoutPageTitle.length > 0 ? withoutPageTitle : headingItems;
  }, [headingItems]);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveId(getDocFromHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.na-docs-page')?.scrollIntoView({ block: 'start' });
  }, [activeId]);

  useEffect(() => {
    const headingNodes =
      markdownRef.current?.querySelectorAll('.na-markdown-heading') || [];

    headingNodes.forEach((headingNode, index) => {
      if (headingItems[index]) {
        headingNode.id = headingItems[index].id;
      }
    });

    setActiveHeadingId(tocItems[0]?.id || '');
  }, [activeId, headingItems, tocItems]);

  useEffect(() => {
    document.title = `${activeDoc.title} - MO API 帮助文档`;
  }, [activeDoc.title]);

  useEffect(
    () => () => {
      tocScrollTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
    },
    [],
  );

  const handleCopyEndpoint = async () => {
    if (!endpoint) {
      return;
    }
    const ok = await copy(endpoint);
    if (ok) {
      showSuccess('接口地址已复制');
    }
  };

  const handleTocClick = (headingId) => {
    const headingNode = document.getElementById(headingId);
    if (!headingNode) {
      return;
    }

    setActiveHeadingId(headingId);
    tocScrollTimersRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );

    const scrollToHeading = () => {
      headingNode.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
    };

    scrollToHeading();
    window.requestAnimationFrame(scrollToHeading);
    tocScrollTimersRef.current = [
      window.setTimeout(scrollToHeading, 250),
      window.setTimeout(scrollToHeading, 900),
    ];
  };

  const handleMarkdownLinkClick = (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) {
      return;
    }

    const href = link.getAttribute('href') || '';
    const hash = href.startsWith('/#') ? href.slice(2) : href.slice(1);
    if (!href.startsWith('#') && !href.startsWith('/#')) {
      return;
    }

    const docId = docsAliases[hash] || hash;
    if (!docsById[docId]) {
      return;
    }

    event.preventDefault();
    window.location.hash = docId;
  };

  return (
    <main className='na-docs-page'>
      <div className='na-docs-shell'>
        <aside className='na-docs-sidebar' aria-label='文档导航'>
          <div className='na-docs-brand'>
            <strong>MO API 帮助文档</strong>
            <span>{Object.keys(docsById).length} 个文档页面</span>
          </div>
          {docsTree.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <nav>
                {section.items.map((item) => (
                  <SidebarItem
                    activeId={activeId}
                    item={item}
                    key={typeof item === 'string' ? item : item.title}
                  />
                ))}
              </nav>
            </section>
          ))}
        </aside>

        <article className='na-docs-content'>
          <div className='na-docs-breadcrumb'>
            {(activeDoc.category || [activeDoc.group]).map((item) => (
              <React.Fragment key={item}>
                <span>{item}</span>
                <span>/</span>
              </React.Fragment>
            ))}
            <span>{activeDoc.title}</span>
          </div>

          <header className='na-docs-hero'>
            <div>
              <p className='na-docs-eyebrow'>MO API 文档</p>
              <h1>{activeDoc.title}</h1>
              {endpoint && (
                <div className='na-docs-endpoint'>
                  <span>{activeDoc.method}</span>
                  <code>{endpoint}</code>
                </div>
              )}
            </div>
            {endpoint && (
              <Button
                icon={<IconCopy />}
                className='na-docs-copy-button'
                onClick={handleCopyEndpoint}
              >
                复制接口
              </Button>
            )}
          </header>

          <div
            ref={markdownRef}
            className='na-docs-markdown'
            onClickCapture={handleMarkdownLinkClick}
          >
            <MarkdownRenderer
              key={activeDoc.id}
              content={renderedMarkdown}
              fontSize={15}
            />
          </div>
        </article>

        <aside className='na-docs-meta na-docs-toc' aria-label='本篇目录'>
          <div className='na-docs-toc-title'>
            <span aria-hidden='true' />
            <strong>本篇目录</strong>
          </div>

          {tocItems.length > 0 ? (
            <nav>
              {tocItems.map((heading) => (
                <button
                  type='button'
                  className={`na-docs-toc-link na-docs-toc-level-${heading.level} ${
                    activeHeadingId === heading.id ? 'is-current' : ''
                  }`}
                  key={heading.id}
                  onClick={() => handleTocClick(heading.id)}
                  title={heading.title}
                >
                  {heading.title}
                </button>
              ))}
            </nav>
          ) : (
            <p className='na-docs-toc-empty'>当前文档暂无分级目录</p>
          )}

          <div className='na-docs-toc-source'>
            <p>基础 URL</p>
            <code>{docsBaseUrl}</code>
            <a
              href={activeDoc.sourceUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              查看来源
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default Docs;
