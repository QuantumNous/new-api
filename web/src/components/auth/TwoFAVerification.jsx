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
import { API, showError, showSuccess } from '../../helpers';
import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import {
  AuthDivider,
  AuthGhostButton,
  AuthPanel,
  AuthPrimaryButton,
  AuthTextField,
} from './AuthLayout';

const TwoFAVerification = ({ onSuccess, onBack, isModal = false }) => {
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async () => {
    if (!verificationCode) {
      showError('请输入验证码');
      return;
    }
    // Validate code format
    if (useBackupCode && verificationCode.length !== 8) {
      showError('备用码必须是8位');
      return;
    } else if (!useBackupCode && !/^\d{6}$/.test(verificationCode)) {
      showError('验证码必须是6位数字');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/login/2fa', {
        code: verificationCode,
      });

      if (res.data.success) {
        showSuccess('登录成功');
        // 保存用户信息到本地存储
        localStorage.setItem('user', JSON.stringify(res.data.data));
        if (onSuccess) {
          onSuccess(res.data.data);
        }
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isModal) {
    return (
      <div className='space-y-4'>
        <p className='text-sm leading-6 text-muted'>
          请输入认证器应用显示的验证码完成登录
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <AuthTextField
            label={useBackupCode ? '备用码' : '验证码'}
            placeholder={useBackupCode ? '请输入8位备用码' : '请输入6位验证码'}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            onKeyDown={handleKeyPress}
            icon={useBackupCode ? <KeyRound size={18} /> : <ShieldCheck size={18} />}
            className='mb-4'
            autoFocus
          />

          <AuthPrimaryButton onPress={handleSubmit} isPending={loading} className='mb-4'>
            验证并登录
          </AuthPrimaryButton>
        </form>

        <AuthDivider>2FA</AuthDivider>

        <div className='flex flex-wrap items-center justify-center gap-3'>
          <AuthGhostButton
            onPress={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
            className='h-auto w-auto px-0'
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </AuthGhostButton>

          {onBack && (
            <AuthGhostButton onPress={onBack} className='h-auto w-auto px-0'>
              返回登录
            </AuthGhostButton>
          )}
        </div>

        <div className='rounded-2xl border border-border bg-surface-secondary/80 p-4 text-sm leading-6 text-muted'>
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />• 每个备用码只能使用一次
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-[60vh] items-center justify-center'>
      <div className='w-full max-w-md'>
        <AuthPanel
          title='两步验证'
          subtitle='请输入认证器应用显示的验证码完成登录'
        >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <AuthTextField
            label={useBackupCode ? '备用码' : '验证码'}
            placeholder={useBackupCode ? '请输入8位备用码' : '请输入6位验证码'}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            onKeyDown={handleKeyPress}
            icon={useBackupCode ? <KeyRound size={18} /> : <ShieldCheck size={18} />}
            className='mb-4'
            autoFocus
          />

          <AuthPrimaryButton onPress={handleSubmit} isPending={loading} className='mb-4'>
            验证并登录
          </AuthPrimaryButton>
        </form>

        <AuthDivider>2FA</AuthDivider>

        <div className='flex flex-wrap items-center justify-center gap-3'>
          <AuthGhostButton
            onPress={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
            className='h-auto w-auto px-0'
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </AuthGhostButton>

          {onBack && (
            <AuthGhostButton onPress={onBack} className='h-auto w-auto px-0'>
              返回登录
            </AuthGhostButton>
          )}
        </div>

        <div className='mt-6 rounded-2xl border border-border bg-surface-secondary/80 p-4 text-sm leading-6 text-muted'>
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />• 每个备用码只能使用一次
        </div>
        </AuthPanel>
      </div>
    </div>
  );
};

export default TwoFAVerification;
