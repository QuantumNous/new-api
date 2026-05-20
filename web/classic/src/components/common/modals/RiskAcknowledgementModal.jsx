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
  Button,
  Typography,
  Checkbox,
  Input,
  Space,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import MarkdownRenderer from '../markdown/MarkdownRenderer';

const { Text } = Typography;

const RiskMarkdownBlock = React.memo(function RiskMarkdownBlock({
  markdownContent,
}) {
  if (!markdownContent) {
    return null;
  }

  return (
    <div
      className='rounded-lg'
      style={{
        border: '1px solid var(--semi-color-warning-light-hover)',
        padding: '12px',
        contentVisibility: 'auto',
      }}
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
  requiredTextParts = [],
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
  const [typedTextParts, setTypedTextParts] = useState([]);

  const normalizedRequiredTextParts = useMemo(() => {
    let inputIndex = 0;
    return requiredTextParts.map((part) => {
      if (part.type === 'input') {
        const normalizedPart = { ...part, inputIndex };
        inputIndex += 1;
        return normalizedPart;
      }
      return part;
    });
  }, [requiredTextParts]);

  const requiredTextInputCount = useMemo(
    () =>
      normalizedRequiredTextParts.filter((part) => part.type === 'input')
        .length,
    [normalizedRequiredTextParts],
  );
  const hasSegmentedRequiredText = requiredTextInputCount > 0;
  const requiredTextToDisplay = hasSegmentedRequiredText
    ? normalizedRequiredTextParts.map((part) => part.text).join('')
    : requiredText;

  useEffect(() => {
    if (!visible) return;
    setCheckedItems(Array(checklist.length).fill(false));
    setTypedText('');
    setTypedTextParts(Array(requiredTextInputCount).fill(''));
  }, [visible, checklist.length, requiredTextInputCount]);

  const allChecked = useMemo(() => {
    if (checklist.length === 0) return true;
    return (
      checkedItems.length === checklist.length && checkedItems.every(Boolean)
    );
  }, [checkedItems, checklist.length]);

  const typedMatched = useMemo(() => {
    if (hasSegmentedRequiredText) {
      return normalizedRequiredTextParts.every((part) => {
        if (part.type === 'static') return true;
        return (
          typedTextParts[part.inputIndex ?? 0]?.trim() === part.text.trim()
        );
      });
    }
    if (!requiredText) return true;
    return typedText.trim() === requiredText.trim();
  }, [
    hasSegmentedRequiredText,
    normalizedRequiredTextParts,
    requiredText,
    typedText,
    typedTextParts,
  ]);

  const detailText = useMemo(() => detailItems.join(', '), [detailItems]);
  const hasTypedRequiredText = hasSegmentedRequiredText
    ? typedTextParts.some((part) => part.trim() !== '')
    : typedText.length > 0;
  const canConfirm = allChecked && typedMatched;

  const handleChecklistChange = useCallback((index, checked) => {
    setCheckedItems((previous) => {
      const next = [...previous];
      next[index] = checked;
      return next;
    });
  }, []);

  const handleTextPartChange = useCallback((index, value) => {
    setTypedTextParts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  return (
    <Modal
      visible={visible}
      title={
        <Space align='center'>
          <IconAlertTriangle style={{ color: 'var(--semi-color-warning)' }} />
          <span>{title}</span>
        </Space>
      }
      width={isMobile ? '100%' : 860}
      centered
      maskClosable={false}
      closeOnEsc={false}
      onCancel={onCancel}
      bodyStyle={{
        maxHeight: isMobile ? '70vh' : '72vh',
        overflowY: 'auto',
        padding: isMobile ? '12px 16px' : '18px 22px',
      }}
      footer={
        <Space>
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button
            theme='solid'
            type='danger'
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </Space>
      }
    >
      <div className='flex flex-col gap-4'>
        <RiskMarkdownBlock markdownContent={markdownContent} />

        {detailItems.length > 0 ? (
          <div
            className='flex flex-col gap-2 rounded-lg'
            style={{
              border: '1px solid var(--semi-color-warning-light-hover)',
              background: 'var(--semi-color-fill-0)',
              padding: isMobile ? '10px 12px' : '12px 14px',
            }}
          >
            {detailTitle ? <Text strong>{detailTitle}</Text> : null}
            <div className='font-mono text-xs break-all bg-orange-50 border border-orange-200 rounded-md p-2'>
              {detailText}
            </div>
          </div>
        ) : null}

        {checklist.length > 0 ? (
          <div
            className='flex flex-col gap-2 rounded-lg'
            style={{
              border: '1px solid var(--semi-color-border)',
              background: 'var(--semi-color-fill-0)',
              padding: isMobile ? '10px 12px' : '12px 14px',
            }}
          >
            {checklist.map((item, index) => (
              <Checkbox
                key={`risk-check-${index}`}
                checked={!!checkedItems[index]}
                onChange={(event) => {
                  handleChecklistChange(index, event.target.checked);
                }}
              >
                {item}
              </Checkbox>
            ))}
          </div>
        ) : null}

        {requiredTextToDisplay ? (
          <div
            className='flex flex-col gap-2 rounded-lg'
            style={{
              border: '1px solid var(--semi-color-danger-light-hover)',
              background: 'var(--semi-color-danger-light-default)',
              padding: isMobile ? '10px 12px' : '12px 14px',
            }}
          >
            {inputPrompt ? <Text strong>{inputPrompt}</Text> : null}
            <div className='font-mono text-xs break-all rounded-md p-2 bg-gray-50 border border-gray-200'>
              {requiredTextToDisplay}
            </div>
            {hasSegmentedRequiredText ? (
              <div className='flex flex-wrap items-center gap-2'>
                {normalizedRequiredTextParts.map((part, index) =>
                  part.type === 'static' ? (
                    <span
                      key={`static-${index}`}
                      className='select-none rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-sm text-gray-500'
                    >
                      {part.text}
                    </span>
                  ) : (
                    <Input
                      key={`input-${index}`}
                      value={typedTextParts[part.inputIndex ?? 0] ?? ''}
                      onChange={(value) =>
                        handleTextPartChange(part.inputIndex ?? 0, value)
                      }
                      placeholder={
                        part.placeholder || part.text || inputPlaceholder
                      }
                      autoFocus={visible && part.inputIndex === 0}
                      onCopy={(event) => event.preventDefault()}
                      onCut={(event) => event.preventDefault()}
                      onPaste={(event) => event.preventDefault()}
                      onDrop={(event) => event.preventDefault()}
                      style={{ width: isMobile ? '100%' : 260 }}
                    />
                  ),
                )}
              </div>
            ) : (
              <Input
                value={typedText}
                onChange={setTypedText}
                placeholder={inputPlaceholder}
                autoFocus={visible}
                onCopy={(event) => event.preventDefault()}
                onCut={(event) => event.preventDefault()}
                onPaste={(event) => event.preventDefault()}
                onDrop={(event) => event.preventDefault()}
              />
            )}
            {!typedMatched && hasTypedRequiredText ? (
              <Text type='danger' size='small'>
                {mismatchText}
              </Text>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
});

export default RiskAcknowledgementModal;
