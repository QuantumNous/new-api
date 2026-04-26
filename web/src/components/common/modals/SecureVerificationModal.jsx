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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Button,
  Input,
  Tab,
  Tabs,
  useOverlayState,
} from '@heroui/react';
import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react';

/**
 * 通用安全验证模态框组件
 * 配合 useSecureVerification Hook 使用
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示模态框
 * @param {Object} props.verificationMethods - 可用的验证方式
 * @param {Object} props.verificationState - 当前验证状态
 * @param {Function} props.onVerify - 验证回调
 * @param {Function} props.onCancel - 取消回调
 * @param {Function} props.onCodeChange - 验证码变化回调
 * @param {Function} props.onMethodSwitch - 验证方式切换回调
 * @param {string} props.title - 模态框标题
 * @param {string} props.description - 验证描述文本
 */
const SecureVerificationModal = ({
  visible,
  verificationMethods,
  verificationState,
  onVerify,
  onCancel,
  onCodeChange,
  onMethodSwitch,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);

  const { has2FA, hasPasskey, passkeySupported } = verificationMethods;
  const { method, loading, code } = verificationState;
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen && !loading) onCancel();
    },
  });

  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
      setVerifySuccess(false);
    } else {
      setIsAnimating(false);
    }
  }, [visible]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && code.trim() && !loading && method === '2fa') {
      onVerify(method, code);
    }
    if (e.key === 'Escape' && !loading) {
      onCancel();
    }
  };

  // 如果用户没有启用任何验证方式
  if (visible && !has2FA && !hasPasskey) {
    return (
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
              <ModalHeader>{title || t('安全验证')}</ModalHeader>
              <ModalBody>
                <div className='py-6 text-center'>
                  <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/10 text-warning'>
                    <TriangleAlert size={32} />
                  </div>
                  <h3 className='mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100'>
                    {t('需要安全验证')}
                  </h3>
                  <p className='text-sm leading-6 text-slate-500 dark:text-slate-400'>
                    {t('您需要先启用两步验证或 Passkey 才能查看敏感信息。')}
                    <br />
                    {t('请前往个人设置 → 安全设置进行配置。')}
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button onPress={onCancel}>{t('确定')}</Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    );
  }

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader>{title || t('安全验证')}</ModalHeader>
            <ModalBody className='px-5 py-5'>
      <div className='w-full'>
        {/* 描述信息 */}
        {description && (
          <p className='mb-5 text-sm leading-6 text-slate-500 dark:text-slate-400'>
            {description}
          </p>
        )}

        {/* 验证方式选择 */}
        <Tabs
          selectedKey={method}
          onSelectionChange={(key) => onMethodSwitch(String(key))}
          size='default'
          variant='underlined'
        >
          {has2FA && (
            <Tab key='2fa' title={t('两步验证')}>
              <div className='pt-5'>
                <div className='mb-3'>
                  <Input
                    placeholder={t('请输入6位验证码或8位备用码')}
                    value={code}
                    onChange={(event) => onCodeChange(event.target.value)}
                    size='large'
                    maxLength={8}
                    onKeyDown={handleKeyDown}
                    autoFocus={method === '2fa'}
                    isDisabled={loading}
                    startContent={<KeyRound size={16} />}
                  />
                </div>

                <p className='mb-5 text-sm leading-6 text-slate-500 dark:text-slate-400'>
                  {t('从认证器应用中获取验证码，或使用备用码')}
                </p>

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button variant='outline' onPress={onCancel} isDisabled={loading}>
                    {t('取消')}
                  </Button>
                  <Button
                    isPending={loading}
                    isDisabled={!code.trim() || loading}
                    onPress={() => onVerify(method, code)}
                  >
                    {t('验证')}
                  </Button>
                </div>
              </div>
            </Tab>
          )}

          {hasPasskey && passkeySupported && (
            <Tab key='passkey' title={t('Passkey')}>
              <div className='pt-5'>
                <div className='mb-5 px-4 py-6 text-center'>
                  <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent'>
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className='mb-2 text-base font-semibold text-slate-900 dark:text-slate-100'>
                    {t('使用 Passkey 验证')}
                  </h3>
                  <p className='text-sm leading-6 text-slate-500 dark:text-slate-400'>
                    {t('点击验证按钮，使用您的生物特征或安全密钥')}
                  </p>
                </div>

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button variant='outline' onPress={onCancel} isDisabled={loading}>
                    {t('取消')}
                  </Button>
                  <Button
                    isPending={loading}
                    isDisabled={loading}
                    onPress={() => onVerify(method)}
                  >
                    {t('验证 Passkey')}
                  </Button>
                </div>
              </div>
            </Tab>
          )}
        </Tabs>
      </div>
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default SecureVerificationModal;
