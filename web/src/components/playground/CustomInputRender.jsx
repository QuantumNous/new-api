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
import { Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { usePlayground } from '../../contexts/PlaygroundContext';

const CustomInputRender = (props) => {
  const { t } = useTranslation();
  const { onPasteImage, imageEnabled } = usePlayground();
  const { detailProps } = props;
  const { clearContextNode, uploadNode, inputNode, sendNode, onClick } =
    detailProps;
  const containerRef = useRef(null);

  const handlePaste = useCallback(async (e) => {
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
              Toast.warning({
                content: t('请先在设置中启用图片功能'),
                duration: 3,
              });
              return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target.result;
              
              if (onPasteImage) {
                onPasteImage(base64);
                Toast.success({
                  content: t('图片已添加'),
                  duration: 2,
                });
              } else {
                Toast.error({
                  content: t('无法添加图片'),
                  duration: 2,
                });
              }
            };
            reader.onerror = () => {
              console.error('Failed to read image file:', reader.error);
              Toast.error({
                content: t('粘贴图片失败'),
                duration: 2,
              });
            };
            reader.readAsDataURL(file);
          } catch (error) {
            console.error('Failed to paste image:', error);
            Toast.error({
              content: t('粘贴图片失败'),
              duration: 2,
            });
          }
        }
        break;
      }
    }
  }, [onPasteImage, imageEnabled, t]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste);
    return () => {
      container.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // 清空按钮
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

  // 发送按钮
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
        className='flex items-center gap-2 sm:gap-3 p-2 bg-gray-50 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-shadow'
        style={{ border: '1px solid var(--semi-color-border)' }}
        onClick={onClick}
        title={t('支持 Ctrl+V 粘贴图片')}
      >
        {/* 清空对话按钮 - 左边 */}
        {styledClearNode}
        <div className='flex-1'>{inputNode}</div>
        {/* 发送按钮 - 右边 */}
        {styledSendNode}
      </div>
    </div>
  );
};

export default CustomInputRender;
