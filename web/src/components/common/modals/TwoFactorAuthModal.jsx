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
import { Modal, Button, Input, Typography } from '@douyinfe/semi-ui';

/**
 * 可复用的两步验证模态框组件
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示模态框
 * @param {string} props.code - 验证码值
 * @param {boolean} props.loading - 是否正在验证
 * @param {Function} props.onCodeChange - 验证码变化回调
 * @param {Function} props.onVerify - 验证回调
 * @param {Function} props.onCancel - 取消回调
 * @param {string} props.title - 模态框标题
 * @param {string} props.description - 验证描述文本
 * @param {string} props.placeholder - 输入框占位文本
 */
const TwoFactorAuthModal = ({
  visible,
  code,
  loading,
  onCodeChange,
  onVerify,
  onCancel,
  title,
  description,
  placeholder,
}) => {
  const { t } = useTranslation();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && code && !loading) {
      onVerify();
    }
  };

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <div className='w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3'>
            <svg
              className='w-4 h-4 text-blue-600 dark:text-blue-400'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          {title || t('安全验证')}
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button
            type='primary'
            loading={loading}
            disabled={!code || loading}
            onClick={onVerify}
          >
            {t('验证')}
          </Button>
        </>
      }
      width={500}
      style={{ maxWidth: '90vw' }}
    >
      <div className='space-y-6'>
        {/* 安全提示 */}
        <div className='bg-blue-50 dark:bg-blue-900 rounded-lg p-4'>
          <div className='flex items-start'>
            <svg
              className='w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                clipRule='evenodd'
              />
            </svg>
            <div>
              <Typography.Text
                strong
                className='text-blue-800 dark:text-blue-200'
              >
                {t('安全验证')}
              </Typography.Text>
              <Typography.Text className='block text-blue-700 dark:text-blue-300 text-sm mt-1'>
                {description || t('为了保护账户安全，请验证您的两步验证码。')}
              </Typography.Text>
            </div>
          </div>
        </div>

        {/* 验证码输入 */}
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('验证身份')}
          </Typography.Text>
          <Input
            placeholder={placeholder || t('请输入认证器验证码或备用码')}
            value={code}
            onChange={onCodeChange}
            size='large'
            maxLength={8}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Typography.Text type='tertiary' size='small' className='mt-2 block'>
            {t('支持6位TOTP验证码或8位备用码，可到`个人设置-安全设置-两步验证设置`配置或查看。')}
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
};

export default TwoFactorAuthModal;
