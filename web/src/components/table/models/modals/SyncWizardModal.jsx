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
import { Modal, RadioGroup, Radio, Steps, Button } from '@douyinfe/semi-ui';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const SyncWizardModal = ({ visible, onClose, onConfirm, loading, t }) => {
  const [step, setStep] = useState(0);
  const [option, setOption] = useState('official');
  const [locale, setLocale] = useState('zh-CN');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (visible) {
      setStep(0);
      setOption('official');
      setLocale('zh-CN');
    }
  }, [visible]);

  return (
    <Modal
      title={t('同步向导')}
      visible={visible}
      onCancel={onClose}
      footer={
        <div className='flex justify-end'>
          {step === 1 && (
            <Button onClick={() => setStep(0)}>{t('上一步')}</Button>
          )}
          <Button onClick={onClose}>{t('取消')}</Button>
          {step === 0 && (
            <Button
              type='primary'
              onClick={() => setStep(1)}
              disabled={option !== 'official'}
            >
              {t('下一步')}
            </Button>
          )}
          {step === 1 && (
            <Button
              type='primary'
              theme='solid'
              loading={loading}
              onClick={async () => {
                await onConfirm?.({ option, locale });
              }}
            >
              {t('开始同步')}
            </Button>
          )}
        </div>
      }
      width={isMobile ? '100%' : 'small'}
    >
      <div className='mb-3'>
        <Steps type='basic' current={step} size='small'>
          <Steps.Step title={t('选择方式')} description={t('选择同步来源')} />
          <Steps.Step title={t('选择语言')} description={t('选择同步语言')} />
        </Steps>
      </div>

      {step === 0 && (
        <div className='mt-2 flex justify-center'>
          <RadioGroup
            value={option}
            onChange={(e) => setOption(e?.target?.value ?? e)}
            type='card'
            direction='horizontal'
            aria-label='同步方式选择'
            name='sync-mode-selection'
          >
            <Radio value='official' extra={t('从官方模型库同步')}>
              {t('官方模型同步')}
            </Radio>
            <Radio value='config' extra={t('从配置文件同步')} disabled>
              {t('配置文件同步')}
            </Radio>
          </RadioGroup>
        </div>
      )}

      {step === 1 && (
        <div className='mt-2'>
          <div className='mb-2 text-[var(--semi-color-text-2)]'>
            {t('请选择同步语言')}
          </div>
          <div className='flex justify-center'>
            <RadioGroup
              value={locale}
              onChange={(e) => setLocale(e?.target?.value ?? e)}
              type='card'
              direction='horizontal'
              aria-label='语言选择'
              name='sync-locale-selection'
            >
              <Radio value='en' extra='English'>
                en
              </Radio>
              <Radio value='zh-CN' extra='简体中文'>
                zh-CN
              </Radio>
              <Radio value='zh-TW' extra='繁體中文'>
                zh-TW
              </Radio>
              <Radio value='ja' extra='日本語'>
                ja
              </Radio>
            </RadioGroup>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default SyncWizardModal;
