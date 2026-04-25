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
import {
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Separator,
  useOverlayState,
} from '@heroui/react';

export function AuthPage({ children, turnstile }) {
  return (
    <div className='relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.15),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_24%),var(--app-background)] px-4 py-12 sm:px-6 lg:px-8'>
      <div
        className='blur-ball blur-ball-indigo'
        style={{ top: '-80px', right: '-80px', transform: 'none' }}
      />
      <div className='blur-ball blur-ball-teal' style={{ top: '50%', left: '-120px' }} />
      <div className='relative mx-auto mt-[60px] flex min-h-[calc(100vh-108px)] w-full max-w-md flex-col items-center justify-center'>
        {children}
        {turnstile ? <div className='mt-6 flex justify-center'>{turnstile}</div> : null}
      </div>
    </div>
  );
}

export function AuthBrand({ logo, systemName }) {
  return (
    <div className='mb-6 flex items-center justify-center gap-3'>
      <img
        src={logo}
        alt={systemName}
        className='h-11 w-11 rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950'
      />
      <div className='text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50'>
        {systemName}
      </div>
    </div>
  );
}

export function AuthPanel({ title, subtitle, children, className = '' }) {
  return (
    <Card className={`w-full rounded-[28px] border border-white/60 bg-white/88 px-5 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82 ${className}`}>
      <div className='mb-6 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50'>
          {title}
        </h1>
        {subtitle ? (
          <p className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export function AuthDivider({ children }) {
  return (
    <div className='my-5 flex items-center gap-4'>
      <Separator className='flex-1 bg-slate-200 dark:bg-slate-800' />
      <span className='text-xs font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500'>
        {children}
      </span>
      <Separator className='flex-1 bg-slate-200 dark:bg-slate-800' />
    </div>
  );
}

export function AuthAgreement({
  checked,
  onChange,
  hasUserAgreement,
  hasPrivacyPolicy,
  t,
}) {
  if (!hasUserAgreement && !hasPrivacyPolicy) return null;

  return (
    <div className='pt-3'>
      <Checkbox
        isSelected={checked}
        onValueChange={onChange}
        classNames={{
          base: 'items-start',
          label: 'text-sm leading-6 text-slate-500 dark:text-slate-400',
        }}
      >
        <>
          {t('我已阅读并同意')}
          {hasUserAgreement ? (
            <a
              href='/user-agreement'
              target='_blank'
              rel='noopener noreferrer'
              className='mx-1 font-medium text-sky-600 transition hover:text-sky-500'
            >
              {t('用户协议')}
            </a>
          ) : null}
          {hasUserAgreement && hasPrivacyPolicy ? t('和') : null}
          {hasPrivacyPolicy ? (
            <a
              href='/privacy-policy'
              target='_blank'
              rel='noopener noreferrer'
              className='mx-1 font-medium text-sky-600 transition hover:text-sky-500'
            >
              {t('隐私政策')}
            </a>
          ) : null}
        </>
      </Checkbox>
    </div>
  );
}

export function AuthLinkRow({ prefix, linkText, to }) {
  return (
    <div className='mt-6 text-center text-sm text-slate-500 dark:text-slate-400'>
      {prefix}{' '}
      <a href={to} className='font-medium text-sky-600 transition hover:text-sky-500'>
        {linkText}
      </a>
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  className = '',
  ...props
}) {
  return (
    <Button
      variant='primary'
      size='lg'
      className={`h-12 w-full rounded-full font-medium ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AuthOutlineButton({
  children,
  className = '',
  ...props
}) {
  return (
    <Button
      variant='outline'
      size='lg'
      className={`h-12 w-full rounded-full border-slate-200 bg-white/80 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AuthGhostButton({
  children,
  className = '',
  ...props
}) {
  return (
    <Button
      variant='ghost'
      size='lg'
      className={`h-12 w-full rounded-full font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AuthTextField({
  label,
  icon,
  action,
  className = '',
  inputClassName = '',
  onChange,
  onValueChange,
  name,
  ...props
}) {
  const handleValueChange = (eventOrValue) => {
    const value = eventOrValue?.target
      ? eventOrValue.target.value
      : eventOrValue;

    onValueChange?.(value);
    onChange?.(
      eventOrValue?.target
        ? eventOrValue
        : {
            target: {
              name,
              value,
            },
          },
    );
  };

  return (
    <label className={`block text-sm font-medium text-slate-700 dark:text-slate-200 ${className}`}>
      <span className='mb-1.5 block'>{label}</span>
      <div className='relative flex items-center'>
        {icon ? (
          <span className='pointer-events-none absolute left-3 z-10 text-slate-400 dark:text-slate-500'>
            {icon}
          </span>
        ) : null}
        <Input
          fullWidth
          className={`h-12 rounded-2xl border border-slate-200 bg-white/85 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 ${icon ? 'pl-10' : ''} ${action ? 'pr-32' : ''} ${inputClassName}`}
          name={name}
          onChange={handleValueChange}
          onValueChange={handleValueChange}
          {...props}
        />
        {action ? (
          <div className='absolute right-1.5 z-10 flex items-center'>
            {action}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function AuthModal({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText,
  cancelText,
  isConfirmLoading,
  footer,
  size = 'sm',
  isDismissable = true,
}) {
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop isDismissable={isDismissable} variant='blur'>
        <ModalContainer size={size} placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            {title ? (
              <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
                {title}
              </ModalHeader>
            ) : null}
            <ModalBody className='px-6 py-5'>{children}</ModalBody>
            {footer !== null ? (
              <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
                {footer || (
                  <>
                    <Button variant='ghost' onPress={onClose}>
                      {cancelText}
                    </Button>
                    <Button
                      isPending={isConfirmLoading}
                      variant='primary'
                      onPress={onConfirm}
                    >
                      {confirmText}
                    </Button>
                  </>
                )}
              </ModalFooter>
            ) : null}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
