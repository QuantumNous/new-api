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
import { Button, Card, Input, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Cloud, Zap, ArrowUpRight } from 'lucide-react';

const DEFAULT_INPUTS = {
  'model_deployment.ionet.api_key': '',
  'model_deployment.ionet.enabled': false,
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

export default function SettingModelDeployment(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const enabled = !!inputs['model_deployment.ionet.enabled'];

  const testApiKey = async () => {
    const apiKey = inputs['model_deployment.ionet.api_key'];

    const getLocalizedMessage = (message) => {
      switch (message) {
        case 'invalid request payload':
          return t('请求参数无效');
        case 'api_key is required':
          return t('请先填写 API Key');
        case 'failed to validate api key':
          return t('API Key 验证失败');
        default:
          return message;
      }
    };

    setTesting(true);
    try {
      const response = await API.post(
        '/api/deployments/settings/test-connection',
        apiKey && apiKey.trim() !== '' ? { api_key: apiKey.trim() } : {},
        { skipErrorHandler: true },
      );
      if (response?.data?.success) {
        showSuccess(t('API Key 验证成功！连接到 io.net 服务正常'));
      } else {
        const rawMessage = response?.data?.message;
        const localizedMessage = rawMessage
          ? getLocalizedMessage(rawMessage)
          : t('API Key 验证失败');
        showError(localizedMessage);
      }
    } catch (error) {
      console.error('io.net API test error:', error);
      if (error?.code === 'ERR_NETWORK') {
        showError(t('网络连接失败，请检查网络设置或稍后重试'));
      } else {
        const rawMessage =
          error?.response?.data?.message || error?.message || '';
        const localizedMessage = rawMessage
          ? getLocalizedMessage(rawMessage)
          : t('未知错误');
        showError(t('测试失败：') + localizedMessage);
      }
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = () => {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) =>
      API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
      }),
    );

    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) {
          if (requestQueue.length > 1) {
            return showError(t('部分保存失败，请重试'));
          }
          return;
        }
        showSuccess(t('保存成功'));
        setInputsRow(structuredClone(inputs));
        props.refresh?.();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!props.options) return;
    const currentInputs = { ...DEFAULT_INPUTS };
    for (const key in DEFAULT_INPUTS) {
      if (Object.prototype.hasOwnProperty.call(props.options, key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('模型部署设置')}
      </div>

      <Card className='!rounded-2xl shadow-sm border border-[color:var(--app-border)]'>
        <Card.Content className='p-6 space-y-5'>
          <div className='flex items-center gap-2 text-sm font-semibold text-foreground'>
            <Cloud size={18} />
            <span>io.net</span>
          </div>

          <div className='grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]'>
            <div className='space-y-4'>
              <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('启用 io.net 部署')}
                  </div>
                  <div className='mt-1 text-xs leading-snug text-muted'>
                    {t('启用后可接入 io.net GPU 资源')}
                  </div>
                </div>
                <Switch
                  isSelected={enabled}
                  onChange={setField('model_deployment.ionet.enabled')}
                  aria-label={t('启用 io.net 部署')}
                  size='sm'
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </label>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('API Key')}
                </div>
                <Input
                  type='password'
                  value={inputs['model_deployment.ionet.api_key'] ?? ''}
                  onChange={(e) =>
                    setField('model_deployment.ionet.api_key')(e.target.value)
                  }
                  placeholder={t('请输入 io.net API Key（敏感信息不显示）')}
                  disabled={!enabled}
                  aria-label={t('API Key')}
                  className={inputClass}
                />
                <div className='text-xs leading-snug text-muted'>
                  {t('请使用 Project 为 io.cloud 的密钥')}
                </div>
              </div>

              <div className='flex flex-wrap gap-3'>
                <Button
                  variant='secondary'
                  size='sm'
                  onPress={testApiKey}
                  isPending={testing}
                  isDisabled={!enabled}
                >
                  <Zap size={14} />
                  {testing ? t('连接测试中...') : t('测试连接')}
                </Button>
              </div>
            </div>

            <div className='flex flex-col justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
              <div>
                <div className='mb-2 text-sm font-semibold text-foreground'>
                  {t('获取 io.net API Key')}
                </div>
                <ul className='m-0 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted'>
                  <li>{t('访问 io.net 控制台的 API Keys 页面')}</li>
                  <li>{t('创建或选择密钥时，将 Project 设置为 io.cloud')}</li>
                  <li>{t('复制生成的密钥并粘贴到此处')}</li>
                </ul>
              </div>
              <Button
                color='primary'
                size='sm'
                onPress={() =>
                  window.open('https://ai.io.net/ai/api-keys', '_blank')
                }
                className='w-full'
              >
                {t('前往 io.net API Keys')}
                <ArrowUpRight size={14} />
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[100px]'
        >
          {t('保存设置')}
        </Button>
      </div>
    </div>
  );
}
