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
import {
  IconExit,
  IconUserSetting,
  IconCreditCard,
  IconKey,
} from '@douyinfe/semi-icons';
import { stringToColor } from '../../../helpers';
import SkeletonWrapper from '../components/SkeletonWrapper';

const dropdownMenuClassName =
  '!rounded-2xl !border !border-black/[0.06] !bg-white/95 !p-1 !shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:!border-white/10 dark:!bg-[#111827]/95';

const dropdownItemClassName =
  '!rounded-xl !px-3 !py-2 !text-sm !text-semi-color-text-0 hover:!bg-black/[0.04] dark:!text-gray-200 dark:hover:!bg-white/[0.08]';

const ChevronDownIcon = () => (
  <svg
    width='14'
    height='14'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='block'
    aria-hidden='true'
  >
    <path
      d='M6.75 9.75L12 15L17.25 9.75'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

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
    return (
      <div className='relative' ref={dropdownRef}>
        <Dropdown
          position='bottomRight'
          getPopupContainer={() => dropdownRef.current}
          render={
            <Dropdown.Menu className={dropdownMenuClassName}>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/personal');
                }}
                className={dropdownItemClassName}
              >
                <div className='flex items-center gap-2'>
                  <IconUserSetting
                    size='small'
                    className='text-gray-500 dark:text-gray-400'
                  />
                  <span>{t('个人设置')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/token');
                }}
                className={dropdownItemClassName}
              >
                <div className='flex items-center gap-2'>
                  <IconKey
                    size='small'
                    className='text-gray-500 dark:text-gray-400'
                  />
                  <span>{t('令牌管理')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  navigate('/console/topup');
                }}
                className={dropdownItemClassName}
              >
                <div className='flex items-center gap-2'>
                  <IconCreditCard
                    size='small'
                    className='text-gray-500 dark:text-gray-400'
                  />
                  <span>{t('钱包管理')}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={logout}
                className={dropdownItemClassName}
              >
                <div className='flex items-center gap-2'>
                  <IconExit
                    size='small'
                    className='text-gray-500 dark:text-gray-400'
                  />
                  <span>{t('退出')}</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            theme='borderless'
            type='tertiary'
            className='group !h-10 !rounded-full !border-0 !bg-transparent !px-1.5 !text-semi-color-text-0 hover:!bg-black/[0.04] dark:hover:!bg-white/[0.06]'
          >
            <div className='flex items-center gap-2 rounded-full'>
              <Avatar
                size='extra-small'
                color={stringToColor(userState.user.username)}
                className='!h-8 !w-8 !text-[13px] !font-semibold'
              >
                {userState.user.username[0].toUpperCase()}
              </Avatar>
              <span className='hidden md:flex md:max-w-[120px] md:items-center'>
                <Typography.Text className='!truncate !text-[13px] !font-semibold !text-[#0f172a] dark:!text-gray-100'>
                  {userState.user.username}
                </Typography.Text>
              </span>
              <span className='hidden md:flex items-center text-[#64748b] transition-colors duration-200 group-hover:text-[#0f172a] dark:text-gray-400 dark:group-hover:text-gray-200'>
                <ChevronDownIcon />
              </span>
            </div>
          </Button>
        </Dropdown>
      </div>
    );
  } else {
    const showRegisterButton = !isSelfUseMode;

    return (
      <div className='flex items-center gap-2 md:gap-3'>
        <Link to='/login' className='flex'>
          <Button
            theme='borderless'
            type='tertiary'
            className='!h-10 !rounded-full !bg-transparent !px-3 md:!px-4 !text-sm !font-semibold !text-[#0f172a] hover:!bg-black/[0.04] dark:!text-white dark:hover:!bg-white/[0.06]'
          >
            <span>{t('登录')}</span>
          </Button>
        </Link>
        {showRegisterButton && (
          <div className='hidden md:block'>
            <Link to='/register' className='flex'>
              <Button
                theme='solid'
                type='primary'
                className='!h-10 !rounded-full !border-0 !bg-[#111827] !px-6 !text-sm !font-semibold !text-white !shadow-[0_14px_34px_rgba(15,23,42,0.18)] hover:!bg-[#0f172a] dark:!bg-white dark:!text-[#0f172a] dark:!shadow-[0_14px_34px_rgba(255,255,255,0.12)]'
              >
                <span>{t('立即开始')}</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }
};

export default UserArea;
