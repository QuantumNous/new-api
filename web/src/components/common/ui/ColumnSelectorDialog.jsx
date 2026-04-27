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
  Checkbox,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';

const ColumnSelectorDialog = ({
  title,
  visible,
  onClose,
  resetText,
  cancelText,
  confirmText,
  allText,
  visibleColumns,
  columns,
  onColumnChange,
  onSelectAll,
  onReset,
  children,
}) => {
  const selectableColumns = columns.filter((column) => !column.disabled);
  const allSelected = selectableColumns.every(
    (column) => visibleColumns[column.key] === true,
  );
  const someSelected = selectableColumns.some(
    (column) => visibleColumns[column.key] === true,
  );
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {title}
            </ModalHeader>
            <ModalBody className='px-4 py-4 md:px-6'>
              <div className='space-y-4'>
                {children}
                <Checkbox
                  isSelected={allSelected}
                  isIndeterminate={someSelected && !allSelected}
                  onValueChange={onSelectAll}
                >
                  {allText}
                </Checkbox>
                <div className='grid max-h-96 grid-cols-1 gap-3 overflow-y-auto rounded-2xl border border-border bg-surface-secondary/70 p-4 sm:grid-cols-2'>
                  {columns.map((column) => (
                    <Checkbox
                      key={column.key}
                      isSelected={!!visibleColumns[column.key]}
                      isDisabled={column.disabled}
                      onValueChange={(checked) => onColumnChange(column.key, checked)}
                    >
                      {column.title}
                    </Checkbox>
                  ))}
                </div>
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='flat' onPress={onReset}>
                {resetText}
              </Button>
              <Button variant='light' onPress={onClose}>
                {cancelText}
              </Button>
              <Button color='primary' onPress={onClose}>
                {confirmText}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ColumnSelectorDialog;
