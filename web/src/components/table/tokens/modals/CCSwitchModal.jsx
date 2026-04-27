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
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { showWarning } from '../../../../helpers';

const APP_CONFIGS = {
  claude: {
    label: 'Claude',
    defaultName: 'My Claude',
    modelFields: [
      { key: 'model', label: '主模型' },
      { key: 'haikuModel', label: 'Haiku 模型' },
      { key: 'sonnetModel', label: 'Sonnet 模型' },
      { key: 'opusModel', label: 'Opus 模型' },
    ],
  },
  codex: {
    label: 'Codex',
    defaultName: 'My Codex',
    modelFields: [{ key: 'model', label: '主模型' }],
  },
  gemini: {
    label: 'Gemini',
    defaultName: 'My Gemini',
    modelFields: [{ key: 'model', label: '主模型' }],
  },
};

function getServerAddress() {
  try {
    const raw = localStorage.getItem('status');
    if (raw) {
      const status = JSON.parse(raw);
      if (status.server_address) return status.server_address;
    }
  } catch (_) {}
  return window.location.origin;
}

function buildCCSwitchURL(app, name, models, apiKey) {
  const serverAddress = getServerAddress();
  const endpoint = app === 'codex' ? serverAddress + '/v1' : serverAddress;
  const params = new URLSearchParams();
  params.set('resource', 'provider');
  params.set('app', app);
  params.set('name', name);
  params.set('endpoint', endpoint);
  params.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v);
  }
  params.set('homepage', serverAddress);
  params.set('enabled', 'true');
  return `ccswitch://v1/import?${params.toString()}`;
}

export default function CCSwitchModal({
  visible,
  onClose,
  tokenKey,
  modelOptions,
}) {
  const { t } = useTranslation();
  const [app, setApp] = useState('claude');
  const [name, setName] = useState(APP_CONFIGS.claude.defaultName);
  const [models, setModels] = useState({});
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  const currentConfig = APP_CONFIGS[app];

  useEffect(() => {
    if (visible) {
      setModels({});
      setApp('claude');
      setName(APP_CONFIGS.claude.defaultName);
    }
  }, [visible]);

  const handleAppChange = (val) => {
    setApp(val);
    setName(APP_CONFIGS[val].defaultName);
    setModels({});
  };

  const handleModelChange = (field, value) => {
    setModels((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!models.model) {
      showWarning(t('请选择主模型'));
      return;
    }
    const url = buildCCSwitchURL(app, name, models, 'sk-' + tokenKey);
    window.open(url, '_blank');
    onClose();
  };

  const fieldLabelStyle = useMemo(
    () => 'mb-1 text-[13px] font-medium text-foreground',
    [],
  );

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('填入 CC Switch')}
            </ModalHeader>
            <ModalBody className='px-6 py-5'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className={fieldLabelStyle}>{t('应用')}</div>
                  <div className='grid grid-cols-3 gap-2'>
                    {Object.entries(APP_CONFIGS).map(([key, cfg]) => (
                      <button
                        key={key}
                        type='button'
                        onClick={() => handleAppChange(key)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          app === key
                            ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-500/10 dark:text-sky-200'
                            : 'border-border bg-background text-muted hover:border-primary'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className={fieldLabelStyle}>{t('名称')}</div>
                  <Input
                    value={name}
                    onValueChange={setName}
                    placeholder={currentConfig.defaultName}
                    size='sm'
                  />
                </div>

                {currentConfig.modelFields.map((field) => (
                  <div key={field.key}>
                    <div className={fieldLabelStyle}>
                      {t(field.label)}
                      {field.key === 'model' && (
                        <span className='text-danger'> *</span>
                      )}
                    </div>
                    <select
                      value={models[field.key] || ''}
                      onChange={(event) =>
                        handleModelChange(field.key, event.target.value)
                      }
                      className='h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
                    >
                      <option value=''>{t('请选择模型')}</option>
                      {(modelOptions || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {typeof option.label === 'string'
                            ? option.label
                            : option.value}
                        </option>
                      ))}
                    </select>
                    {(modelOptions || []).length === 0 ? (
                      <div className='mt-1 text-xs text-muted'>
                        {t('暂无数据')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={onClose}>
                {t('取消')}
              </Button>
              <Button color='primary' onPress={handleSubmit}>
                {t('打开 CC Switch')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
