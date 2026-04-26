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

import React, { useEffect, useState } from 'react';
import {
  API,
  copy,
  showError,
  showNotice,
  getLogo,
  getSystemName,
} from '../../helpers';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@heroui/react';
import { Copy, LockKeyhole, Mail, TriangleAlert } from 'lucide-react';
import {
  AuthBrand,
  AuthLinkRow,
  AuthPage,
  AuthPanel,
  AuthPrimaryButton,
  AuthTextField,
} from './AuthLayout';

const PasswordResetConfirm = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    email: '',
    token: '',
  });
  const { email, token } = inputs;
  const isValidResetLink = email && token;

  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [newPassword, setNewPassword] = useState('');
  const [searchParams] = useSearchParams();

  const logo = getLogo();
  const systemName = getSystemName();

  useEffect(() => {
    let token = searchParams.get('token');
    let email = searchParams.get('email');
    setInputs({
      token: token || '',
      email: email || '',
    });
  }, [searchParams]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  async function handleSubmit(e) {
    if (!email || !token) {
      showError(t('无效的重置链接，请重新发起密码重置请求'));
      return;
    }
    setDisableButton(true);
    setLoading(true);
    const res = await API.post(`/api/user/reset`, {
      email,
      token,
    });
    const { success, message } = res.data;
    if (success) {
      let password = res.data.data;
      setNewPassword(password);
      await copy(password);
      showNotice(`${t('密码已重置并已复制到剪贴板：')} ${password}`);
    } else {
      showError(message);
    }
    setLoading(false);
  }

  return (
    <AuthPage>
      <AuthBrand logo={logo} systemName={systemName} />
      <AuthPanel
        title={t('密码重置确认')}
        subtitle={t('确认邮件信息后，系统会为你生成并复制一个新密码。')}
      >
        {!isValidResetLink && (
          <div className='mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'>
            <TriangleAlert size={18} className='mt-0.5 shrink-0' />
            <span>{t('无效的重置链接，请重新发起密码重置请求')}</span>
          </div>
        )}
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <AuthTextField
            label={t('邮箱')}
            name='email'
            value={email}
            isDisabled
            icon={<Mail size={18} />}
            placeholder={email ? '' : t('等待获取邮箱信息...')}
          />

          {newPassword && (
            <AuthTextField
              label={t('新密码')}
              name='newPassword'
              value={newPassword}
              isDisabled
              icon={<LockKeyhole size={18} />}
              action={
                <Button
                  size='sm'
                  variant='ghost'
                  startContent={<Copy size={14} />}
                  onPress={async () => {
                    await copy(newPassword);
                    showNotice(`${t('密码已复制到剪贴板：')} ${newPassword}`);
                  }}
                >
                  {t('复制')}
                </Button>
              }
            />
          )}

          <div className='pt-2'>
            <AuthPrimaryButton
              onPress={handleSubmit}
              isPending={loading}
              isDisabled={disableButton || newPassword || !isValidResetLink}
            >
              {newPassword ? t('密码重置完成') : t('确认重置密码')}
            </AuthPrimaryButton>
          </div>
        </form>

        <AuthLinkRow prefix='' linkText={t('返回登录')} to='/login' />
      </AuthPanel>
    </AuthPage>
  );
};

export default PasswordResetConfirm;
