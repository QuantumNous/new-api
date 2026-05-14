import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Nav, Divider, Button } from '@douyinfe/semi-ui';
import { ChevronLeft } from 'lucide-react';
import { getLucideIcon } from '../../helpers/render';
import { isAdmin, isRoot } from '../../helpers';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import SkeletonWrapper from './components/SkeletonWrapper';

const routerMap = {
  home: '/',
  detail: '/console',
  playground: '/console/playground',
  agent: '/console/agent',
  chat: '/console/chat',
  token: '/console/token',
  log: '/console/log',
  midjourney: '/console/midjourney',
  task: '/console/task',
  topup: '/console/topup',
  personal: '/console/personal',
  channel: '/console/channel',
  subscription: '/console/subscription',
  models: '/console/models',
  deployment: '/console/deployment',
  redemption: '/console/redemption',
  user: '/console/user',
  agentAdmin: '/console/agent/admin',
  setting: '/console/setting',
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
  const location = useLocation();

  const chatItems = useMemo(
    () =>
      [
        { text: t('Agent Assistant'), itemKey: 'agent' },
        { text: t('Playground'), itemKey: 'playground' },
        { text: t('Chat'), itemKey: 'chat' },
      ].filter((item) => isModuleVisible('chat', item.itemKey)),
    [t, isModuleVisible],
  );

  const workspaceItems = useMemo(
    () =>
      [
        { text: t('Dashboard'), itemKey: 'detail' },
        { text: t('Token Management'), itemKey: 'token' },
        { text: t('Usage Logs'), itemKey: 'log' },
        {
          text: t('Drawing Logs'),
          itemKey: 'midjourney',
          className:
            localStorage.getItem('enable_drawing') === 'true'
              ? ''
              : 'tableHiddle',
        },
        {
          text: t('Task Logs'),
          itemKey: 'task',
          className:
            localStorage.getItem('enable_task') === 'true'
              ? ''
              : 'tableHiddle',
        },
      ].filter((item) => isModuleVisible('console', item.itemKey)),
    [t, isModuleVisible],
  );

  const financeItems = useMemo(
    () =>
      [
        { text: t('Wallet'), itemKey: 'topup' },
        { text: t('Personal Settings'), itemKey: 'personal' },
      ].filter((item) => isModuleVisible('personal', item.itemKey)),
    [t, isModuleVisible],
  );

  const adminItems = useMemo(
    () =>
      [
        {
          text: t('Channel Management'),
          itemKey: 'channel',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('Subscription Management'),
          itemKey: 'subscription',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('Model Management'),
          itemKey: 'models',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('Model Deployment'),
          itemKey: 'deployment',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('Redemption Management'),
          itemKey: 'redemption',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('User Management'),
          itemKey: 'user',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('Agent Admin'),
          itemKey: 'agentAdmin',
          className: isAdmin() ? '' : 'tableHiddle',
        },
        {
          text: t('System Settings'),
          itemKey: 'setting',
          className: isRoot() ? '' : 'tableHiddle',
        },
      ].filter((item) => isModuleVisible('admin', item.itemKey)),
    [t, isModuleVisible],
  );

  useEffect(() => {
    const currentPath = location.pathname;
    let matchingKey = Object.keys(routerMap).find(
      (key) => routerMap[key] === currentPath,
    );
    if (!matchingKey && currentPath.startsWith('/console/chat')) {
      matchingKey = 'chat';
    }
    if (matchingKey) {
      setSelectedKeys([matchingKey]);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  const renderNavItem = (item) => {
    if (item.className === 'tableHiddle') return null;
    const isSelected = selectedKeys.includes(item.itemKey);
    const textColor = isSelected ? 'var(--semi-color-primary)' : 'inherit';
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

  const renderSection = (title, items) => {
    const renderedItems = items.map(renderNavItem).filter(Boolean);
    if (renderedItems.length === 0) return null;
    return (
      <div className='sidebar-section'>
        {!collapsed && <div className='sidebar-group-label'>{title}</div>}
        {renderedItems}
      </div>
    );
  };

  return (
    <div
      className='sidebar-container'
      style={{ width: 'var(--sidebar-current-width)' }}
    >
      <SkeletonWrapper
        loading={showSkeleton}
        type='sidebar'
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
            const to = routerMap[props.itemKey];
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
          onSelect={(key) => setSelectedKeys([key.itemKey])}
        >
          {hasSectionVisibleModules('chat') &&
            renderSection(t('Chat'), chatItems)}
          {hasSectionVisibleModules('console') && (
            <>
              <Divider className='sidebar-divider' />
              {renderSection(t('Console'), workspaceItems)}
            </>
          )}
          {hasSectionVisibleModules('personal') && (
            <>
              <Divider className='sidebar-divider' />
              {renderSection(t('Personal'), financeItems)}
            </>
          )}
          {isAdmin() && hasSectionVisibleModules('admin') && (
            <>
              <Divider className='sidebar-divider' />
              {renderSection(t('Admin'), adminItems)}
            </>
          )}
        </Nav>
      </SkeletonWrapper>
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
            {!collapsed ? t('Collapse Sidebar') : null}
          </Button>
        </SkeletonWrapper>
      </div>
    </div>
  );
};

export default SiderBar;
