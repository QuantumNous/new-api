import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Dropdown, Typography } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import { IconExit, IconUserSetting, IconGridView } from '@douyinfe/semi-icons';
import { stringToColor } from '../../../helpers';

const MarketingHeader = ({
  mainNavLinks,
  logo,
  logoLoaded,
  systemName,
  isSelfUseMode,
  userState,
  logout,
  navigate,
  currentPath,
  t,
}) => {
  const dropdownRef = useRef(null);
  const visibleNavLinks = useMemo(
    () => mainNavLinks.filter((link) => link.itemKey !== 'console'),
    [mainNavLinks],
  );
  const navLabelMap = useMemo(
    () => ({
      pricing: t('定价'),
      docs: t('使用教程'),
      about: t('关于我们'),
    }),
    [t],
  );

  const showSecondaryAction = !userState?.user && !isSelfUseMode;
  const marketingBrandName = 'AI Force';
  const consoleActionTo = userState?.user ? '/console' : '/login';
  const isAuthRoute = [
    '/login',
    '/register',
    '/reset',
    '/user/reset',
  ].includes(currentPath);
  const authButtonClassName = isAuthRoute
    ? 'marketing-header-auth marketing-header-auth--compact'
    : 'marketing-header-auth';

  return (
    <div className='app-header-shell__frame'>
      <div className='app-header-shell__content'>
        <Link to='/' className='marketing-brand'>
          <span className='marketing-brand__mark'>
            <img
              src={logo}
              alt={systemName}
              className={`marketing-brand__logo ${logoLoaded ? 'is-loaded' : ''}`}
            />
          </span>
          <span className='marketing-brand__name'>{marketingBrandName}</span>
        </Link>

        <div className='marketing-header-nav-wrap'>
          <nav className='marketing-header-nav'>
            {visibleNavLinks.map((link) => {
              const isActive =
                (link.itemKey === 'home' && currentPath === '/') ||
                (link.itemKey === 'pricing' && currentPath === '/pricing') ||
                (link.itemKey === 'docs' && currentPath === '/docs') ||
                (link.itemKey === 'about' && currentPath === '/about');
              const className =
                isActive
                  ? 'marketing-header-nav__link marketing-header-nav__link--active'
                  : 'marketing-header-nav__link';

              if (link.isExternal) {
                return (
                  <a
                    key={link.itemKey}
                    href={link.externalLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={className}
                  >
                    {navLabelMap[link.itemKey] || link.text}
                  </a>
                );
              }

              return (
                <Link key={link.itemKey} to={link.to} className={className}>
                  {navLabelMap[link.itemKey] || link.text}
                </Link>
              );
            })}
          </nav>
        </div>

        {!isAuthRoute && (
          <>
            <Link to={consoleActionTo} className='marketing-header-console-link'>
              {t('控制台')}
            </Link>

            <div className='marketing-header-divider' />
          </>
        )}

        <div className='marketing-header-actions'>
          {userState?.user ? (
            <div className='marketing-header-user-dropdown' ref={dropdownRef}>
              <Dropdown
                position='bottomRight'
                getPopupContainer={() => dropdownRef.current}
                render={
                  <Dropdown.Menu className='marketing-header-user-menu'>
                    <Dropdown.Item
                      onClick={() => {
                        navigate('/console');
                      }}
                    >
                      <div className='marketing-header-user-menu__item'>
                        <IconGridView size='small' />
                        <span>{t('进入控制台')}</span>
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        navigate('/console/personal');
                      }}
                    >
                      <div className='marketing-header-user-menu__item'>
                        <IconUserSetting size='small' />
                        <span>{t('个人设置')}</span>
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item onClick={logout}>
                      <div className='marketing-header-user-menu__item'>
                        <IconExit size='small' />
                        <span>{t('退出')}</span>
                      </div>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                }
              >
                <Button
                  theme='borderless'
                  type='tertiary'
                  className='marketing-header-user-trigger'
                >
                  <Avatar
                    size='small'
                    color={stringToColor(userState.user.username)}
                    className='marketing-header-user-trigger__avatar'
                  >
                    {userState.user.username[0]?.toUpperCase()}
                  </Avatar>
                  <Typography.Text className='marketing-header-user-trigger__name'>
                    {userState.user.username}
                  </Typography.Text>
                  <ChevronDown
                    size={14}
                    className='marketing-header-user-trigger__icon'
                  />
                </Button>
              </Dropdown>
            </div>
          ) : (
            showSecondaryAction && (
              <Link
                to='/register'
                className={`${authButtonClassName} marketing-header-auth--ghost`}
              >
                {t('注册')}
              </Link>
            )
          )}

          {!userState?.user && (
            <Link
              to='/login'
              className={`${authButtonClassName} marketing-header-auth--solid`}
            >
              {t('登录')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingHeader;
