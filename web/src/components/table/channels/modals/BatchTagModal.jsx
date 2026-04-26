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

const BatchTagModal = ({
  showBatchSetTag,
  setShowBatchSetTag,
  batchSetChannelTag,
  batchSetTagValue,
  setBatchSetTagValue,
  selectedChannels,
  t,
}) => {
  const modalState = useOverlayState({
    isOpen: !!showBatchSetTag,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowBatchSetTag(false);
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('批量设置标签')}
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <div className='text-sm text-foreground'>
                {t('请输入要设置的标签名称')}
              </div>
              <Input
                type='text'
                placeholder={t('请输入标签名称')}
                value={batchSetTagValue ?? ''}
                onChange={(e) => setBatchSetTagValue(e.target.value)}
                aria-label={t('标签名称')}
                className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
              />
              <div className='text-xs text-muted'>
                {t('已选择 ${count} 个渠道').replace(
                  '${count}',
                  String(selectedChannels?.length || 0),
                )}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='light' onPress={() => setShowBatchSetTag(false)}>
                {t('取消')}
              </Button>
              <Button color='primary' onPress={batchSetChannelTag}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default BatchTagModal;
