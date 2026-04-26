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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Button,
  Checkbox,
  Input,
  useOverlayState,
} from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import MarkdownRenderer from '../markdown/MarkdownRenderer';

const RiskMarkdownBlock = React.memo(function RiskMarkdownBlock({
  markdownContent,
}) {
  if (!markdownContent) {
    return null;
  }

  return (
    <div
      className='rounded-2xl border border-warning/30 bg-warning/5 p-3'
      style={{ contentVisibility: 'auto' }}
    >
      <MarkdownRenderer content={markdownContent} />
    </div>
  );
});

const RiskAcknowledgementModal = React.memo(function RiskAcknowledgementModal({
  visible,
  title,
  markdownContent = '',
  detailTitle = '',
  detailItems = [],
  checklist = [],
  inputPrompt = '',
  requiredText = '',
  inputPlaceholder = '',
  mismatchText = '',
  cancelText = '',
  confirmText = '',
  onCancel,
  onConfirm,
}) {
  const isMobile = useIsMobile();
  const [checkedItems, setCheckedItems] = useState([]);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCheckedItems(Array(checklist.length).fill(false));
    setTypedText('');
  }, [visible, checklist.length]);

  const allChecked = useMemo(() => {
    if (checklist.length === 0) return true;
    return checkedItems.length === checklist.length && checkedItems.every(Boolean);
  }, [checkedItems, checklist.length]);

  const typedMatched = useMemo(() => {
    if (!requiredText) return true;
    return typedText.trim() === requiredText.trim();
  }, [typedText, requiredText]);

  const detailText = useMemo(() => detailItems.join(', '), [detailItems]);
  const canConfirm = allChecked && typedMatched;
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const handleChecklistChange = useCallback((index, checked) => {
    setCheckedItems((previous) => {
      const next = [...previous];
      next[index] = checked;
      return next;
    });
  }, []);

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer
          size={isMobile ? 'full' : 'xl'}
          scroll='inside'
          placement='center'
        >
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              <div className='flex items-center gap-2'>
                <TriangleAlert className='text-warning' size={20} />
                <span>{title}</span>
              </div>
            </ModalHeader>
            <ModalBody className='max-h-[72vh] overflow-y-auto px-4 py-4 md:px-6'>
              <div className='flex flex-col gap-4'>

        <RiskMarkdownBlock markdownContent={markdownContent} />

        {detailItems.length > 0 ? (
          <div
            className='flex flex-col gap-2 rounded-2xl border border-warning/30 bg-warning/5 p-3 md:p-4'
          >
            {detailTitle ? <strong className='text-sm'>{detailTitle}</strong> : null}
            <div className='break-all rounded-xl border border-warning/20 bg-white/80 p-2 font-mono text-xs dark:bg-slate-900/80'>
              {detailText}
            </div>
          </div>
        ) : null}

        {checklist.length > 0 ? (
          <div
            className='flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/80 md:p-4'
          >
            {checklist.map((item, index) => (
              <Checkbox
                key={`risk-check-${index}`}
                isSelected={!!checkedItems[index]}
                onValueChange={(checked) => handleChecklistChange(index, checked)}
              >
                {item}
              </Checkbox>
            ))}
          </div>
        ) : null}

        {requiredText ? (
          <div
            className='flex flex-col gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-3 md:p-4'
          >
            {inputPrompt ? <strong className='text-sm'>{inputPrompt}</strong> : null}
            <div className='break-all rounded-xl border border-danger/20 bg-white/80 p-2 font-mono text-xs dark:bg-slate-900/80'>
              {requiredText}
            </div>
            <Input
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              placeholder={inputPlaceholder}
              autoFocus={visible}
              onCopy={(event) => event.preventDefault()}
              onCut={(event) => event.preventDefault()}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
            />
            {!typedMatched && typedText ? (
              <span className='text-sm text-danger'>
                {mismatchText}
              </span>
            ) : null}
          </div>
        ) : null}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='outline' onPress={onCancel}>
                {cancelText}
              </Button>
              <Button
                variant='danger'
                isDisabled={!canConfirm}
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
});

export default RiskAcknowledgementModal;
