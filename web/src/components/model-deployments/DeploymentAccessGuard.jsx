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
import { Card, Button, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Settings, Server, AlertCircle, WifiOff } from 'lucide-react';

const { Title, Text } = Typography;

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
      <div className='mt-[60px] px-2'>
        <Card loading={true} style={{ minHeight: '400px' }}>
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Text type='secondary'>{t('加载设置中...')}</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div
        className='mt-[60px] px-4'
        style={{
          minHeight: 'calc(100vh - 60px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            padding: '0 20px',
          }}
        >
          <Card
            style={{
              padding: '60px 40px',
              borderRadius: '16px',
              border: '1px solid var(--semi-color-border)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background:
                'linear-gradient(135deg, var(--semi-color-bg-0) 0%, var(--semi-color-fill-0) 100%)',
            }}
          >
            {/* 图标区域 */}
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, rgba(var(--semi-orange-4), 0.15) 0%, rgba(var(--semi-orange-5), 0.1) 100%)',
                  border: '3px solid rgba(var(--semi-orange-4), 0.3)',
                  marginBottom: '24px',
                }}
              >
                <AlertCircle size={56} color='var(--semi-color-warning)' />
              </div>
            </div>

            {/* 标题区域 */}
            <div style={{ marginBottom: '24px' }}>
              <Title
                heading={2}
                style={{
                  color: 'var(--semi-color-text-0)',
                  margin: '0 0 12px 0',
                  fontSize: '28px',
                  fontWeight: '700',
                }}
              >
                {t('模型部署服务未启用')}
              </Title>
              <Text
                style={{
                  fontSize: '18px',
                  lineHeight: '1.6',
                  color: 'var(--semi-color-text-1)',
                  display: 'block',
                }}
              >
                {t('访问模型部署功能需要先启用 io.net 部署服务')}
              </Text>
            </div>

            {/* 配置要求区域 */}
            <div
              style={{
                backgroundColor: 'var(--semi-color-bg-1)',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid var(--semi-color-border)',
                margin: '32px 0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(var(--semi-blue-4), 0.15)',
                  }}
                >
                  <Server size={20} color='var(--semi-color-primary)' />
                </div>
                <Text
                  strong
                  style={{
                    fontSize: '16px',
                    color: 'var(--semi-color-text-0)',
                  }}
                >
                  {t('需要配置的项目')}
                </Text>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  maxWidth: '320px',
                  margin: '0 auto',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--semi-color-primary)',
                      flexShrink: 0,
                    }}
                  ></div>
                  <Text
                    style={{
                      fontSize: '15px',
                      color: 'var(--semi-color-text-1)',
                    }}
                  >
                    {t('启用 io.net 部署开关')}
                  </Text>
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--semi-color-primary)',
                      flexShrink: 0,
                    }}
                  ></div>
                  <Text
                    style={{
                      fontSize: '15px',
                      color: 'var(--semi-color-text-1)',
                    }}
                  >
                    {t('配置有效的 io.net API Key')}
                  </Text>
                </div>
              </div>
            </div>

            {/* 操作链接区域 */}
            <div style={{ marginBottom: '20px' }}>
              <div
                onClick={handleGoToSettings}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'var(--semi-color-primary)',
                  background: 'var(--semi-color-fill-0)',
                  border: '1px solid var(--semi-color-border)',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--semi-color-fill-1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--semi-color-fill-0)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Settings size={18} />
                {t('前往设置页面')}
              </div>
            </div>

            {/* 底部提示 */}
            <Text
              type='tertiary'
              style={{
                fontSize: '14px',
                color: 'var(--semi-color-text-2)',
                lineHeight: '1.5',
              }}
            >
              {t('配置完成后刷新页面即可使用模型部署功能')}
            </Text>
          </Card>
        </div>
      </div>
    );
  }

  if (connectionLoading || (connectionOk === null && !connectionError)) {
    return (
      <div className='mt-[60px] px-2'>
        <Card loading={true} style={{ minHeight: '400px' }}>
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Text type='secondary'>{t('正在检查 io.net 连接...')}</Text>
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
      <div
        className='mt-[60px] px-4'
        style={{
          minHeight: 'calc(100vh - 60px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            padding: '0 20px',
          }}
        >
          <Card
            style={{
              padding: '60px 40px',
              borderRadius: '16px',
              border: '1px solid var(--semi-color-border)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background:
                'linear-gradient(135deg, var(--semi-color-bg-0) 0%, var(--semi-color-fill-0) 100%)',
            }}
          >
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, rgba(var(--semi-red-4), 0.15) 0%, rgba(var(--semi-red-5), 0.1) 100%)',
                  border: '3px solid rgba(var(--semi-red-4), 0.3)',
                  marginBottom: '24px',
                }}
              >
                <WifiOff size={56} color='var(--semi-color-danger)' />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <Title
                heading={2}
                style={{
                  color: 'var(--semi-color-text-0)',
                  margin: '0 0 12px 0',
                  fontSize: '28px',
                  fontWeight: '700',
                }}
              >
                {title}
              </Title>
              <Text
                style={{
                  fontSize: '18px',
                  lineHeight: '1.6',
                  color: 'var(--semi-color-text-1)',
                  display: 'block',
                }}
              >
                {description}
              </Text>
              {detail ? (
                <Text
                  type='tertiary'
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.5',
                    display: 'block',
                    marginTop: '8px',
                  }}
                >
                  {detail}
                </Text>
              ) : null}
            </div>

            <div
              style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}
            >
              <Button
                type='primary'
                icon={<Settings size={18} />}
                onClick={handleGoToSettings}
              >
                {t('前往设置')}
              </Button>
              {onRetry ? (
                <Button type='tertiary' onClick={onRetry}>
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
