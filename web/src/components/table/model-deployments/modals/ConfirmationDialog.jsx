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

import React, { useState, useEffect } from 'react';
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
import { TriangleAlert } from 'lucide-react';

const ConfirmationDialog = ({
  visible,
  onCancel,
  onConfirm,
  title,
  type = 'danger',
  deployment,
  t,
  loading = false,
}) => {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!visible) setConfirmText('');
  }, [visible]);

  const requiredText = deployment?.container_name || deployment?.id || '';
  const isConfirmed = Boolean(requiredText) && confirmText === requiredText;

  const handleCancel = () => {
    setConfirmText('');
    onCancel?.();
  };

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm?.();
      handleCancel();
    }
  };

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleCancel();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <TriangleAlert
                  size={18}
                  className={type === 'danger' ? 'text-red-500' : 'text-amber-500'}
                />
                <span>{title}</span>
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <div className='font-semibold text-red-600 dark:text-red-400'>
                {t('此操作具有风险，请确认要继续执行')}。
              </div>
              <div className='text-sm text-foreground'>
                {t('请输入部署名称以完成二次确认')}：
                <code className='ml-1 rounded bg-[color:var(--app-background)] px-1.5 py-0.5 text-xs text-foreground'>
                  {requiredText || t('未知部署')}
                </code>
              </div>
              <Input
                type='text'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('再次输入部署名称')}
                aria-label={t('部署名称')}
                autoFocus
                className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
              />
              {!isConfirmed && confirmText && (
                <div className='text-xs text-red-600 dark:text-red-400'>
                  {t('部署名称不匹配，请检查后重新输入')}
                </div>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='light' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button
                color={type === 'danger' ? 'danger' : 'primary'}
                onPress={handleConfirm}
                isDisabled={!isConfirmed}
                isPending={loading}
              >
                {t('确认')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ConfirmationDialog;
