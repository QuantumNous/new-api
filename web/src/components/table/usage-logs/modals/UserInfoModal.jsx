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

import React from 'react';
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { renderQuota, renderNumber } from '../../../../helpers';

const UserInfoModal = ({
  showUserInfo,
  setShowUserInfoModal,
  userInfoData,
  t,
}) => {
  const renderLabel = (text, type = 'tertiary') => (
    <div className='mb-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400'>
      <span
        className={`h-2 w-2 rounded-full ${
          type === 'primary'
            ? 'bg-primary'
            : type === 'success'
              ? 'bg-success'
              : type === 'warning'
                ? 'bg-warning'
                : 'bg-slate-400'
        }`}
      />
      {text}
    </div>
  );

  const modalState = useOverlayState({
    isOpen: showUserInfo,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowUserInfoModal(false);
    },
  });
  const valueClass = 'text-sm font-semibold text-slate-800 dark:text-slate-100';

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              {t('用户信息')}
            </ModalHeader>
            <ModalBody className='p-6'>
              {userInfoData && (
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <div>
                    {renderLabel(t('用户名'), 'primary')}
                    <div className={valueClass}>{userInfoData.username}</div>
                  </div>
                  {userInfoData.display_name && (
                    <div>
                      {renderLabel(t('显示名称'), 'primary')}
                      <div className={valueClass}>{userInfoData.display_name}</div>
                    </div>
                  )}

                  <div>
                    {renderLabel(t('余额'), 'success')}
                    <div className={valueClass}>{renderQuota(userInfoData.quota)}</div>
                  </div>
                  <div>
                    {renderLabel(t('已用额度'), 'warning')}
                    <div className={valueClass}>
                      {renderQuota(userInfoData.used_quota)}
                    </div>
                  </div>

                  <div>
                    {renderLabel(t('请求次数'), 'warning')}
                    <div className={valueClass}>
                      {renderNumber(userInfoData.request_count)}
                    </div>
                  </div>
                  {userInfoData.group && (
                    <div>
                      {renderLabel(t('用户组'), 'tertiary')}
                      <div className={valueClass}>{userInfoData.group}</div>
                    </div>
                  )}

                  {userInfoData.aff_code && (
                    <div>
                      {renderLabel(t('邀请码'), 'tertiary')}
                      <div className={valueClass}>{userInfoData.aff_code}</div>
                    </div>
                  )}
                  {userInfoData.aff_count !== undefined && (
                    <div>
                      {renderLabel(t('邀请人数'), 'tertiary')}
                      <div className={valueClass}>
                        {renderNumber(userInfoData.aff_count)}
                      </div>
                    </div>
                  )}

                  {userInfoData.aff_quota !== undefined &&
                    userInfoData.aff_quota > 0 && (
                      <div>
                        {renderLabel(t('邀请获得额度'), 'success')}
                        <div className={valueClass}>
                          {renderQuota(userInfoData.aff_quota)}
                        </div>
                      </div>
                    )}

                  {userInfoData.remark && (
                    <div className='sm:col-span-2'>
                      {renderLabel(t('备注'), 'tertiary')}
                      <div className={`${valueClass} break-all leading-relaxed`}>
                        {userInfoData.remark}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default UserInfoModal;
