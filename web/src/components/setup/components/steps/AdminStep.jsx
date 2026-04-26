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
import { Card, Chip, Input } from '@heroui/react';
import { CheckCircle2, KeyRound, Lock, ShieldCheck, UserRound } from 'lucide-react';

function SetupInput({
  label,
  icon,
  value,
  onValueChange,
  placeholder,
  type = 'text',
  helper,
  autoComplete,
}) {
  const handleValueChange = (eventOrValue) => {
    onValueChange(
      eventOrValue?.target ? eventOrValue.target.value : eventOrValue,
    );
  };

  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>
        {label}
      </span>
      <div className='relative'>
        <span className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500'>
          {icon}
        </span>
        <Input
          fullWidth
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onValueChange={handleValueChange}
          onChange={handleValueChange}
          className='h-12 rounded-2xl border border-slate-200 bg-white/85 pl-10 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100'
        />
      </div>
      {helper ? (
        <span className='mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400'>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

/**
 * 管理员账号设置步骤组件
 * 提供管理员用户名和密码的设置界面
 */
const AdminStep = ({
  setupStatus,
  formData,
  setFormData,
  renderNavigationButtons,
  t,
}) => {
  const updateField = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const passwordReady = formData.password.length >= 8;
  const passwordMatched =
    formData.confirmPassword && formData.password === formData.confirmPassword;

  return (
    <>
      {setupStatus.root_init ? (
        <Card className='rounded-3xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/60 dark:bg-sky-950/30'>
          <div className='flex items-start gap-4'>
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white'>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className='text-lg font-semibold text-slate-950 dark:text-white'>
                {t('管理员账号')}
              </h3>
              <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>
                {t('管理员账号已经初始化过，请继续设置其他参数')}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]'>
          <div className='space-y-4'>
            <SetupInput
              label={t('用户名')}
              placeholder={t('请输入管理员用户名')}
              value={formData.username}
              onValueChange={updateField('username')}
              autoComplete='username'
              icon={<UserRound size={18} />}
            />
            <SetupInput
              label={t('密码')}
              placeholder={t('请输入管理员密码')}
              value={formData.password}
              onValueChange={updateField('password')}
              type='password'
              autoComplete='new-password'
              icon={<Lock size={18} />}
              helper={t('密码长度至少为8个字符')}
            />
            <SetupInput
              label={t('确认密码')}
              placeholder={t('请确认管理员密码')}
              value={formData.confirmPassword}
              onValueChange={updateField('confirmPassword')}
              type='password'
              autoComplete='new-password'
              icon={<KeyRound size={18} />}
            />
          </div>

          <Card className='rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60'>
            <div className='mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300'>
              <ShieldCheck size={22} />
            </div>
            <h3 className='text-sm font-semibold text-slate-950 dark:text-white'>
              {t('安全检查')}
            </h3>
            <div className='mt-4 space-y-3'>
              <Chip
                variant='flat'
                color={formData.username ? 'success' : 'default'}
                className='w-fit'
              >
                <CheckCircle2 size={14} />
                {t('用户名')}
              </Chip>
              <Chip
                variant='flat'
                color={passwordReady ? 'success' : 'warning'}
                className='w-fit'
              >
                <CheckCircle2 size={14} />
                {t('至少8位密码')}
              </Chip>
              <Chip
                variant='flat'
                color={passwordMatched ? 'success' : 'default'}
                className='w-fit'
              >
                <CheckCircle2 size={14} />
                {t('两次密码一致')}
              </Chip>
            </div>
          </Card>
        </div>
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default AdminStep;
