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
import { useTranslation } from 'react-i18next';
import { Button, Chip } from '@heroui/react';
import { copy, showSuccess } from '../../../helpers';
import { CheckCircle2, Clipboard, Info, TriangleAlert } from 'lucide-react';

/**
 * 解析密钥数据，支持多种格式
 * @param {string} keyData - 密钥数据
 * @param {Function} t - 翻译函数
 * @returns {Array} 解析后的密钥数组
 */
const parseChannelKeys = (keyData, t) => {
  if (!keyData) return [];

  const trimmed = keyData.trim();

  // 检查是否是JSON数组格式（如Vertex AI）
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: index,
          content:
            typeof item === 'string' ? item : JSON.stringify(item, null, 2),
          type: typeof item === 'string' ? 'text' : 'json',
          label: `${t('密钥')} ${index + 1}`,
        }));
      }
    } catch (e) {
      // 如果解析失败，按普通文本处理
      console.warn('Failed to parse JSON keys:', e);
    }
  }

  // 检查是否是多行密钥（按换行符分割）
  const lines = trimmed.split('\n').filter((line) => line.trim());
  if (lines.length > 1) {
    return lines.map((line, index) => ({
      id: index,
      content: line.trim(),
      type: 'text',
      label: `${t('密钥')} ${index + 1}`,
    }));
  }

  // 单个密钥
  return [
    {
      id: 0,
      content: trimmed,
      type: trimmed.startsWith('{') ? 'json' : 'text',
      label: t('密钥'),
    },
  ];
};

/**
 * 可复用的密钥显示组件
 * @param {Object} props
 * @param {string} props.keyData - 密钥数据
 * @param {boolean} props.showSuccessIcon - 是否显示成功图标
 * @param {string} props.successText - 成功文本
 * @param {boolean} props.showWarning - 是否显示安全警告
 * @param {string} props.warningText - 警告文本
 */
const ChannelKeyDisplay = ({
  keyData,
  showSuccessIcon = true,
  successText,
  showWarning = true,
  warningText,
}) => {
  const { t } = useTranslation();

  const parsedKeys = parseChannelKeys(keyData, t);
  const isMultipleKeys = parsedKeys.length > 1;

  const handleCopyAll = () => {
    copy(keyData);
    showSuccess(t('所有密钥已复制到剪贴板'));
  };

  const handleCopyKey = (content) => {
    copy(content);
    showSuccess(t('密钥已复制到剪贴板'));
  };

  return (
    <div className='space-y-4'>
      {/* 成功状态 */}
      {showSuccessIcon && (
        <div className='flex items-center gap-2'>
          <CheckCircle2 className='h-5 w-5 text-green-600' />
          <span className='font-semibold text-green-700 dark:text-green-300'>
            {successText || t('验证成功')}
          </span>
        </div>
      )}

      {/* 密钥内容 */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='font-semibold text-foreground'>
            {isMultipleKeys ? t('渠道密钥列表') : t('渠道密钥')}
          </span>
          {isMultipleKeys && (
            <div className='flex items-center gap-2'>
              <span className='text-xs text-muted'>
                {t('共 {{count}} 个密钥', { count: parsedKeys.length })}
              </span>
              <Button size='sm' variant='secondary' onPress={handleCopyAll}>
                {t('复制全部')}
              </Button>
            </div>
          )}
        </div>

        <div className='space-y-3 max-h-80 overflow-auto'>
          {parsedKeys.map((keyItem) => (
            <div
              key={keyItem.id}
              className='rounded-xl border border-border bg-background/80 p-4'
            >
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-semibold text-foreground'>
                    {keyItem.label}
                  </span>
                  <div className='flex items-center gap-2'>
                    {keyItem.type === 'json' && (
                      <Chip size='sm' color='primary' variant='tertiary'>
                        {t('JSON')}
                      </Chip>
                    )}
                    <Button
                      size='sm'
                      variant='secondary'
                      onPress={() => handleCopyKey(keyItem.content)}
                    >
                      <Clipboard size={14} />
                      {t('复制')}
                    </Button>
                  </div>
                </div>

                <div className='bg-surface-secondary rounded-lg p-3 max-h-40 overflow-auto'>
                  <code className='whitespace-pre-wrap break-all font-mono text-xs text-foreground'>
                    {keyItem.content}
                  </code>
                </div>

                {keyItem.type === 'json' && (
                  <span className='block text-xs text-muted'>
                    {t('JSON格式密钥，请确保格式正确')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {isMultipleKeys && (
          <div className='bg-blue-50 dark:bg-blue-900 rounded-lg p-3'>
            <span className='text-xs text-blue-700 dark:text-blue-300'>
              <Info className='mr-1 inline h-4 w-4' />
              {t(
                '检测到多个密钥，您可以单独复制每个密钥，或点击复制全部获取完整内容。',
              )}
            </span>
          </div>
        )}
      </div>

      {/* 安全警告 */}
      {showWarning && (
        <div className='bg-yellow-50 dark:bg-yellow-900 rounded-lg p-4'>
          <div className='flex items-start'>
            <TriangleAlert className='mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400' />
            <div>
              <span className='font-semibold text-yellow-800 dark:text-yellow-200'>
                {t('安全提醒')}
              </span>
              <span className='mt-1 block text-sm text-yellow-700 dark:text-yellow-300'>
                {warningText ||
                  t(
                    '请妥善保管密钥信息，不要泄露给他人。如有安全疑虑，请及时更换密钥。',
                  )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelKeyDisplay;
