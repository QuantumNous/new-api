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

// Shared confirmation dialog used across the console (~40 callers, see
// the grep in the Models / Channels / Tokens / Settings / Redemption
// pages). One refactor here sweeps the whole admin in one shot.
//
// Anatomy mirrors HeroUI v3 Modal docs:
//   <Modal>
//     <ModalBackdrop>
//       <ModalContainer>
//         <ModalDialog>
//           <ModalHeader />
//           <ModalBody />
//           <ModalFooter />
//         </ModalDialog>
//       </ModalContainer>
//     </ModalBackdrop>
//   </Modal>
//
// Visual decisions (matched to EditVendorModal / ColumnSelectorDialog):
//   - No `border-b` / `border-t` on header / footer — HeroUI Modal
//     anatomy doesn't ship dividers and adding them by hand drifts
//     from the rest of the console.
//   - `size='sm'` — confirm dialogs are short, focused decisions; `lg`
//     was twice as wide as the prompt text needed.
//   - No icon next to title — destructive intent is conveyed entirely
//     by the red `variant='danger'` confirm button. The `TriangleAlert`
//     glyph this component used to render was redundant signalling.
//   - `variant='danger' | 'primary'` for the confirm CTA, NOT the v2
//     `color='danger' | 'warning'` props HeroUI v3 silently drops.

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
  ModalHeading,
  useOverlayState,
} from '@heroui/react';

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
        <ModalContainer size='sm' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            {/* `ModalHeader` is a layout container (flex-col + gap), the
                title text itself MUST live inside `ModalHeading` to
                pick up the `text-base + font-medium` heading styles
                HeroUI ships — bare children fall through to the body
                font-size and read smaller than the description. */}
            <ModalHeader>
              <ModalHeading>{title}</ModalHeading>
            </ModalHeader>
            <ModalBody className='text-sm text-muted'>{children}</ModalBody>
            <ModalFooter>
              <Button variant='tertiary' onPress={onCancel}>
                {cancelText}
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
              >
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
