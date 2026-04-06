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
  Col,
  Form,
  Row,
  Spin,
  Switch,
  Typography,
  Banner,
  Tag,
  Space,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconTick } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsMaintenance () {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    title: '系统维护中',
    message: '系统正在维护，请稍后再试',
    notice_enabled: false,
    notice_start_at: 0,
    start_at: 0,
    end_at: 0,
    whitelist_user_ids: '[]',
    allow_admin_pass: true,
  });

  // 加载维护配置
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/maintenance/');
      if (res.data.success) {
        setSettings(res.data.data);
      } else {
        showError(res.data.message || t('加载维护配置失败'));
      }
    } catch (error) {
      showError(t('加载维护配置失败'));
    } finally {
      setLoading(false);
    }
  };

  // 保存维护配置
  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        // 确保时间字段为数字
        notice_start_at: Number(settings.notice_start_at) || 0,
        start_at: Number(settings.start_at) || 0,
        end_at: Number(settings.end_at) || 0,
      };
      const res = await API.put('/api/maintenance/', payload);
      if (res.data.success) {
        showSuccess(t('维护配置已保存'));
        loadSettings();
      } else {
        showError(res.data.message || t('保存失败'));
      }
    } catch (error) {
      showError(t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  // 快速关闭维护
  const disableMaintenance = async () => {
    setSaving(true);
    try {
      const res = await API.post('/api/maintenance/disable');
      if (res.data.success) {
        showSuccess(t('维护模式已关闭'));
        loadSettings();
      } else {
        showError(res.data.message || t('操作失败'));
      }
    } catch (error) {
      showError(t('操作失败'));
    } finally {
      setSaving(false);
    }
  };

  // 时间戳转 datetime-local 格式
  const timestampToDatetimeLocal = (ts) => {
    if (!ts || ts === 0) return '';
    const d = new Date(ts * 1000);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  // datetime-local 格式转时间戳
  const datetimeLocalToTimestamp = (dtStr) => {
    if (!dtStr) return 0;
    return Math.floor(new Date(dtStr).getTime() / 1000);
  };

  const handleFieldChange = (field) => (value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <Spin spinning={loading}>
      {/* 当前状态指示 */}
      {settings.enabled && (
        <Banner
          type='warning'
          icon={<IconAlertTriangle />}
          description={
            <Space>
              <Tag color='red' size='large'>
                {t('维护中')}
              </Tag>
              <Typography.Text strong>{settings.title}</Typography.Text>
              <Button
                size='small'
                type='danger'
                onClick={disableMaintenance}
                loading={saving}
              >
                {t('立即关闭维护')}
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {!settings.enabled && (
        <Banner
          type='info'
          icon={<IconTick />}
          description={
            <Space>
              <Tag color='green' size='large'>
                {t('正常运行')}
              </Tag>
              <Typography.Text>{t('系统运行正常，未开启维护模式')}</Typography.Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Form style={{ marginBottom: 15 }}>
        <Form.Section text={t('维护模式设置')}>
          <Typography.Text
            type='tertiary'
            style={{ marginBottom: 16, display: 'block' }}
          >
            {t('启用维护模式后，普通用户的 API 请求将被拦截并返回 503。超级管理员始终放行，普通管理员由下方开关控制')}
          </Typography.Text>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('启用维护模式')}
                </Typography.Text>
                <Switch
                  checked={settings.enabled}
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(v) => setSettings((prev) => ({ ...prev, enabled: v }))}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('普通管理员放行')}
                </Typography.Text>
                <Switch
                  checked={settings.allow_admin_pass}
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(v) =>
                    setSettings((prev) => ({ ...prev, allow_admin_pass: v }))
                  }
                />
                <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginTop: 4 }}>
                  {t('超级管理员始终放行')}
                </Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('启用预告')}
                </Typography.Text>
                <Switch
                  checked={settings.notice_enabled}
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(v) =>
                    setSettings((prev) => ({ ...prev, notice_enabled: v }))
                  }
                />
              </div>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12}>
              <Form.Input
                label={t('维护标题')}
                value={settings.title}
                placeholder={t('系统维护中')}
                onChange={(v) => setSettings((prev) => ({ ...prev, title: v }))}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.TextArea
                label={t('维护说明')}
                value={settings.message}
                placeholder={t('系统正在维护，请稍后再试')}
                onChange={(v) => setSettings((prev) => ({ ...prev, message: v }))}
                autosize={{ minRows: 2, maxRows: 4 }}
              />
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={8}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 4,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {t('维护开始时间')}
              </label>
              <input
                type='datetime-local'
                value={timestampToDatetimeLocal(settings.start_at)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    start_at: datetimeLocalToTimestamp(e.target.value),
                  }))
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 4,
                  background: 'var(--semi-color-bg-2)',
                  color: 'var(--semi-color-text-0)',
                }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 4,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {t('维护结束时间')}
              </label>
              <input
                type='datetime-local'
                value={timestampToDatetimeLocal(settings.end_at)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    end_at: datetimeLocalToTimestamp(e.target.value),
                  }))
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 4,
                  background: 'var(--semi-color-bg-2)',
                  color: 'var(--semi-color-text-0)',
                }}
              />
              <Typography.Text type='tertiary' size='small'>
                {t('留空表示不限制结束时间')}
              </Typography.Text>
            </Col>
            {settings.notice_enabled && (
              <Col xs={24} sm={12} md={8}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 4,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {t('预告开始时间')}
                </label>
                <input
                  type='datetime-local'
                  value={timestampToDatetimeLocal(settings.notice_start_at)}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notice_start_at: datetimeLocalToTimestamp(e.target.value),
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 4,
                    background: 'var(--semi-color-bg-2)',
                    color: 'var(--semi-color-text-0)',
                  }}
                />
              </Col>
            )}
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Form.Input
                label={t('白名单用户ID')}
                value={settings.whitelist_user_ids}
                placeholder='[1, 2, 3]'
                onChange={(v) =>
                  setSettings((prev) => ({ ...prev, whitelist_user_ids: v }))
                }
              />
              <Typography.Text type='tertiary' size='small'>
                {t('JSON 数组格式，如 [1,2,3]，留空或 [] 表示无白名单')}
              </Typography.Text>
            </Col>
          </Row>

          <Row style={{ marginTop: 20 }}>
            <Space>
              <Button
                type='primary'
                onClick={saveSettings}
                loading={saving}
              >
                {t('保存维护设置')}
              </Button>
              {settings.enabled && (
                <Button
                  type='danger'
                  onClick={disableMaintenance}
                  loading={saving}
                >
                  {t('立即关闭维护')}
                </Button>
              )}
            </Space>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
