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
      <div className='px-2'>
        <Card
          loading={true}
          style={{ minHeight: 'calc(var(--na-space-px) * 400)' }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: 'calc(var(--na-space-px) * 50) 0',
            }}
          >
            <Text type='secondary'>{t('加载设置中...')}</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div
        className='px-4'
        style={{
          minHeight: 'calc(100vh - calc(var(--na-space-px) * 60))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 'calc(var(--na-space-px) * 600)',
            width: '100%',
            textAlign: 'center',
            padding: '0 calc(var(--na-space-px) * 20)',
          }}
        >
          <Card
            style={{
              padding:
                'calc(var(--na-space-px) * 60) calc(var(--na-space-px) * 40)',
              borderRadius: 'var(--na-radius-panel)',
              border: 'var(--na-space-px) solid var(--semi-color-border)',
              boxShadow: 'var(--na-shadow-card)',
              background: 'var(--semi-color-bg-2)',
            }}
          >
            {/* 图标区域 */}
            <div style={{ marginBottom: 'calc(var(--na-space-px) * 32)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'calc(var(--na-space-px) * 120)',
                  height: 'calc(var(--na-space-px) * 120)',
                  borderRadius: 'var(--na-radius-full)',
                  background: 'var(--semi-color-warning-light-default)',
                  border:
                    'calc(var(--na-space-px) * 3) solid var(--semi-color-warning-light-active)',
                  marginBottom: 'calc(var(--na-space-px) * 24)',
                }}
              >
                <AlertCircle size={56} color='var(--semi-color-warning)' />
              </div>
            </div>

            {/* 标题区域 */}
            <div style={{ marginBottom: 'calc(var(--na-space-px) * 24)' }}>
              <Title
                heading={2}
                style={{
                  color: 'var(--semi-color-text-0)',
                  margin: '0 0 calc(var(--na-space-px) * 12) 0',
                  fontSize: 'calc(var(--na-space-px) * 28)',
                  fontWeight: '700',
                }}
              >
                {t('模型部署服务未启用')}
              </Title>
              <Text
                style={{
                  fontSize: 'calc(var(--na-space-px) * 18)',
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
                padding: 'calc(var(--na-space-px) * 24)',
                borderRadius: 'var(--na-radius-card)',
                border: 'var(--na-space-px) solid var(--semi-color-border)',
                margin: 'calc(var(--na-space-px) * 32) 0',
                boxShadow: 'var(--na-shadow-ring-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'calc(var(--na-space-px) * 12)',
                  marginBottom: 'calc(var(--na-space-px) * 16)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'calc(var(--na-space-px) * 32)',
                    height: 'calc(var(--na-space-px) * 32)',
                    borderRadius: 'var(--na-radius-input)',
                    backgroundColor: 'rgba(var(--semi-blue-4), 0.15)',
                  }}
                >
                  <Server size={20} color='var(--semi-color-primary)' />
                </div>
                <Text
                  strong
                  style={{
                    fontSize: 'calc(var(--na-space-px) * 16)',
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
                  gap: 'calc(var(--na-space-px) * 12)',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  maxWidth: 'calc(var(--na-space-px) * 320)',
                  margin: '0 auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'calc(var(--na-space-px) * 12)',
                  }}
                >
                  <div
                    style={{
                      width: 'calc(var(--na-space-px) * 6)',
                      height: 'calc(var(--na-space-px) * 6)',
                      borderRadius: 'var(--na-radius-full)',
                      backgroundColor: 'var(--semi-color-primary)',
                      flexShrink: 0,
                    }}
                  ></div>
                  <Text
                    style={{
                      fontSize: 'calc(var(--na-space-px) * 15)',
                      color: 'var(--semi-color-text-1)',
                    }}
                  >
                    {t('启用 io.net 部署开关')}
                  </Text>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'calc(var(--na-space-px) * 12)',
                  }}
                >
                  <div
                    style={{
                      width: 'calc(var(--na-space-px) * 6)',
                      height: 'calc(var(--na-space-px) * 6)',
                      borderRadius: 'var(--na-radius-full)',
                      backgroundColor: 'var(--semi-color-primary)',
                      flexShrink: 0,
                    }}
                  ></div>
                  <Text
                    style={{
                      fontSize: 'calc(var(--na-space-px) * 15)',
                      color: 'var(--semi-color-text-1)',
                    }}
                  >
                    {t('配置有效的 io.net API Key')}
                  </Text>
                </div>
              </div>
            </div>

            {/* 操作链接区域 */}
            <div style={{ marginBottom: 'calc(var(--na-space-px) * 20)' }}>
              <div
                onClick={handleGoToSettings}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'calc(var(--na-space-px) * 8)',
                  cursor: 'pointer',
                  padding:
                    'calc(var(--na-space-px) * 12) calc(var(--na-space-px) * 24)',
                  borderRadius: 'var(--na-radius-input)',
                  fontSize: 'calc(var(--na-space-px) * 16)',
                  fontWeight: '500',
                  color: 'var(--semi-color-primary)',
                  background: 'var(--semi-color-fill-0)',
                  border: 'var(--na-space-px) solid var(--semi-color-border)',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--semi-color-fill-1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--na-shadow-card)';
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
                fontSize: 'calc(var(--na-space-px) * 14)',
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
      <div className='px-2'>
        <Card
          loading={true}
          style={{ minHeight: 'calc(var(--na-space-px) * 400)' }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: 'calc(var(--na-space-px) * 50) 0',
            }}
          >
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
        className='px-4'
        style={{
          minHeight: 'calc(100vh - calc(var(--na-space-px) * 60))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 'calc(var(--na-space-px) * 600)',
            width: '100%',
            textAlign: 'center',
            padding: '0 calc(var(--na-space-px) * 20)',
          }}
        >
          <Card
            style={{
              padding:
                'calc(var(--na-space-px) * 60) calc(var(--na-space-px) * 40)',
              borderRadius: 'var(--na-radius-panel)',
              border: 'var(--na-space-px) solid var(--semi-color-border)',
              boxShadow: 'var(--na-shadow-card)',
              background: 'var(--semi-color-bg-2)',
            }}
          >
            <div style={{ marginBottom: 'calc(var(--na-space-px) * 32)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'calc(var(--na-space-px) * 120)',
                  height: 'calc(var(--na-space-px) * 120)',
                  borderRadius: 'var(--na-radius-full)',
                  background: 'var(--semi-color-danger-light-default)',
                  border:
                    'calc(var(--na-space-px) * 3) solid var(--semi-color-danger-light-active)',
                  marginBottom: 'calc(var(--na-space-px) * 24)',
                }}
              >
                <WifiOff size={56} color='var(--semi-color-danger)' />
              </div>
            </div>

            <div style={{ marginBottom: 'calc(var(--na-space-px) * 24)' }}>
              <Title
                heading={2}
                style={{
                  color: 'var(--semi-color-text-0)',
                  margin: '0 0 calc(var(--na-space-px) * 12) 0',
                  fontSize: 'calc(var(--na-space-px) * 28)',
                  fontWeight: '700',
                }}
              >
                {title}
              </Title>
              <Text
                style={{
                  fontSize: 'calc(var(--na-space-px) * 18)',
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
                    fontSize: 'calc(var(--na-space-px) * 14)',
                    lineHeight: '1.5',
                    display: 'block',
                    marginTop: 'calc(var(--na-space-px) * 8)',
                  }}
                >
                  {detail}
                </Text>
              ) : null}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 'calc(var(--na-space-px) * 12)',
                justifyContent: 'center',
              }}
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

