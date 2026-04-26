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
import { LockKeyhole } from 'lucide-react';
import Turnstile from 'react-turnstile';

const ChangePasswordModal = ({
  t,
  showChangePasswordModal,
  setShowChangePasswordModal,
  inputs,
  handleInputChange,
  changePassword,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  const modalState = useOverlayState({
    isOpen: showChangePasswordModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowChangePasswordModal(false);
    },
  });

  const renderPasswordInput = (name, label, placeholder) => (
    <div>
      <label className='mb-2 block text-sm font-semibold text-foreground'>
        {label}
      </label>
      <div className='relative'>
        <LockKeyhole
          size={16}
          className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
        />
        <Input
          name={name}
          placeholder={placeholder}
          type='password'
          value={inputs[name]}
          onChange={(event) => handleInputChange(name, event.target.value)}
          size='lg'
          className='rounded-lg pl-9'
        />
      </div>
    </div>
  );

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <LockKeyhole className='text-orange-500' size={18} />
                {t('修改密码')}
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 py-4'>
              {renderPasswordInput(
                'original_password',
                t('原密码'),
                t('请输入原密码'),
              )}
              {renderPasswordInput(
                'set_new_password',
                t('新密码'),
                t('请输入新密码'),
              )}
              {renderPasswordInput(
                'set_new_password_confirmation',
                t('确认新密码'),
                t('请再次输入新密码'),
              )}

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
                onPress={() => setShowChangePasswordModal(false)}
              >
                {t('取消')}
              </Button>
              <Button variant='primary' onPress={changePassword}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ChangePasswordModal;
