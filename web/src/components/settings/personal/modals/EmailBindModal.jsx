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
import { KeyRound, Mail } from 'lucide-react';
import Turnstile from 'react-turnstile';

const EmailBindModal = ({
  t,
  showEmailBindModal,
  setShowEmailBindModal,
  inputs,
  handleInputChange,
  sendVerificationCode,
  bindEmail,
  disableButton,
  loading,
  countdown,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  const modalState = useOverlayState({
    isOpen: showEmailBindModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowEmailBindModal(false);
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur' isDismissable={false}>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              <div className='flex items-center gap-2'>
                <Mail className='text-blue-500' size={18} />
                {t('绑定邮箱地址')}
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 py-4'>
              <div className='flex gap-3'>
                <div className='relative flex-1'>
                  <Mail
                    size={16}
                    className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
                  />
                  <Input
                    placeholder={t('输入邮箱地址')}
                    value={inputs.email}
                    onChange={(event) =>
                      handleInputChange('email', event.target.value)
                    }
                    name='email'
                    type='email'
                    size='lg'
                    className='rounded-lg pl-9'
                  />
                </div>
                <Button
                  onPress={sendVerificationCode}
                  isDisabled={disableButton || loading}
                  isPending={loading}
                  className='rounded-lg'
                  variant='outline'
                  size='lg'
                >
                  {disableButton
                    ? `${t('重新发送')} (${countdown})`
                    : t('获取验证码')}
                </Button>
              </div>

              <div className='relative'>
                <KeyRound
                  size={16}
                  className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
                />
                <Input
                  placeholder={t('验证码')}
                  name='email_verification_code'
                  value={inputs.email_verification_code}
                  onChange={(event) =>
                    handleInputChange(
                      'email_verification_code',
                      event.target.value,
                    )
                  }
                  size='lg'
                  className='rounded-lg pl-9'
                />
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
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button
                variant='ghost'
                onPress={() => setShowEmailBindModal(false)}
              >
                {t('取消')}
              </Button>
              <Button variant='primary' onPress={bindEmail} isPending={loading}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default EmailBindModal;
