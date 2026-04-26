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
import { useTranslation } from 'react-i18next';

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isModalOpenurl,
  setIsModalOpenurl,
  modalImageUrl,
}) => {
  const { t } = useTranslation();
  const textModalState = useOverlayState({
    isOpen: isModalOpen,
    onOpenChange: (isOpen) => {
      if (!isOpen) setIsModalOpen(false);
    },
  });
  const imageModalState = useOverlayState({
    isOpen: isModalOpenurl,
    onOpenChange: (isOpen) => {
      if (!isOpen) setIsModalOpenurl(false);
    },
  });

  return (
    <>
      {/* Text Content Modal */}
      <Modal state={textModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='3xl' scroll='inside'>
            <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
              <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
                {t('内容预览')}
              </ModalHeader>
              <ModalBody className='max-h-[70vh] p-6'>
                <p className='whitespace-pre-line text-sm text-slate-700 dark:text-slate-200'>
                  {modalContent}
                </p>
              </ModalBody>
              <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
                <Button color='primary' onPress={() => setIsModalOpen(false)}>
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Image Preview Modal */}
      <Modal state={imageModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='5xl' scroll='inside'>
            <ModalDialog className='bg-black/90 text-white'>
              <ModalBody className='flex max-h-[86vh] items-center justify-center p-4'>
                <img
                  src={modalImageUrl}
                  alt='preview'
                  className='max-h-[80vh] max-w-full rounded-2xl object-contain'
                />
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </>
  );
};

export default ContentModal;
