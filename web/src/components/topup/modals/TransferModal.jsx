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
import { CreditCard } from 'lucide-react';

const TransferModal = ({
  t,
  openTransfer,
  transfer,
  handleTransferCancel,
  userState,
  renderQuota,
  getQuotaPerUnit,
  transferAmount,
  setTransferAmount,
}) => {
  const modalState = useOverlayState({
    isOpen: openTransfer,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleTransferCancel();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop isDismissable={false} variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              <div className='flex items-center gap-2'>
                <CreditCard size={18} />
                {t('划转邀请额度')}
              </div>
            </ModalHeader>
            <ModalBody className='px-6 py-5'>
              <div className='space-y-4'>
                <Input
                  label={t('可用邀请额度')}
                  value={renderQuota(userState?.user?.aff_quota)}
                  isDisabled
                  className='w-full'
                />
                <Input
                  label={`${t('划转额度')} · ${t('最低')}${renderQuota(getQuotaPerUnit())}`}
                  type='number'
                  min={getQuotaPerUnit()}
                  max={userState?.user?.aff_quota || 0}
                  value={String(transferAmount ?? '')}
                  onChange={(event) => setTransferAmount(Number(event.target.value || 0))}
                  className='w-full'
                />
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='ghost' onPress={handleTransferCancel}>
                {t('取消')}
              </Button>
              <Button variant='primary' onPress={transfer}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default TransferModal;
