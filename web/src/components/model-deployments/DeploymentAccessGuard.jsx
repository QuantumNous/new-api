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
import { Button, Card, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Settings, Server, AlertCircle, WifiOff } from 'lucide-react';

const DeploymentAccessGuard = ({
  children,
  loading,
  isEnabled,
  connectionLoading,
  connectionOk,
  connectionError,
  onRetry,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    navigate('/console/setting?tab=model-deployment');
  };

  if (loading) {
    return (
      <div>
        <Card className='min-h-[400px] rounded-2xl border border-border bg-background/80 shadow-sm'>
          <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
            <Spinner size='lg' />
            <span className='text-sm text-muted'>
              {t('加载设置中...')}
            </span>
          </div>
        </Card>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className='flex min-h-[calc(100vh-180px)] items-center justify-center px-4'>
        <div className='w-full max-w-2xl px-5 text-center'>
          <Card className='rounded-[28px] border border-warning/30 bg-warning/5 p-10 shadow-[0_24px_80px_rgba(15,23,42,0.12)]'>
            <div className='mb-8'>
              <div className='mb-6 inline-flex h-28 w-28 items-center justify-center rounded-full border-4 border-warning/30 bg-warning/10 text-warning'>
                <AlertCircle size={56} />
              </div>
            </div>

            <div className='mb-6'>
              <h2 className='mb-3 text-3xl font-bold tracking-tight text-foreground'>
                {t('模型部署服务未启用')}
              </h2>
              <p className='text-lg leading-8 text-muted'>
                {t('访问模型部署功能需要先启用 io.net 部署服务')}
              </p>
            </div>

            <div className='my-8 rounded-2xl border border-border bg-background/75 p-6 text-left shadow-sm'>
              <div className='mb-4 flex items-center justify-center gap-3 text-center'>
                <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <Server size={20} />
                </div>
                <span className='font-semibold text-foreground'>
                  {t('需要配置的项目')}
                </span>
              </div>

              <div className='mx-auto flex max-w-sm flex-col gap-3'>
                <div className='flex items-center gap-3'>
                  <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-primary' />
                  <span className='text-sm text-muted'>
                    {t('启用 io.net 部署开关')}
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-primary' />
                  <span className='text-sm text-muted'>
                    {t('配置有效的 io.net API Key')}
                  </span>
                </div>
              </div>
            </div>

            <div className='mb-5'>
              <Button
                variant='outline'
                startContent={<Settings size={18} />}
                onPress={handleGoToSettings}
              >
                {t('前往设置页面')}
              </Button>
            </div>

            <p className='text-sm leading-6 text-muted'>
              {t('配置完成后刷新页面即可使用模型部署功能')}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (connectionLoading || (connectionOk === null && !connectionError)) {
    return (
      <div>
        <Card className='min-h-[400px] rounded-2xl border border-border bg-background/80 shadow-sm'>
          <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
            <Spinner size='lg' />
            <span className='text-sm text-muted'>
              {t('正在检查 io.net 连接...')}
            </span>
          </div>
        </Card>
      </div>
    );
  }

  if (connectionOk === false) {
    const isExpired = connectionError?.type === 'expired';
    const title = isExpired ? t('接口密钥已过期') : t('无法连接 io.net');
    const description = isExpired
      ? t('当前 API 密钥已过期，请在设置中更新。')
      : t('当前配置无法连接到 io.net。');
    const detail = connectionError?.message || '';

    return (
      <div className='flex min-h-[calc(100vh-180px)] items-center justify-center px-4'>
        <div className='w-full max-w-2xl px-5 text-center'>
          <Card className='rounded-[28px] border border-danger/30 bg-danger/5 p-10 shadow-[0_24px_80px_rgba(15,23,42,0.12)]'>
            <div className='mb-8'>
              <div className='mb-6 inline-flex h-28 w-28 items-center justify-center rounded-full border-4 border-danger/30 bg-danger/10 text-danger'>
                <WifiOff size={56} />
              </div>
            </div>

            <div className='mb-6'>
              <h2 className='mb-3 text-3xl font-bold tracking-tight text-foreground'>
                {title}
              </h2>
              <p className='text-lg leading-8 text-muted'>
                {description}
              </p>
              {detail ? (
                <p className='mt-2 text-sm leading-6 text-muted'>
                  {detail}
                </p>
              ) : null}
            </div>

            <div className='flex justify-center gap-3'>
              <Button
                variant='primary'
                startContent={<Settings size={18} />}
                onPress={handleGoToSettings}
              >
                {t('前往设置')}
              </Button>
              {onRetry ? (
                <Button variant='outline' onPress={onRetry}>
                  {t('重试连接')}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return children;
};

export default DeploymentAccessGuard;
