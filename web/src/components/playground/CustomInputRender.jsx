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

import React, { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlayground } from '../../contexts/PlaygroundContext';
import { showError, showSuccess, showWarning } from '../../helpers';

const CustomInputRender = (props) => {
  const { t } = useTranslation();
  const { onPasteImage, imageEnabled } = usePlayground();
  const { detailProps } = props;
  const { clearContextNode, uploadNode, inputNode, sendNode, onClick } =
    detailProps;
  const containerRef = useRef(null);

  const handlePaste = useCallback(
    async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();

          if (file) {
            try {
              if (!imageEnabled) {
                showWarning(t('请先在设置中启用图片功能'));
                return;
              }

              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target.result;

                if (onPasteImage) {
                  onPasteImage(base64);
                  showSuccess(t('图片已添加'));
                } else {
                  showError(t('无法添加图片'));
                }
              };
              reader.onerror = () => {
                console.error('Failed to read image file:', reader.error);
                showError(t('粘贴图片失败'));
              };
              reader.readAsDataURL(file);
            } catch (error) {
              console.error('Failed to paste image:', error);
              showError(t('粘贴图片失败'));
            }
          }
          break;
        }
      }
    },
    [onPasteImage, imageEnabled, t],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste);
    return () => {
      container.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // Clear button.
  const styledClearNode = clearContextNode
    ? React.cloneElement(clearContextNode, {
        className: `!rounded-full !bg-gray-100 hover:!bg-red-500 hover:!text-white flex-shrink-0 transition-all ${clearContextNode.props.className || ''}`,
        style: {
          ...clearContextNode.props.style,
          width: '32px',
          height: '32px',
          minWidth: '32px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      })
    : null;

  // Send button.
  const styledSendNode = React.cloneElement(sendNode, {
    className: `!rounded-full !bg-purple-500 hover:!bg-purple-600 flex-shrink-0 transition-all ${sendNode.props.className || ''}`,
    style: {
      ...sendNode.props.style,
      width: '32px',
      height: '32px',
      minWidth: '32px',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <div className='p-2 sm:p-4' ref={containerRef}>
      <div
        className='flex items-center gap-2 rounded-xl border border-border bg-gray-50 p-2 shadow-sm transition-shadow hover:shadow-md sm:gap-3 sm:rounded-2xl'
        onClick={onClick}
        title={t('支持 Ctrl+V 粘贴图片')}
      >
        {/* Clear conversation button, left side. */}
        {styledClearNode}
        <div className='flex-1'>{inputNode}</div>
        {/* Send button, right side. */}
        {styledSendNode}
      </div>
    </div>
  );
};

export default CustomInputRender;
