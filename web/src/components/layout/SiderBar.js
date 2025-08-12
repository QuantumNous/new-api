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
import { getLucideIcon } from '../../helpers/render.js';
import { ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed.js';
import {
  isAdmin,
  isRoot,
  showError
} from '../../helpers/index.js';

import {
  Nav,
  Divider,
  Button,
} from '@douyinfe/semi-ui';

const routerMap = {
  home: '/',
  channel: '/console/channel',
  token: '/console/token',
  redemption: '/console/redemption',
  topup: '/console/topup',
  user: '/console/user',
  log: '/console/log',
  midjourney: '/console/midjourney',
  setting: '/console/setting',
  about: '/about',
  detail: '/console',
  pricing: '/pricing',
  task: '/console/task',
  models: '/console/models',
  playground: '/console/playground',
  personal: '/console/personal',
};

const SiderBar = ({ onNavigate = () => { } }) => {
  const { t } = useTranslation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const [selectedKeys, setSelectedKeys] = useState(['home']);
  const [chatItems, setChatItems] = useState([]);
  const [openedKeys, setOpenedKeys] = useState([]);
  const location = useLocation();
  const [routerMapState, setRouterMapState] = useState(routerMap);

  const workspaceItems = useMemo(
    () => [
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
    ],
    [
      localStorage.getItem('enable_data_export'),
      localStorage.getItem('enable_drawing'),
      localStorage.getItem('enable_task'),
      t,
    ],
  );

  const financeItems = useMemo(
    () => [
      {
        text: t('钱包'),
        itemKey: 'topup',
        to: '/topup',
      },
      {
        text: t('个人设置'),
        itemKey: 'personal',
        to: '/personal',
      },
    ],
    [t],
  );

  const adminItems = useMemo(
    () => [
      {
        text: t('渠道管理'),
        itemKey: 'channel',
        to: '/channel',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('模型管理'),
        itemKey: 'models',
        to: '/console/models',
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
    ],
    [isAdmin(), isRoot(), t],
  );

  const chatMenuItems = useMemo(
    () => [
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
    ],
    [chatItems, t],
  );

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
              if (link.startsWith('fluent')) {
                shouldSkip = true;
                break; // 跳过 Fluent Read
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
        console.error(e);
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

  // 选中高亮颜色（统一）
  const SELECTED_COLOR = 'var(--semi-color-primary)';

  // 渲染自定义菜单项
  const renderNavItem = (item) => {
    // 跳过隐藏的项目
    if (item.className === 'tableHiddle') return null;

    const isSelected = selectedKeys.includes(item.itemKey);
    const textColor = isSelected ? SELECTED_COLOR : 'inherit';

    return (
      <Nav.Item
        key={item.itemKey}
        itemKey={item.itemKey}
        text={
          <div className="flex items-center">
            <span className="truncate font-medium text-sm" style={{ color: textColor }}>
              {item.text}
            </span>
          </div>
        }
        icon={
          <div className="sidebar-icon-container flex-shrink-0">
            {getLucideIcon(item.itemKey, isSelected)}
          </div>
        }
        className={item.className}
      />
    );
  };

  // 渲染子菜单项
  const renderSubItem = (item) => {
    if (item.items && item.items.length > 0) {
      const isSelected = selectedKeys.includes(item.itemKey);
      const textColor = isSelected ? SELECTED_COLOR : 'inherit';

      return (
        <Nav.Sub
          key={item.itemKey}
          itemKey={item.itemKey}
          text={
            <div className="flex items-center">
              <span className="truncate font-medium text-sm" style={{ color: textColor }}>
                {item.text}
              </span>
            </div>
          }
          icon={
            <div className="sidebar-icon-container flex-shrink-0">
              {getLucideIcon(item.itemKey, isSelected)}
            </div>
          }
        >
          {item.items.map((subItem) => {
            const isSubSelected = selectedKeys.includes(subItem.itemKey);
            const subTextColor = isSubSelected ? SELECTED_COLOR : 'inherit';

            return (
              <Nav.Item
                key={subItem.itemKey}
                itemKey={subItem.itemKey}
                text={
                  <span className="truncate font-medium text-sm" style={{ color: subTextColor }}>
                    {subItem.text}
                  </span>
                }
              />
            );
          })}
        </Nav.Sub>
      );
    } else {
      return renderNavItem(item);
    }
  };

  return (
    <div
      className="sidebar-container"
      style={{ width: 'var(--sidebar-current-width)' }}
    >
      <Nav
        className="sidebar-nav"
        defaultIsCollapsed={collapsed}
        isCollapsed={collapsed}
        onCollapseChange={toggleCollapsed}
        selectedKeys={selectedKeys}
        itemStyle="sidebar-nav-item"
        hoverStyle="sidebar-nav-item:hover"
        selectedStyle="sidebar-nav-item-selected"
        renderWrapper={({ itemElement, props }) => {
          const to = routerMapState[props.itemKey] || routerMap[props.itemKey];

          // 如果没有路由，直接返回元素
          if (!to) return itemElement;

          return (
            <Link
              style={{ textDecoration: 'none' }}
              to={to}
              onClick={onNavigate}
            >
              {itemElement}
            </Link>
          );
        }}
        onSelect={(key) => {
          // 如果点击的是已经展开的子菜单的父项，则收起子菜单
          if (openedKeys.includes(key.itemKey)) {
            setOpenedKeys(openedKeys.filter((k) => k !== key.itemKey));
          }

          setSelectedKeys([key.itemKey]);
        }}
        openKeys={openedKeys}
        onOpenChange={(data) => {
          setOpenedKeys(data.openKeys);
        }}
      >
        {/* 聊天区域 */}
        <div className="sidebar-section">
          {!collapsed && (
            <div className="sidebar-group-label">{t('聊天')}</div>
          )}
          {chatMenuItems.map((item) => renderSubItem(item))}
        </div>

        {/* 控制台区域 */}
        <Divider className="sidebar-divider" />
        <div>
          {!collapsed && (
            <div className="sidebar-group-label">{t('控制台')}</div>
          )}
          {workspaceItems.map((item) => renderNavItem(item))}
        </div>

        {/* 管理员区域 - 只在管理员时显示 */}
        {isAdmin() && (
          <>
            <Divider className="sidebar-divider" />
            <div>
              {!collapsed && (
                <div className="sidebar-group-label">{t('管理员')}</div>
              )}
              {adminItems.map((item) => renderNavItem(item))}
            </div>
          </>
        )}

        {/* 个人中心区域 */}
        <Divider className="sidebar-divider" />
        <div>
          {!collapsed && (
            <div className="sidebar-group-label">{t('个人中心')}</div>
          )}
          {financeItems.map((item) => renderNavItem(item))}
        </div>
      </Nav>

      {/* 底部折叠按钮 */}
      <div className="sidebar-collapse-button">
        <Button
          theme="outline"
          type="tertiary"
          size="small"
          icon={
            <ChevronLeft
              size={16}
              strokeWidth={2.5}
              color="var(--semi-color-text-2)"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          }
          onClick={toggleCollapsed}
          icononly={collapsed}
          style={collapsed ? { padding: '4px', width: '100%' } : { padding: '4px 12px', width: '100%' }}
        >
          {!collapsed ? t('收起侧边栏') : null}
        </Button>
      </div>
    </div>
  );
};

export default SiderBar;
