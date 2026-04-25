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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLucideIcon } from '../../helpers/render';
import { Avatar, Button, Tooltip } from '@heroui/react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { isAdmin, isRoot, showError, stringToColor } from '../../helpers';
import { UserContext } from '../../context/User';
import SkeletonWrapper from './components/SkeletonWrapper';

const routerMap = {
  home: '/',
  channel: '/console/channel',
  token: '/console/token',
  redemption: '/console/redemption',
  topup: '/console/topup',
  user: '/console/user',
  subscription: '/console/subscription',
  log: '/console/log',
  midjourney: '/console/midjourney',
  setting: '/console/setting',
  about: '/about',
  detail: '/console',
  pricing: '/pricing',
  task: '/console/task',
  models: '/console/models',
  deployment: '/console/deployment',
  playground: '/console/playground',
  personal: '/console/personal',
};

const SiderBar = ({ onNavigate = () => {} }) => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const {
    isModuleVisible,
    hasSectionVisibleModules,
    loading: sidebarLoading,
  } = useSidebar();

  const showSkeleton = useMinimumLoadingTime(sidebarLoading, 200);

  const [selectedKeys, setSelectedKeys] = useState(['home']);
  const [chatItems, setChatItems] = useState([]);
  const [openedKeys, setOpenedKeys] = useState([]);
  const location = useLocation();
  const [routerMapState, setRouterMapState] = useState(routerMap);

  const workspaceItems = useMemo(() => {
    const items = [
      {
        text: t('数据看板'),
        itemKey: 'detail',
        to: '/detail',
        className:
          localStorage.getItem('enable_data_export') === 'true'
            ? ''
            : 'tableHiddle',
      },
      {
        text: t('令牌管理'),
        itemKey: 'token',
        to: '/token',
      },
      {
        text: t('使用日志'),
        itemKey: 'log',
        to: '/log',
      },
      {
        text: t('绘图日志'),
        itemKey: 'midjourney',
        to: '/midjourney',
        className:
          localStorage.getItem('enable_drawing') === 'true'
            ? ''
            : 'tableHiddle',
      },
      {
        text: t('任务日志'),
        itemKey: 'task',
        to: '/task',
        className:
          localStorage.getItem('enable_task') === 'true' ? '' : 'tableHiddle',
      },
    ];

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('console', item.itemKey);
      return configVisible;
    });

    return filteredItems;
  }, [
    localStorage.getItem('enable_data_export'),
    localStorage.getItem('enable_drawing'),
    localStorage.getItem('enable_task'),
    t,
    isModuleVisible,
  ]);

  const financeItems = useMemo(() => {
    const items = [
      {
        text: t('钱包管理'),
        itemKey: 'topup',
        to: '/topup',
      },
      {
        text: t('个人设置'),
        itemKey: 'personal',
        to: '/personal',
      },
    ];

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('personal', item.itemKey);
      return configVisible;
    });

    return filteredItems;
  }, [t, isModuleVisible]);

  const adminItems = useMemo(() => {
    const items = [
      {
        text: t('渠道管理'),
        itemKey: 'channel',
        to: '/channel',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('订阅管理'),
        itemKey: 'subscription',
        to: '/subscription',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('模型管理'),
        itemKey: 'models',
        to: '/console/models',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('模型部署'),
        itemKey: 'deployment',
        to: '/deployment',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('兑换码管理'),
        itemKey: 'redemption',
        to: '/redemption',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('用户管理'),
        itemKey: 'user',
        to: '/user',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('系统设置'),
        itemKey: 'setting',
        to: '/setting',
        className: isRoot() ? '' : 'tableHiddle',
      },
    ];

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('admin', item.itemKey);
      return configVisible;
    });

    return filteredItems;
  }, [isAdmin(), isRoot(), t, isModuleVisible]);

  const chatMenuItems = useMemo(() => {
    const items = [
      {
        text: t('操练场'),
        itemKey: 'playground',
        to: '/playground',
      },
      {
        text: t('聊天'),
        itemKey: 'chat',
        items: chatItems,
      },
    ];

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('chat', item.itemKey);
      return configVisible;
    });

    return filteredItems;
  }, [chatItems, t, isModuleVisible]);

  // 更新路由映射，添加聊天路由
  const updateRouterMapWithChats = (chats) => {
    const newRouterMap = { ...routerMap };

    if (Array.isArray(chats) && chats.length > 0) {
      for (let i = 0; i < chats.length; i++) {
        newRouterMap['chat' + i] = '/console/chat/' + i;
      }
    }

    setRouterMapState(newRouterMap);
    return newRouterMap;
  };

  // 加载聊天项
  useEffect(() => {
    let chats = localStorage.getItem('chats');
    if (chats) {
      try {
        chats = JSON.parse(chats);
        if (Array.isArray(chats)) {
          let chatItems = [];
          for (let i = 0; i < chats.length; i++) {
            let shouldSkip = false;
            let chat = {};
            for (let key in chats[i]) {
              let link = chats[i][key];
              if (typeof link !== 'string') continue; // 确保链接是字符串
              if (link.startsWith('fluent') || link.startsWith('ccswitch')) {
                shouldSkip = true;
                break;
              }
              chat.text = key;
              chat.itemKey = 'chat' + i;
              chat.to = '/console/chat/' + i;
            }
            if (shouldSkip || !chat.text) continue; // 避免推入空项
            chatItems.push(chat);
          }
          setChatItems(chatItems);
          updateRouterMapWithChats(chats);
        }
      } catch (e) {
        showError('聊天数据解析失败');
      }
    }
  }, []);

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const currentPath = location.pathname;
    let matchingKey = Object.keys(routerMapState).find(
      (key) => routerMapState[key] === currentPath,
    );

    // 处理聊天路由
    if (!matchingKey && currentPath.startsWith('/console/chat/')) {
      const chatIndex = currentPath.split('/').pop();
      if (!isNaN(chatIndex)) {
        matchingKey = 'chat' + chatIndex;
      } else {
        matchingKey = 'chat';
      }
    }

    // 如果找到匹配的键，更新选中的键
    if (matchingKey) {
      setSelectedKeys([matchingKey]);
      if (matchingKey.startsWith('chat')) {
        setOpenedKeys((prev) => (prev.includes('chat') ? prev : [...prev, 'chat']));
      }
    }
  }, [location.pathname, routerMapState]);

  // 监控折叠状态变化以更新 body class
  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  // Match template-dashboard Sidebar.MenuItem styling: rounded-md, font-medium,
  // semantic foreground/muted colors, surface-secondary surface for active state.
  const itemBaseClass =
    'group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors duration-150';
  const itemActiveClass =
    'bg-surface-secondary text-foreground';
  const itemIdleClass =
    'text-muted hover:bg-surface-secondary hover:text-foreground';

  const getItemPath = (item) =>
    routerMapState[item.itemKey] || routerMap[item.itemKey] || item.to;

  const selectItem = (itemKey) => {
    setSelectedKeys([itemKey]);
  };

  const NavItemContent = ({ item, selected, nested = false }) => (
    <>
      <span className='sidebar-icon-container flex shrink-0 items-center justify-center'>
        {getLucideIcon(item.itemKey, selected)}
      </span>
      {!collapsed && (
        <span
          className={`min-w-0 flex-1 truncate text-left ${
            nested ? 'text-[13px] font-normal' : 'font-medium'
          }`}
        >
          {item.text}
        </span>
      )}
    </>
  );

  const renderNavItem = (item, { nested = false } = {}) => {
    if (item.className === 'tableHiddle') return null;

    const isSelected = selectedKeys.includes(item.itemKey);
    const path = getItemPath(item);
    const className = [
      itemBaseClass,
      collapsed ? 'justify-center px-0' : nested ? 'pl-10 pr-3' : '',
      isSelected ? itemActiveClass : itemIdleClass,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <NavItemContent item={item} selected={isSelected} nested={nested} />
    );

    const node = path ? (
      <Link
        key={item.itemKey}
        to={path}
        className={className}
        aria-current={isSelected ? 'page' : undefined}
        onClick={() => {
          selectItem(item.itemKey);
          onNavigate();
        }}
      >
        {content}
      </Link>
    ) : (
      <button
        key={item.itemKey}
        type='button'
        className={className}
        onClick={() => selectItem(item.itemKey)}
      >
        {content}
      </button>
    );

    if (!collapsed) return node;

    return (
      <Tooltip key={item.itemKey} content={item.text} placement='right' delay={300}>
        {node}
      </Tooltip>
    );
  };

  const renderSubItem = (item) => {
    if (item.items && item.items.length > 0) {
      const isOpen = openedKeys.includes(item.itemKey);
      const isSelected =
        selectedKeys.includes(item.itemKey) ||
        item.items.some((subItem) => selectedKeys.includes(subItem.itemKey));

      const trigger = (
        <button
          key={item.itemKey}
          type='button'
          className={[
            itemBaseClass,
            collapsed ? 'justify-center px-0' : '',
            isSelected ? itemActiveClass : itemIdleClass,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            setOpenedKeys((prev) =>
              prev.includes(item.itemKey)
                ? prev.filter((key) => key !== item.itemKey)
                : [...prev, item.itemKey],
            );
          }}
        >
          <NavItemContent item={item} selected={isSelected} />
          {!collapsed && (
            <ChevronDown
              size={15}
              strokeWidth={2.4}
              className={`shrink-0 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>
      );

      return (
        <div key={item.itemKey} className='space-y-1'>
          {collapsed ? (
            <Tooltip content={item.text} placement='right' delay={300}>
              {trigger}
            </Tooltip>
          ) : (
            trigger
          )}
          {!collapsed && isOpen && (
            <div className='space-y-1'>
              {item.items.map((subItem) =>
                renderNavItem(subItem, { nested: true }),
              )}
            </div>
          )}
        </div>
      );
    }

    return renderNavItem(item);
  };

  // Template-dashboard groups items with a thin bottom-aligned label (or no
  // label at all), keeping visual weight low. We mirror that with a small
  // muted label and tighter spacing.
  const renderSection = (label, items, renderItem = renderNavItem) => (
    <section className='space-y-0.5'>
      {!collapsed && (
        <div className='px-3 pb-1 pt-1 text-xs font-medium text-muted'>
          {label}
        </div>
      )}
      <div className='space-y-0.5'>{items.map((item) => renderItem(item))}</div>
    </section>
  );

  const renderDivider = () => (
    <div className='mx-2 my-2 h-px bg-border' />
  );

  // Template-style header block: avatar + display name + role.
  // Mirrors `dashboard-sidebar.tsx`'s <Sidebar.Header> layout.
  const renderUserHeader = () => {
    if (!userState?.user) return null;
    const username = userState.user.display_name || userState.user.username || '';
    const initial = username ? username[0].toUpperCase() : '?';
    const roleLabel = isRoot()
      ? t('超级管理员')
      : isAdmin()
        ? t('管理员')
        : t('用户');
    const avatarBg = stringToColor(username);

    return (
      <div className={`flex items-center gap-3 px-1 pb-3 ${collapsed ? 'justify-center' : ''}`}>
        <Avatar
          size='sm'
          className='h-9 w-9 shrink-0 text-xs text-white'
          style={{ backgroundColor: avatarBg }}
          name={initial}
        />
        {!collapsed && (
          <div className='flex min-w-0 flex-col'>
            <span className='truncate text-sm font-medium leading-tight text-foreground'>
              {username}
            </span>
            <span className='truncate text-xs font-medium leading-tight text-muted'>
              {roleLabel}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className='sidebar-container flex h-full flex-col border-r border-border bg-background p-3'
      style={{
        width: 'var(--sidebar-current-width)',
      }}
    >
      <SkeletonWrapper
        loading={showSkeleton}
        type='sidebar'
        className=''
        collapsed={collapsed}
        showAdmin={isAdmin()}
      >
        {renderUserHeader()}
        <nav className='flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-1 scrollbar-none'>
          {/* 聊天区域 */}
          {hasSectionVisibleModules('chat') && (
            <div className='sidebar-section'>
              {renderSection(t('聊天'), chatMenuItems, renderSubItem)}
            </div>
          )}

          {/* 控制台区域 */}
          {hasSectionVisibleModules('console') && (
            <>
              {renderDivider()}
              {renderSection(t('控制台'), workspaceItems)}
            </>
          )}

          {/* 个人中心区域 */}
          {hasSectionVisibleModules('personal') && (
            <>
              {renderDivider()}
              {renderSection(t('个人中心'), financeItems)}
            </>
          )}

          {/* 管理员区域 - 只在管理员时显示且配置允许时显示 */}
          {isAdmin() && hasSectionVisibleModules('admin') && (
            <>
              {renderDivider()}
              {renderSection(t('管理员'), adminItems)}
            </>
          )}
        </nav>
      </SkeletonWrapper>

      {/* 底部折叠按钮 */}
      <div className='sidebar-collapse-button mt-auto pt-3'>
        <SkeletonWrapper
          loading={showSkeleton}
          type='button'
          width={collapsed ? 36 : 156}
          height={24}
          className='w-full'
        >
          <Button
            size='sm'
            variant='ghost'
            isIconOnly={collapsed}
            onPress={toggleCollapsed}
            className={`text-muted hover:bg-surface-secondary hover:text-foreground ${
              collapsed ? 'h-9 w-9 min-w-9' : 'w-full justify-start'
            }`}
            startContent={
              <ChevronLeft
                size={16}
                strokeWidth={2}
                className={`transition-transform duration-200 ${
                  collapsed ? 'rotate-180' : ''
                }`}
              />
            }
          >
            {!collapsed ? t('收起侧边栏') : null}
          </Button>
        </SkeletonWrapper>
      </div>
    </div>
  );
};

export default SiderBar;
