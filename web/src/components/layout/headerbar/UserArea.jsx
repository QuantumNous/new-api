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

import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Dropdown, Typography } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import {
  IconExit,
  IconUserSetting,
  IconCreditCard,
  IconKey,
} from '@douyinfe/semi-icons';
import { stringToColor } from '../../../helpers';
import SkeletonWrapper from '../components/SkeletonWrapper';

const UserArea = ({
  userState,
  isLoading,
  isMobile,
  isSelfUseMode,
  logout,
  navigate,
  t,
}) => {
  const dropdownRef = useRef(null);
  if (isLoading) {
    return (
      <SkeletonWrapper
        loading={true}
        type='userArea'
        width={50}
        isMobile={isMobile}
      />
    );
  }

  if (userState.user) {
    const menuItemClass = 'na-header-menu-item';
    const menuIconClass = 'na-header-menu-icon';

    return (
      <div className='relative' ref={dropdownRef}>
        <Dropdown
          position='bottomRight'
          getPopupContainer={() => dropdownRef.current}
          render={
            <Dropdown.Menu className='na-header-dropdown'>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/personal');
                }}
                className={menuItemClass}
              >
                <div className='na-header-menu-item'>
                  <IconUserSetting size='small' className={menuIconClass} />
                  <span>{t('个人设置')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/token');
                }}
                className={menuItemClass}
              >
                <div className='na-header-menu-item'>
                  <IconKey size='small' className={menuIconClass} />
                  <span>{t('令牌管理')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/topup');
                }}
                className={menuItemClass}
              >
                <div className='na-header-menu-item'>
                  <IconCreditCard size='small' className={menuIconClass} />
                  <span>{t('钱包管理')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item onClick={logout} className={menuItemClass}>
                <div className='na-header-menu-item'>
                  <IconExit size='small' className={menuIconClass} />
                  <span>{t('退出')}</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            theme='borderless'
            type='tertiary'
            className='na-header-user-button'
          >
            <Avatar
              size='extra-small'
              color={stringToColor(userState.user.username)}
              className='mr-1'
            >
              {userState.user.username[0].toUpperCase()}
            </Avatar>
            <span className='hidden md:inline'>
              <Typography.Text className='na-header-user-name'>
                {userState.user.username}
              </Typography.Text>
            </span>
            <ChevronDown size={14} className='na-header-menu-icon' />
          </Button>
        </Dropdown>
      </div>
    );
  } else {
    const showRegisterButton = !isSelfUseMode;

    return (
      <div className='na-header-auth-set'>
        <Link to='/login' className='na-header-auth-link'>
          <Button
            theme='borderless'
            type='tertiary'
            className='na-header-auth-button na-header-auth-button-login'
          >
            <span className='na-header-auth-button-text'>{t('登录')}</span>
          </Button>
        </Link>
        {showRegisterButton && (
          <div className='hidden md:block'>
            <Link to='/register' className='na-header-auth-link'>
              <Button
                theme='solid'
                type='primary'
                className='na-header-auth-button na-header-auth-button-register'
              >
                <span className='na-header-auth-button-text-primary'>
                  {t('注册')}
                </span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }
};

export default UserArea;
