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
  Label,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  useOverlayState,
} from '@heroui/react';

// HeroUI v3 Checkbox renders nothing visual unless you spell out the
// full anatomy below — `<Checkbox>{label}</Checkbox>` produces a label
// with no visible box. Wrap once here so the dialog stays readable.
// Per HeroUI docs we also pass `variant='secondary'` because these live
// inside a Modal (a Surface).
function CheckboxRow({
  isSelected,
  isIndeterminate,
  isDisabled,
  onValueChange,
  children,
}) {
  return (
    <Checkbox
      variant='secondary'
      isSelected={isSelected}
      isIndeterminate={isIndeterminate}
      isDisabled={isDisabled}
      onValueChange={onValueChange}
    >
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>
        <Label>{children}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}

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
        {/* `2xl` (~ 42rem) was twice as wide as the actual content — a
            ~11-checkbox 2-column grid plus a "Select all" row. `md`
            (~ 28rem) hugs the content while still giving the secondary
            grid breath at the `sm:grid-cols-2` breakpoint. */}
        <ModalContainer size='md' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            {/* No `border-b` / `border-t` on header / footer — HeroUI's
                Modal anatomy doesn't ship dividers and adding them by
                hand drifts from the rest of the console (see
                EditVendorModal / ConfirmDialog refactors). Title text
                wrapped in `ModalHeading` so it picks up the proper
                `text-base + font-medium` heading style — bare children
                of `ModalHeader` fall through to body font-size. */}
            <ModalHeader>
              <ModalHeading>{title}</ModalHeading>
            </ModalHeader>
            <ModalBody className='space-y-4'>
              {children}

              <CheckboxRow
                isSelected={allSelected}
                isIndeterminate={someSelected && !allSelected}
                onValueChange={onSelectAll}
              >
                {allText}
              </CheckboxRow>

              <div className='grid max-h-96 grid-cols-1 gap-3 overflow-y-auto rounded-2xl border border-border bg-surface-secondary/70 p-4 sm:grid-cols-2'>
                {columns.map((column) => (
                  <CheckboxRow
                    key={column.key}
                    isSelected={!!visibleColumns[column.key]}
                    isDisabled={column.disabled}
                    onValueChange={(checked) =>
                      onColumnChange(column.key, checked)
                    }
                  >
                    {column.title}
                  </CheckboxRow>
                ))}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant='tertiary' onPress={onReset}>
                {resetText}
              </Button>
              <Button variant='tertiary' onPress={onClose}>
                {cancelText}
              </Button>
              {/* `color='primary'` is a HeroUI v2 holdover that v3 silently
                  drops — use `variant='primary'` to actually paint the
                  cyan + black-text primary CTA seen on every other
                  console modal footer. */}
              <Button variant='primary' onPress={onClose}>
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
