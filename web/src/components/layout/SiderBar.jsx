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

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLucideIcon } from '../../helpers/render';
import { Button, Tooltip } from '@heroui/react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { isAdmin, isRoot, showError } from '../../helpers';
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

  const itemBaseClass =
    'group flex min-h-10 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-all duration-200';
  const itemActiveClass =
    'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(37,99,235,0.10)] dark:bg-primary/15';
  const itemIdleClass =
    'text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';

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
            nested ? 'text-[13px] font-medium' : 'font-semibold'
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

  const renderSection = (label, items, renderItem = renderNavItem) => (
    <section className='space-y-1.5'>
      {!collapsed && (
        <div className='px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500'>
          {label}
        </div>
      )}
      <div className='space-y-1'>{items.map((item) => renderItem(item))}</div>
    </section>
  );

  const renderDivider = () => (
    <div className='mx-3 my-3 h-px bg-slate-200/80 dark:bg-white/10' />
  );

  return (
    <div
      className='sidebar-container sidebar-shell flex h-full flex-col border-r border-slate-200/70 p-3 shadow-[12px_0_36px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/10'
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
            radius='full'
            variant='bordered'
            isIconOnly={collapsed}
            onPress={toggleCollapsed}
            className={`border-slate-200/80 bg-white/70 text-slate-500 shadow-sm backdrop-blur transition-colors hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-slate-300 ${
              collapsed ? 'h-9 w-9 min-w-9' : 'w-full justify-start'
            }`}
            startContent={
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
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
