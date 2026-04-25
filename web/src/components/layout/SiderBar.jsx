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
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { getLucideIcon } from '../../helpers/render';
import { isAdmin, isRoot, showError, stringToColor } from '../../helpers';
import { useSidebar } from '../../hooks/common/useSidebar';
import { UserContext } from '../../context/User';

// Maps an item key to its concrete route. Mirrors the router definitions in
// `src/App.jsx`. Chat sub-items are appended dynamically below.
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

// Wraps the menu items in both the desktop Sidebar and the mobile sheet.
// Centralized here so both code paths stay structurally identical and only
// differ in their wrapper component.
const SidebarBody = ({
  workspaceItems,
  financeItems,
  adminItems,
  chatMenuItems,
  hasSectionVisibleModules,
  routerMapState,
  selectedKeys,
  expandedChatKeys,
  setExpandedChatKeys,
  userMenuFooter,
  t,
}) => {
  const renderMenuItem = (item) => {
    if (item.className === 'tableHiddle') return null;
    const path = routerMapState[item.itemKey] || routerMap[item.itemKey] || item.to;
    // Skip items with no resolvable route — see renderChatMenuItem comment
    // for why a hrefless Sidebar.MenuItem breaks the menu layout.
    if (!path) return null;
    const isCurrent = selectedKeys.includes(item.itemKey);

    return (
      <Sidebar.MenuItem
        key={item.itemKey}
        id={item.itemKey}
        href={path}
        isCurrent={isCurrent}
        textValue={item.text}
      >
        <Sidebar.MenuIcon>{getLucideIcon(item.itemKey, isCurrent)}</Sidebar.MenuIcon>
        <Sidebar.MenuLabel>{item.text}</Sidebar.MenuLabel>
      </Sidebar.MenuItem>
    );
  };

  // Chat parent item with optional sub-list of saved chats.
  //
  // Two non-obvious constraints from heroui-pro <Sidebar.MenuItem>:
  //   - Every MenuItem must be pressable (href OR onPress). A MenuItem
  //     without either fires `PressResponder was rendered without a
  //     pressable child` from react-aria and breaks subsequent siblings'
  //     layout in the menu.
  //   - The chat parent has no inherent route (no entry in routerMap, no
  //     `to` field), so when there are no saved chats we just skip it
  //     instead of emitting a hrefless item.
  const renderChatMenuItem = (item) => {
    if (item.className === 'tableHiddle') return null;
    const isCurrent = selectedKeys.includes(item.itemKey);
    const hasChildren = Array.isArray(item.items) && item.items.length > 0;

    if (!hasChildren) {
      // No saved chats yet — don't render an empty placeholder.
      return null;
    }

    // Point the parent at the first saved chat so the MenuItem stays
    // pressable; the MenuTrigger inside takes care of expanding the
    // submenu without losing this fallback navigation.
    const fallbackHref =
      routerMapState[item.items[0].itemKey] || item.items[0].to;

    return (
      <Sidebar.MenuItem
        key={item.itemKey}
        id={item.itemKey}
        href={fallbackHref || undefined}
        isCurrent={isCurrent}
        textValue={item.text}
      >
        <Sidebar.MenuIcon>
          {getLucideIcon(item.itemKey, isCurrent)}
        </Sidebar.MenuIcon>
        <Sidebar.MenuLabel>{item.text}</Sidebar.MenuLabel>
        <Sidebar.MenuTrigger>
          <Sidebar.MenuIndicator />
        </Sidebar.MenuTrigger>
        <Sidebar.Submenu>
          {item.items.map((subItem) => {
            const subPath =
              routerMapState[subItem.itemKey] || subItem.to;
            const subIsCurrent = selectedKeys.includes(subItem.itemKey);
            // Skip sub-items missing a route to avoid the same
            // PressResponder error documented above.
            if (!subPath) return null;
            return (
              <Sidebar.MenuItem
                key={subItem.itemKey}
                id={subItem.itemKey}
                href={subPath}
                isCurrent={subIsCurrent}
                textValue={subItem.text}
              >
                <Sidebar.MenuLabel>{subItem.text}</Sidebar.MenuLabel>
              </Sidebar.MenuItem>
            );
          })}
        </Sidebar.Submenu>
      </Sidebar.MenuItem>
    );
  };

  const visibleSections = [
    {
      key: 'chat',
      label: t('聊天'),
      visible: hasSectionVisibleModules('chat'),
      items: chatMenuItems,
      renderer: renderChatMenuItem,
    },
    {
      key: 'console',
      label: t('控制台'),
      visible: hasSectionVisibleModules('console'),
      items: workspaceItems,
      renderer: renderMenuItem,
    },
    {
      key: 'personal',
      label: t('个人中心'),
      visible: hasSectionVisibleModules('personal'),
      items: financeItems,
      renderer: renderMenuItem,
    },
    {
      key: 'admin',
      label: t('管理员'),
      visible: isAdmin() && hasSectionVisibleModules('admin'),
      items: adminItems,
      renderer: renderMenuItem,
    },
  ].filter((section) => section.visible && section.items.length > 0);

  // Per product spec we deviate from template-dashboard in two ways:
  //   1. The collapse trigger lives in the top navbar (rendered by HeaderBar
  //      via <Sidebar.Trigger />), not inside the sidebar itself.
  //   2. The user avatar / role block sits at the BOTTOM of the sidebar
  //      (Sidebar.Footer), not at the top.
  //
  // Always render Sidebar.Footer (even with empty user) so the slot is
  // present in the DOM at mount and heroui-pro lays out Content vs Footer
  // correctly. Conditionally rendering Footer caused it to silently
  // disappear when userState.user resolved after the initial render.
  return (
    <>
      <Sidebar.Content>
        {visibleSections.map((section) => (
          <Sidebar.Group key={section.key}>
            <Sidebar.GroupLabel>{section.label}</Sidebar.GroupLabel>
            <Sidebar.Menu
              aria-label={section.label}
              expandedKeys={
                section.key === 'chat' ? expandedChatKeys : undefined
              }
              onExpandedChange={
                section.key === 'chat' ? setExpandedChatKeys : undefined
              }
            >
              {section.items.map(section.renderer)}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
      {userMenuFooter ? <Sidebar.Footer>{userMenuFooter}</Sidebar.Footer> : null}
    </>
  );
};

const SiderBar = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const { isModuleVisible, hasSectionVisibleModules } = useSidebar();

  const [selectedKeys, setSelectedKeys] = useState(['home']);
  const [chatItems, setChatItems] = useState([]);
  const [expandedChatKeys, setExpandedChatKeys] = useState(new Set());
  const location = useLocation();
  const [routerMapState, setRouterMapState] = useState(routerMap);

  const workspaceItems = useMemo(() => {
    const items = [
      {
        text: t('数据看板'),
        itemKey: 'detail',
        to: '/console',
        className:
          localStorage.getItem('enable_data_export') === 'true'
            ? ''
            : 'tableHiddle',
      },
      {
        text: t('令牌管理'),
        itemKey: 'token',
        to: '/console/token',
      },
      {
        text: t('使用日志'),
        itemKey: 'log',
        to: '/console/log',
      },
      {
        text: t('绘图日志'),
        itemKey: 'midjourney',
        to: '/console/midjourney',
        className:
          localStorage.getItem('enable_drawing') === 'true'
            ? ''
            : 'tableHiddle',
      },
      {
        text: t('任务日志'),
        itemKey: 'task',
        to: '/console/task',
        className:
          localStorage.getItem('enable_task') === 'true' ? '' : 'tableHiddle',
      },
    ];

    return items.filter((item) => isModuleVisible('console', item.itemKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        to: '/console/topup',
      },
      {
        text: t('个人设置'),
        itemKey: 'personal',
        to: '/console/personal',
      },
    ];

    return items.filter((item) => isModuleVisible('personal', item.itemKey));
  }, [t, isModuleVisible]);

  const adminItems = useMemo(() => {
    const items = [
      {
        text: t('渠道管理'),
        itemKey: 'channel',
        to: '/console/channel',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('订阅管理'),
        itemKey: 'subscription',
        to: '/console/subscription',
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
        to: '/console/deployment',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('兑换码管理'),
        itemKey: 'redemption',
        to: '/console/redemption',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('用户管理'),
        itemKey: 'user',
        to: '/console/user',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('系统设置'),
        itemKey: 'setting',
        to: '/console/setting',
        className: isRoot() ? '' : 'tableHiddle',
      },
    ];

    return items.filter((item) => isModuleVisible('admin', item.itemKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin(), isRoot(), t, isModuleVisible]);

  const chatMenuItems = useMemo(() => {
    const items = [
      {
        text: t('操练场'),
        itemKey: 'playground',
        to: '/console/playground',
      },
      {
        text: t('聊天'),
        itemKey: 'chat',
        items: chatItems,
      },
    ];

    return items.filter((item) => isModuleVisible('chat', item.itemKey));
  }, [chatItems, t, isModuleVisible]);

  // Add chat sub-routes to the router map so selection logic can match them.
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

  useEffect(() => {
    let chats = localStorage.getItem('chats');
    if (chats) {
      try {
        chats = JSON.parse(chats);
        if (Array.isArray(chats)) {
          let parsed = [];
          for (let i = 0; i < chats.length; i++) {
            let shouldSkip = false;
            let chat = {};
            for (let key in chats[i]) {
              let link = chats[i][key];
              if (typeof link !== 'string') continue;
              if (link.startsWith('fluent') || link.startsWith('ccswitch')) {
                shouldSkip = true;
                break;
              }
              chat.text = key;
              chat.itemKey = 'chat' + i;
              chat.to = '/console/chat/' + i;
            }
            if (shouldSkip || !chat.text) continue;
            parsed.push(chat);
          }
          setChatItems(parsed);
          updateRouterMapWithChats(chats);
        }
      } catch (e) {
        showError('聊天数据解析失败');
      }
    }
  }, []);

  // Sync selected key + auto-expand chat group when on a chat sub-route.
  useEffect(() => {
    const currentPath = location.pathname;
    let matchingKey = Object.keys(routerMapState).find(
      (key) => routerMapState[key] === currentPath,
    );

    if (!matchingKey && currentPath.startsWith('/console/chat/')) {
      const chatIndex = currentPath.split('/').pop();
      if (!isNaN(chatIndex)) {
        matchingKey = 'chat' + chatIndex;
      } else {
        matchingKey = 'chat';
      }
    }

    if (matchingKey) {
      setSelectedKeys([matchingKey]);
      if (matchingKey.startsWith('chat')) {
        setExpandedChatKeys((prev) => {
          if (prev.has('chat')) return prev;
          const next = new Set(prev);
          next.add('chat');
          return next;
        });
      }
    }
  }, [location.pathname, routerMapState]);

  // Template-style user block: avatar + display name + role rendered as a
  // single Sidebar.MenuItem inside Sidebar.Footer's Sidebar.Menu. Reusing
  // Sidebar.MenuItem's slot system is what gets the avatar visible at all
  // — Sidebar.Footer otherwise refuses to render arbitrary children with
  // the same alignment/spacing the rest of the sidebar uses.
  const userMenuFooter = useMemo(() => {
    if (!userState?.user) return null;
    const username =
      userState.user.display_name || userState.user.username || '';
    const initial = username ? username[0].toUpperCase() : '?';
    const roleLabel = isRoot()
      ? t('超级管理员')
      : isAdmin()
        ? t('管理员')
        : t('用户');
    const avatarBg = stringToColor(username);

    return (
      <Sidebar.Menu aria-label={t('账户信息')}>
        <Sidebar.MenuItem
          id='__user'
          href='/console/personal'
          textValue={username}
        >
          <Sidebar.MenuIcon>
            <Avatar
              size='sm'
              className='h-6 w-6 shrink-0 text-[10px] text-white'
              style={{ backgroundColor: avatarBg }}
              name={initial}
            />
          </Sidebar.MenuIcon>
          <Sidebar.MenuLabel>
            <span className='flex flex-col leading-tight'>
              <span className='truncate text-sm font-medium text-foreground'>
                {username}
              </span>
              <span className='truncate text-xs font-medium text-muted'>
                {roleLabel}
              </span>
            </span>
          </Sidebar.MenuLabel>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    );
  }, [userState?.user, t]);

  const sharedBodyProps = {
    workspaceItems,
    financeItems,
    adminItems,
    chatMenuItems,
    hasSectionVisibleModules,
    routerMapState,
    selectedKeys,
    expandedChatKeys,
    setExpandedChatKeys,
    userMenuFooter,
    t,
  };

  // The custom skeleton previously wrapped <SidebarBody/> using the old
  // self-implemented sidebar's dimensions, which broke alignment when nested
  // inside heroui-pro's <Sidebar> (which expects Sidebar.Header / .Content /
  // .Footer children with its own internal layout). Render the real Sidebar
  // structure immediately — visibleSections already gracefully empties while
  // useSidebar() is still resolving, so the menu just briefly shows nothing
  // instead of misaligned placeholder bars.
  return (
    <>
      <Sidebar>
        <SidebarBody {...sharedBodyProps} />
      </Sidebar>
      <Sidebar.Mobile>
        <SidebarBody {...sharedBodyProps} />
      </Sidebar.Mobile>
    </>
  );
};

export default SiderBar;
