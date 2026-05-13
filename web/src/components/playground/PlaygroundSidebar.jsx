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

import React, { useMemo, useState } from 'react';
import { Input, Typography } from '@douyinfe/semi-ui';
import {
  ChevronLeft,
  MessageCircle,
  MessageCircleMore,
  PanelLeftOpen,
  PanelRightOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PlaygroundSidebar = ({
  conversations,
  activeConversationId,
  collapsed,
  isMobile,
  mobileOpen,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onToggleCollapsed,
  onMobileOpen,
  onMobileClose,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const getConversationSearchText = (conversation) => {
    const title = conversation?.title || '';
    const messageText = Array.isArray(conversation?.messages)
      ? conversation.messages
          .map((message) => {
            if (typeof message?.content === 'string') {
              return message.content;
            }

            if (Array.isArray(message?.content)) {
              return message.content
                .map((item) => {
                  if (typeof item?.text === 'string') {
                    return item.text;
                  }

                  if (typeof item?.image_url?.url === 'string') {
                    return item.image_url.url;
                  }

                  return '';
                })
                .join(' ');
            }

            return '';
          })
          .join(' ')
      : '';

    return `${title} ${messageText}`.trim().toLowerCase();
  };

  const recentThreads = useMemo(() => {
    return (conversations || [])
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [conversations]);

  const filteredThreads = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return recentThreads;
    }

    return recentThreads.filter((thread) =>
      getConversationSearchText(thread).includes(keyword),
    );
  }, [recentThreads, searchQuery]);

  const groupedThreads = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const oldestReasonableTimestamp = new Date(2000, 0, 1).getTime();
    const groupedMap = new Map();

    filteredThreads.forEach((thread) => {
      const updatedAt = Number(thread.updatedAt || thread.createdAt || 0);
      const hasValidTimestamp =
        Number.isFinite(updatedAt) && updatedAt >= oldestReasonableTimestamp;
      const timestamp = hasValidTimestamp ? updatedAt : Date.now();
      const diffDays = Math.floor(
        (startOfToday - timestamp) / (24 * 60 * 60 * 1000),
      );

      let label = t('更早');
      if (hasValidTimestamp) {
        const date = new Date(timestamp);
        const monthLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        label =
          diffDays < 7 ? t('7天内') : diffDays < 30 ? t('30天内') : monthLabel;
      }

      if (!groupedMap.has(label)) {
        groupedMap.set(label, []);
      }

      groupedMap.get(label).push(thread);
    });

    return Array.from(groupedMap.entries()).map(([label, items]) => ({
      label,
      items,
    }));
  }, [filteredThreads, t]);

  const handlePrimaryToggle = () => {
    if (isMobile) {
      if (mobileOpen) {
        onMobileClose?.();
      } else {
        onMobileOpen?.();
      }
      return;
    }

    onToggleCollapsed?.();
  };

  const handleNewConversation = () => {
    onNewChat?.();
    if (isMobile) {
      onMobileClose?.();
    }
  };

  const handleSelectConversation = (conversationId) => {
    onSelectConversation?.(conversationId);
    if (isMobile) {
      onMobileClose?.();
    }
  };

  const renderBrandMark = () => (
    <div className='new-playground-logo' aria-hidden='true'>
      <MessageCircle size={20} />
    </div>
  );

  const renderQuickActions = () => (
    <div className='new-playground-quick-actions'>
      <button
        type='button'
        className='sidebar-quick-action'
        aria-label={isMobile ? t('打开侧边栏') : t('展开侧边栏')}
        onClick={handlePrimaryToggle}
      >
        <PanelLeftOpen size={16} />
      </button>
      <button
        type='button'
        className='sidebar-quick-action'
        aria-label={t('开始新对话')}
        onClick={handleNewConversation}
      >
        <Plus size={16} />
      </button>
    </div>
  );

  const renderCollapsedEntry = (className) => (
    <div className={className}>
      <div className='new-playground-entry-pill'>
        {renderBrandMark()}
        {renderQuickActions()}
      </div>
    </div>
  );

  if (collapsed && !isMobile) {
    return renderCollapsedEntry('new-playground-sidebar-desktop-entry');
  }

  return (
    <>
      {isMobile &&
        renderCollapsedEntry('new-playground-sidebar-desktop-entry is-mobile')}

      {isMobile && mobileOpen && (
        <button
          type='button'
          className='new-playground-sidebar-backdrop'
          aria-label={t('关闭侧边栏')}
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`new-playground-sidebar ${isMobile ? 'is-mobile' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
      >
        <>
          <div className='new-playground-sidebar-header'>
            <div className='new-playground-brand'>
              {renderBrandMark()}
              <div className='new-playground-brand-copy'>
                <Typography.Title heading={5} className='!mb-0 brand-title'>
                  AI生图&AI视频
                </Typography.Title>
              </div>
            </div>

            <div className='new-playground-sidebar-header-actions'>
              <button
                type='button'
                className='sidebar-icon-button'
                aria-label={isMobile ? t('关闭侧边栏') : t('收起侧边栏')}
                onClick={handlePrimaryToggle}
              >
                <PanelRightOpen size={17} />
              </button>
            </div>
          </div>

          <button
            type='button'
            className='new-chat-button'
            onClick={handleNewConversation}
          >
            <Plus size={17} />
            <span>{t('开始新对话')}</span>
          </button>

          <div className='conversation-search-wrap'>
            <Input
              placeholder={t('搜索会话...')}
              className='conversation-search'
              showClear
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          <div className='recent-thread-list-shell'>
            {groupedThreads.length > 0 ? (
              groupedThreads.map((group) => (
                <section className='recent-thread-group' key={group.label}>
                  <div className='recent-heading'>{group.label}</div>
                  <div className='recent-thread-list'>
                    {group.items.map((thread) => (
                      <div
                        className={`recent-thread-item ${thread.id === activeConversationId ? 'is-active' : ''}`}
                        key={thread.id}
                      >
                        <button
                          className='recent-thread-main'
                          type='button'
                          onClick={() => handleSelectConversation(thread.id)}
                        >
                          <MessageCircleMore size={17} />
                          <span>{thread.title || t('新对话')}</span>
                        </button>
                        <button
                          className='recent-thread-delete'
                          type='button'
                          aria-label={t('删除会话')}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteConversation?.(thread.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className='recent-thread-empty'>
                {searchQuery
                  ? t('没有匹配的会话')
                  : t('还没有会话，先开始一轮体验吧')}
              </div>
            )}
          </div>

          {!isMobile && (
            <div className='sidebar-footer'>
              <button
                type='button'
                className='sidebar-settings-button'
                aria-label={t('收起侧边栏')}
                onClick={handlePrimaryToggle}
              >
                <PanelRightOpen size={17} />
                <span>{t('收起侧边栏')}</span>
              </button>
            </div>
          )}
        </>
      </aside>
    </>
  );
};

export default PlaygroundSidebar;
