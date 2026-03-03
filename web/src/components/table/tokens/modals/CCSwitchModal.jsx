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
  RadioGroup,
  Radio,
  Select,
  Input,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { selectFilter } from '../../../../helpers';

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
      Toast.warning(t('请选择主模型'));
      return;
    }
    const apiKey = 'sk-' + tokenKey;
    const url = buildCCSwitchURL(app, name, models, apiKey);
    window.open(url, '_blank');
    onClose();
  };

  const fieldLabelStyle = useMemo(
    () => ({
      marginBottom: 4,
      fontSize: 13,
      color: 'var(--semi-color-text-1)',
    }),
    [],
  );

  return (
    <Modal
      title={t('填入 CC Switch')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={t('打开 CC Switch')}
      cancelText={t('取消')}
      maskClosable={false}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={fieldLabelStyle}>{t('应用')}</div>
          <RadioGroup
            type='button'
            value={app}
            onChange={(e) => handleAppChange(e.target.value)}
            style={{ width: '100%' }}
          >
            {Object.entries(APP_CONFIGS).map(([key, cfg]) => (
              <Radio key={key} value={key}>
                {cfg.label}
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div>
          <div style={fieldLabelStyle}>{t('名称')}</div>
          <Input
            value={name}
            onChange={setName}
            placeholder={currentConfig.defaultName}
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key}>
            <div style={fieldLabelStyle}>
              {t(field.label)}
              {field.key === 'model' && (
                <Typography.Text type='danger'> *</Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('请选择模型')}
              optionList={modelOptions}
              value={models[field.key] || undefined}
              onChange={(val) => handleModelChange(field.key, val)}
              filter={selectFilter}
              style={{ width: '100%' }}
              showClear
              searchable
              emptyContent={t('暂无数据')}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
