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
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';

const CopyTokensModal = ({
  visible,
  onCancel,
  batchCopyTokens,
  t,
}) => {
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel();
    },
  });

  // Handle copy with name and key format
  const handleCopyWithName = async () => {
    await batchCopyTokens('name+key');
    onCancel();
  };

  // Handle copy with key only format
  const handleCopyKeyOnly = async () => {
    await batchCopyTokens('key-only');
    onCancel();
  };

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              {t('复制令牌')}
            </ModalHeader>
            <ModalBody className='px-6 py-5 text-sm text-slate-600 dark:text-slate-300'>
              {t('请选择你的复制方式')}
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='flat' onPress={handleCopyWithName}>
                {t('名称+密钥')}
              </Button>
              <Button color='primary' onPress={handleCopyKeyOnly}>
                {t('仅密钥')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default CopyTokensModal;
