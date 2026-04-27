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
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { TriangleAlert, Trash2, User } from 'lucide-react';
import Turnstile from 'react-turnstile';

const AccountDeleteModal = ({
  t,
  showAccountDeleteModal,
  setShowAccountDeleteModal,
  inputs,
  handleInputChange,
  deleteAccount,
  userState,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  const modalState = useOverlayState({
    isOpen: showAccountDeleteModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowAccountDeleteModal(false);
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <Trash2 className='text-red-500' size={18} />
                {t('删除账户确认')}
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 py-4'>
              <div className='flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger'>
                <TriangleAlert className='mt-0.5 shrink-0' size={16} />
                <span>{t('您正在删除自己的帐户，将清空所有数据且不可恢复')}</span>
              </div>

              <div>
                <label className='mb-2 block text-sm font-semibold text-red-600'>
                  {t('请输入您的用户名以确认删除')}
                </label>
                <div className='relative'>
                  <User
                    size={16}
                    className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
                  />
                  <Input
                    placeholder={t('输入你的账户名{{username}}以确认删除', {
                      username: ` ${userState?.user?.username} `,
                    })}
                    name='self_account_deletion_confirmation'
                    value={inputs.self_account_deletion_confirmation}
                    onChange={(event) =>
                      handleInputChange(
                        'self_account_deletion_confirmation',
                        event.target.value,
                      )
                    }
                    size='lg'
                    className='rounded-lg pl-9'
                  />
                </div>
              </div>

              {turnstileEnabled && (
                <div className='flex justify-center'>
                  <Turnstile
                    sitekey={turnstileSiteKey}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                    }}
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button
                variant='ghost'
                onPress={() => setShowAccountDeleteModal(false)}
              >
                {t('取消')}
              </Button>
              <Button variant='danger' onPress={deleteAccount}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default AccountDeleteModal;
