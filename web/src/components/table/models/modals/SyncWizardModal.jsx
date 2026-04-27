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
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';

const STEPS = (t) => [
  { title: t('选择方式'), description: t('选择同步来源') },
  { title: t('选择语言'), description: t('选择同步语言') },
];

function StepsBar({ current, t }) {
  const items = STEPS(t);
  return (
    <div className='flex items-center'>
      {items.map((item, idx) => {
        const active = idx <= current;
        const isCurrent = idx === current;
        return (
          <React.Fragment key={item.title}>
            <div className='flex flex-1 items-center gap-2 sm:flex-none'>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-[color:var(--app-border)] text-muted'
                }`}
              >
                {idx + 1}
              </div>
              <div className='min-w-0'>
                <div
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {item.title}
                </div>
                <div className='text-xs leading-tight text-muted'>
                  {item.description}
                </div>
              </div>
            </div>
            {idx < items.length - 1 ? (
              <div
                className={`mx-3 h-px flex-1 ${
                  idx < current ? 'bg-primary' : 'bg-[color:var(--app-border)]'
                }`}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function RadioCard({ value, current, onChange, label, extra, disabled }) {
  const selected = current === value;
  return (
    <button
      type='button'
      role='radio'
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`group flex min-w-[7rem] flex-1 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-primary bg-primary/5 text-foreground shadow-sm'
          : 'border-[color:var(--app-border)] bg-[color:var(--app-background)] text-foreground hover:border-primary/40'
      }`}
    >
      <span className='font-medium'>{label}</span>
      {extra ? <span className='text-xs text-muted'>{extra}</span> : null}
    </button>
  );
}

const SyncWizardModal = ({ visible, onClose, onConfirm, loading, t }) => {
  const [step, setStep] = useState(0);
  const [option, setOption] = useState('official');
  const [locale, setLocale] = useState('zh-CN');

  useEffect(() => {
    if (visible) {
      setStep(0);
      setOption('official');
      setLocale('zh-CN');
    }
  }, [visible]);

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('同步向导')}
            </ModalHeader>
            <ModalBody className='space-y-5 px-6 py-5'>
              <StepsBar current={step} t={t} />

              {step === 0 && (
                <div
                  role='radiogroup'
                  aria-label={t('同步方式选择')}
                  className='flex flex-wrap justify-center gap-3'
                >
                  <RadioCard
                    value='official'
                    current={option}
                    onChange={setOption}
                    label={t('官方模型同步')}
                    extra={t('从官方模型库同步')}
                  />
                  <RadioCard
                    value='config'
                    current={option}
                    onChange={setOption}
                    label={t('配置文件同步')}
                    extra={t('从配置文件同步')}
                    disabled
                  />
                </div>
              )}

              {step === 1 && (
                <div className='space-y-3'>
                  <div className='text-sm text-muted'>
                    {t('请选择同步语言')}
                  </div>
                  <div
                    role='radiogroup'
                    aria-label={t('语言选择')}
                    className='flex flex-wrap justify-center gap-3'
                  >
                    <RadioCard
                      value='en'
                      current={locale}
                      onChange={setLocale}
                      label='en'
                      extra='English'
                    />
                    <RadioCard
                      value='zh-CN'
                      current={locale}
                      onChange={setLocale}
                      label='zh-CN'
                      extra='简体中文'
                    />
                    <RadioCard
                      value='zh-TW'
                      current={locale}
                      onChange={setLocale}
                      label='zh-TW'
                      extra='繁體中文'
                    />
                    <RadioCard
                      value='ja'
                      current={locale}
                      onChange={setLocale}
                      label='ja'
                      extra='日本語'
                    />
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              {step === 1 && (
                <Button variant='tertiary' onPress={() => setStep(0)}>
                  {t('上一步')}
                </Button>
              )}
              <Button variant='tertiary' onPress={onClose}>
                {t('取消')}
              </Button>
              {step === 0 && (
                <Button
                  color='primary'
                  onPress={() => setStep(1)}
                  isDisabled={option !== 'official'}
                >
                  {t('下一步')}
                </Button>
              )}
              {step === 1 && (
                <Button
                  color='primary'
                  isPending={loading}
                  onPress={async () => {
                    await onConfirm?.({ option, locale });
                  }}
                >
                  {t('开始同步')}
                </Button>
              )}
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default SyncWizardModal;
