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
import { TriangleAlert } from 'lucide-react';

const ConfirmDialog = ({
  visible,
  title,
  children,
  onCancel,
  onConfirm,
  cancelText,
  confirmText,
  danger = false,
}) => {
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <TriangleAlert
                  size={18}
                  className={danger ? 'text-danger' : 'text-warning'}
                />
                <span>{title}</span>
              </div>
            </ModalHeader>
            <ModalBody className='px-6 py-5 text-sm text-muted'>
              {children}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='light' onPress={onCancel}>
                {cancelText}
              </Button>
              <Button color={danger ? 'danger' : 'warning'} onPress={onConfirm}>
                {confirmText}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ConfirmDialog;
