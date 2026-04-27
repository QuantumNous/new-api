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
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { KeyRound } from 'lucide-react';
import { SiWechat } from 'react-icons/si';

const WeChatBindModal = ({
  t,
  showWeChatBindModal,
  setShowWeChatBindModal,
  inputs,
  handleInputChange,
  bindWeChat,
  status,
}) => {
  const modalState = useOverlayState({
    isOpen: showWeChatBindModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowWeChatBindModal(false);
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <SiWechat className='text-green-500' size={20} />
                {t('绑定微信账户')}
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 py-4 text-center'>
              <img
                src={status.wechat_qrcode}
                alt={t('微信二维码')}
                className='mx-auto max-h-52 rounded-lg'
              />
              <div className='text-foreground'>
                <p>
                  {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
                </p>
              </div>
              <div className='relative'>
                <KeyRound
                  size={16}
                  className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
                />
                <Input
                  placeholder={t('验证码')}
                  name='wechat_verification_code'
                  value={inputs.wechat_verification_code}
                  onChange={(event) =>
                    handleInputChange(
                      'wechat_verification_code',
                      event.target.value,
                    )
                  }
                  size='lg'
                  className='rounded-lg pl-9'
                />
              </div>
              <Button
                variant='primary'
                size='lg'
                onPress={bindWeChat}
                className='w-full rounded-lg bg-foreground hover:bg-foreground/90'
              >
                <SiWechat size={16} />
                {t('绑定')}
              </Button>
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default WeChatBindModal;
