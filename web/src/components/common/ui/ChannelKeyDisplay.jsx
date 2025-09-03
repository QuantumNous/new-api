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
import { Card, Button, Typography, Tag } from '@douyinfe/semi-ui';
import { copy, showSuccess } from '../../../helpers';

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
          <svg
            className='w-5 h-5 text-green-600'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
              clipRule='evenodd'
            />
          </svg>
          <Typography.Text strong className='text-green-700'>
            {successText || t('验证成功')}
          </Typography.Text>
        </div>
      )}

      {/* 密钥内容 */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Typography.Text strong>
            {isMultipleKeys ? t('渠道密钥列表') : t('渠道密钥')}
          </Typography.Text>
          {isMultipleKeys && (
            <div className='flex items-center gap-2'>
              <Typography.Text type='tertiary' size='small'>
                {t('共 {{count}} 个密钥', { count: parsedKeys.length })}
              </Typography.Text>
              <Button
                size='small'
                type='primary'
                theme='outline'
                onClick={handleCopyAll}
              >
                {t('复制全部')}
              </Button>
            </div>
          )}
        </div>

        <div className='space-y-3 max-h-80 overflow-auto'>
          {parsedKeys.map((keyItem) => (
            <Card
              key={keyItem.id}
              className='!rounded-lg !border !border-gray-200 dark:!border-gray-700'
            >
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Typography.Text
                    strong
                    size='small'
                    className='text-gray-700 dark:text-gray-300'
                  >
                    {keyItem.label}
                  </Typography.Text>
                  <div className='flex items-center gap-2'>
                    {keyItem.type === 'json' && (
                      <Tag size='small' color='blue'>
                        {t('JSON')}
                      </Tag>
                    )}
                    <Button
                      size='small'
                      type='primary'
                      theme='outline'
                      icon={
                        <svg
                          className='w-3 h-3'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path d='M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z' />
                          <path d='M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z' />
                        </svg>
                      }
                      onClick={() => handleCopyKey(keyItem.content)}
                    >
                      {t('复制')}
                    </Button>
                  </div>
                </div>

                <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-40 overflow-auto'>
                  <Typography.Text
                    code
                    className='text-xs font-mono break-all whitespace-pre-wrap text-gray-800 dark:text-gray-200'
                  >
                    {keyItem.content}
                  </Typography.Text>
                </div>

                {keyItem.type === 'json' && (
                  <Typography.Text
                    type='tertiary'
                    size='small'
                    className='block'
                  >
                    {t('JSON格式密钥，请确保格式正确')}
                  </Typography.Text>
                )}
              </div>
            </Card>
          ))}
        </div>

        {isMultipleKeys && (
          <div className='bg-blue-50 dark:bg-blue-900 rounded-lg p-3'>
            <Typography.Text
              type='tertiary'
              size='small'
              className='text-blue-700 dark:text-blue-300'
            >
              <svg
                className='w-4 h-4 inline mr-1'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                  clipRule='evenodd'
                />
              </svg>
              {t(
                '检测到多个密钥，您可以单独复制每个密钥，或点击复制全部获取完整内容。',
              )}
            </Typography.Text>
          </div>
        )}
      </div>

      {/* 安全警告 */}
      {showWarning && (
        <div className='bg-yellow-50 dark:bg-yellow-900 rounded-lg p-4'>
          <div className='flex items-start'>
            <svg
              className='w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
            <div>
              <Typography.Text
                strong
                className='text-yellow-800 dark:text-yellow-200'
              >
                {t('安全提醒')}
              </Typography.Text>
              <Typography.Text className='block text-yellow-700 dark:text-yellow-300 text-sm mt-1'>
                {warningText ||
                  t(
                    '请妥善保管密钥信息，不要泄露给他人。如有安全疑虑，请及时更换密钥。',
                  )}
              </Typography.Text>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelKeyDisplay;
