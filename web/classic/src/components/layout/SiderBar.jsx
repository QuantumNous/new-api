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
import { UserContext } from '../../context/User';
import { getLucideIcon } from '../../helpers/render';
import { ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { useFeedbackUnread } from '../../hooks/common/useFeedbackUnread';
import { useReviewPendingCounts } from '../../hooks/common/useReviewPendingCounts';
import { isAdmin, isRoot, showError } from '../../helpers';
import SkeletonWrapper from './components/SkeletonWrapper';

import { Nav, Divider, Button } from '@douyinfe/semi-ui';

const routerMap = {
  home: '/',
  channel: '/console/channel',
  token: '/console/token',
  redemption: '/console/redemption',
  topup: '/console/topup',
  user: '/console/user',
  subscription: '/console/subscription',
  reconcile: '/console/reconcile',
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
  video: '/console/video',
  image: '/console/image',
  personal: '/console/personal',
  kyc: '/console/kyc',
  enterprise: '/console/enterprise',
  bankTransfer: '/console/bank-transfer',
  feedback: '/console/feedback',
  myfeedback: '/console/myfeedback',
  subAccounts: '/console/sub-accounts',
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
  const { userUnread, adminUnread } = useFeedbackUnread();
  const reviewCounts = useReviewPendingCounts();

  // 子账户视图强制覆盖（设计 §4.6）：不依赖用户自己的 Setting JSON，按 parent_user_id 渲染层硬覆盖。
  //   - 子账户（parent_user_id>0）：隐藏钱包/绘图日志/操练场/聊天，只保留看板·令牌(只读)·日志·任务·个人设置；
  //   - 企业主账户（enterprise_status===2 且非子账户）：额外显示「子账户管理」入口。
  const [userState] = useContext(UserContext);
  const isSubAccount = (userState?.user?.parent_user_id || 0) > 0;
  const isEnterpriseOwner =
    userState?.user?.enterprise_status === 2 && !isSubAccount;

  // 给菜单文案附一个未读计数小红标
  const withUnreadBadge = (label, count) => {
    if (!count) return label;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {label}
        <span
          style={{
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: 'var(--semi-color-danger)',
            color: '#fff',
            fontSize: 11,
            lineHeight: '16px',
            textAlign: 'center',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      </span>
    );
  };

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
      // 子账户：绘图日志本期不开放（D10），强制隐藏
      if (isSubAccount && item.itemKey === 'midjourney') return false;
      return configVisible;
    });

    return filteredItems;
  }, [
    localStorage.getItem('enable_data_export'),
    localStorage.getItem('enable_drawing'),
    localStorage.getItem('enable_task'),
    t,
    isModuleVisible,
    isSubAccount,
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
      {
        text: withUnreadBadge(t('我的工单'), userUnread),
        itemKey: 'myfeedback',
        to: '/console/myfeedback',
      },
    ];

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('personal', item.itemKey);
      // 子账户强制隐藏：钱包管理（不能充值）、个人设置（配置项过多，凭证由企业管理、
      // 密码走企业重置）。只读子账户的个人中心仅保留剩余必要入口。
      if (
        isSubAccount &&
        (item.itemKey === 'topup' || item.itemKey === 'personal')
      ) {
        return false;
      }
      return configVisible;
    });

    // 企业主账户额外显示「子账户管理」入口（绕过 isModuleVisible，配置中无此模块）。
    if (isEnterpriseOwner) {
      filteredItems.push({
        text: t('子账户管理'),
        itemKey: 'subAccounts',
        to: '/sub-accounts',
      });
    }

    return filteredItems;
  }, [t, isModuleVisible, userUnread, isSubAccount, isEnterpriseOwner]);

  const adminItems = useMemo(() => {
    const items = [
      {
        text: t('渠道管理'),
        itemKey: 'channel',
        to: '/channel',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('对账管理'),
        itemKey: 'reconcile',
        to: '/reconcile',
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
        text: withUnreadBadge(t('工单管理'), adminUnread),
        itemKey: 'feedback',
        to: '/console/feedback',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: withUnreadBadge(t('实名认证'), reviewCounts.kyc),
        itemKey: 'kyc',
        to: '/kyc',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: withUnreadBadge(t('企业认证'), reviewCounts.enterprise),
        itemKey: 'enterprise',
        to: '/enterprise',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: withUnreadBadge(t('对公转账'), reviewCounts.bank_transfer_total),
        itemKey: 'bankTransfer',
        to: '/bank-transfer',
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
  }, [isAdmin(), isRoot(), t, isModuleVisible, adminUnread, reviewCounts]);

  const chatMenuItems = useMemo(() => {
    const items = [
      {
        text: t('文本模型'),
        itemKey: 'playground',
        to: '/playground',
      },
      {
        text: t('图片模型'),
        itemKey: 'image',
        to: '/image',
      },
      {
        text: t('视频模型'),
        itemKey: 'video',
        to: '/video',
      },
      {
        text: t('聊天'),
        itemKey: 'chat',
        items: chatItems,
      },
    ];

    // 子账户：操练场/聊天强制隐藏（D9，子账户 quota=0 天然无法消费，前端同时隐藏入口）
    if (isSubAccount) {
      return [];
    }

    // 根据配置过滤项目
    const filteredItems = items.filter((item) => {
      const configVisible = isModuleVisible('chat', item.itemKey);
      return configVisible;
    });

    return filteredItems;
  }, [chatItems, t, isModuleVisible, isSubAccount]);

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
              if (
                link.startsWith('fluent') ||
                link.startsWith('ccswitch') ||
                link.startsWith('deepchat')
              ) {
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
          <span
            className='truncate font-medium text-sm'
            style={{ color: textColor }}
          >
            {item.text}
          </span>
        }
        icon={
          <div className='sidebar-icon-container flex-shrink-0'>
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
            <span
              className='truncate font-medium text-sm'
              style={{ color: textColor }}
            >
              {item.text}
            </span>
          }
          icon={
            <div className='sidebar-icon-container flex-shrink-0'>
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
                  <span
                    className='truncate font-medium text-sm'
                    style={{ color: subTextColor }}
                  >
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
      className='sidebar-container'
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
        <Nav
          className='sidebar-nav'
          defaultIsCollapsed={collapsed}
          isCollapsed={collapsed}
          onCollapseChange={toggleCollapsed}
          selectedKeys={selectedKeys}
          itemStyle='sidebar-nav-item'
          hoverStyle='sidebar-nav-item:hover'
          selectedStyle='sidebar-nav-item-selected'
          renderWrapper={({ itemElement, props }) => {
            const to =
              routerMapState[props.itemKey] || routerMap[props.itemKey];

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
          {/* 聊天区域 —— 子账户整组隐藏（含「聊天」分组标签，菜单项已在 chatMenuItems 清空） */}
          {!isSubAccount && hasSectionVisibleModules('chat') && (
            <div className='sidebar-section'>
              {!collapsed && (
                <div className='sidebar-group-label'>{t('爱芯AI智能助手')}</div>
              )}
              {chatMenuItems.map((item) => renderSubItem(item))}
            </div>
          )}

          {/* 控制台区域 */}
          {hasSectionVisibleModules('console') && (
            <>
              <Divider className='sidebar-divider' />
              <div>
                {!collapsed && (
                  <div className='sidebar-group-label'>{t('控制台')}</div>
                )}
                {workspaceItems.map((item) => renderNavItem(item))}
              </div>
            </>
          )}

          {/* 个人中心区域 */}
          {hasSectionVisibleModules('personal') && (
            <>
              <Divider className='sidebar-divider' />
              <div>
                {!collapsed && (
                  <div className='sidebar-group-label'>{t('个人中心')}</div>
                )}
                {financeItems.map((item) => renderNavItem(item))}
              </div>
            </>
          )}

          {/* 管理员区域 - 只在管理员时显示且配置允许时显示 */}
          {isAdmin() && hasSectionVisibleModules('admin') && (
            <>
              <Divider className='sidebar-divider' />
              <div>
                {!collapsed && (
                  <div className='sidebar-group-label'>{t('管理员')}</div>
                )}
                {adminItems.map((item) => renderNavItem(item))}
              </div>
            </>
          )}
        </Nav>
      </SkeletonWrapper>

      {/* 底部折叠按钮 */}
      <div className='sidebar-collapse-button'>
        <SkeletonWrapper
          loading={showSkeleton}
          type='button'
          width={collapsed ? 36 : 156}
          height={24}
          className='w-full'
        >
          <Button
            theme='outline'
            type='tertiary'
            size='small'
            icon={
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
                color='var(--semi-color-text-2)'
                style={{
                  transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            }
            onClick={toggleCollapsed}
            icononly={collapsed}
            style={
              collapsed
                ? { width: 36, height: 24, padding: 0 }
                : { padding: '4px 12px', width: '100%' }
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
