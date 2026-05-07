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

import React, { useMemo } from 'react';
import { Button, Input, Typography } from '@douyinfe/semi-ui';
import {
  Trash2,
  Image as ImageIcon,
  LogOut,
  PlusSquare,
  Search,
  Settings,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PlaygroundSidebar = ({
  conversations,
  activeConversationId,
  collapsed,
  onNewChat,
  onOpenSettings,
  onSelectConversation,
  onDeleteConversation,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();
  const recentThreads = useMemo(
    () =>
      (conversations || [])
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 8),
    [conversations],
  );

  return (
    <aside
      className={`new-playground-sidebar ${collapsed ? 'is-collapsed' : ''}`}
    >
      <div className='new-playground-brand'>
        <div className='new-playground-logo'>
          <Zap size={22} />
        </div>
        {!collapsed && (
          <Typography.Title heading={4} className='!mb-0 brand-title'>
            new-api
          </Typography.Title>
        )}
        <Button
          icon={<LogOut size={18} />}
          theme='borderless'
          type='tertiary'
          className='sidebar-collapse-button'
          onClick={onToggleCollapsed}
        />
      </div>

      {!collapsed && (
        <>
          <Button
            icon={<PlusSquare size={17} />}
            className='new-chat-button'
            onClick={onNewChat}
            block
          >
            {t('开始新对话')}
          </Button>

          <Input
            prefix={<Search size={18} />}
            placeholder={t('搜索会话...')}
            className='conversation-search'
          />

          <div className='recent-heading'>{t('最近对话')}</div>
          <div className='recent-thread-list'>
            {recentThreads.map((thread) => (
              <div
                className={`recent-thread-item ${thread.id === activeConversationId ? 'is-active' : ''}`}
                key={thread.id}
              >
                <button
                  className='recent-thread-main'
                  type='button'
                  onClick={() => onSelectConversation(thread.id)}
                >
                  <ImageIcon size={18} />
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
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className='sidebar-footer'>
        <button className='sidebar-settings-button' onClick={onOpenSettings}>
          <Settings size={19} />
          {!collapsed && <span>{t('设置')}</span>}
        </button>
      </div>
    </aside>
  );
};

export default PlaygroundSidebar;
