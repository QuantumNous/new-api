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
        className='h-11 w-11 rounded-2xl border border-border bg-background p-1.5 shadow-sm'
      />
      <div className='text-xl font-semibold tracking-tight text-foreground'>
        {systemName}
      </div>
    </div>
  );
}

export function AuthPanel({ title, subtitle, children, className = '' }) {
  return (
    <Card className={`w-full rounded-[28px] border border-border bg-background/88 px-5 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl ${className}`}>
      <div className='mb-6 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight text-foreground'>
          {title}
        </h1>
        {subtitle ? (
          <p className='mt-2 text-sm leading-6 text-muted'>
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
      <Separator className='flex-1 bg-border' />
      <span className='text-xs font-medium uppercase tracking-[0.22em] text-muted'>
        {children}
      </span>
      <Separator className='flex-1 bg-border' />
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
          label: 'text-sm leading-6 text-muted',
        }}
      >
        <>
          {t('我已阅读并同意')}
          {hasUserAgreement ? (
            <a
              href='/user-agreement'
              target='_blank'
              rel='noopener noreferrer'
              className='mx-1 font-medium text-primary transition hover:text-primary/80'
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
              className='mx-1 font-medium text-primary transition hover:text-primary/80'
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
    <div className='mt-6 text-center text-sm text-muted'>
      {prefix}{' '}
      <a href={to} className='font-medium text-primary transition hover:text-primary/80'>
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
      className={`h-12 w-full rounded-full border-border bg-background/80 font-medium text-foreground hover:bg-surface-secondary ${className}`}
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
      className={`h-12 w-full rounded-full font-medium text-muted hover:text-foreground ${className}`}
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
    <label className={`block text-sm font-medium text-foreground ${className}`}>
      <span className='mb-1.5 block'>{label}</span>
      <div className='relative flex items-center'>
        {icon ? (
          <span className='pointer-events-none absolute left-3 z-10 text-muted'>
            {icon}
          </span>
        ) : null}
        <Input
          fullWidth
          className={`h-12 rounded-2xl border border-border bg-background/85 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${icon ? 'pl-10' : ''} ${action ? 'pr-32' : ''} ${inputClassName}`}
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
          <ModalDialog className='bg-background/95 backdrop-blur'>
            {title ? (
              <ModalHeader className='border-b border-border'>
                {title}
              </ModalHeader>
            ) : null}
            <ModalBody className='px-6 py-5'>{children}</ModalBody>
            {footer !== null ? (
              <ModalFooter className='border-t border-border'>
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
