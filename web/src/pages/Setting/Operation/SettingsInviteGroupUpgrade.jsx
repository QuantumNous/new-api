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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const createRule = () => ({
  localId: `${Date.now()}-${Math.random()}`,
  invite_count: 0,
  target_group: '',
  enabled: true,
});

const parseRules = (raw) => {
  if (!raw) return [];
  try {
    const parsed = Array.isArray(raw) ? raw : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((rule) => ({
      localId: `${Date.now()}-${Math.random()}`,
      invite_count: Number(rule.invite_count || 0),
      target_group: rule.target_group || '',
      enabled: rule.enabled !== false,
    }));
  } catch (error) {
    return [];
  }
};

export default function SettingsInviteGroupUpgrade(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [enabled, setEnabled] = useState(false);
  const [rules, setRules] = useState([]);
  const [lastApplyResult, setLastApplyResult] = useState(null);

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        label: group,
        value: group,
      })),
    [groups],
  );

  useEffect(() => {
    setEnabled(
      toBoolean(props.options?.['invite_group_upgrade_setting.enabled']),
    );
    setRules(parseRules(props.options?.['invite_group_upgrade_setting.rules']));
  }, [props.options]);

  useEffect(() => {
    API.get('/api/group/')
      .then((res) => {
        if (res.data.success) {
          setGroups(res.data.data || []);
          return;
        }
        throw new Error(res.data.message || 'Failed to load groups');
      })
      .catch((error) => showError(error.message || 'Failed to load groups'));
  }, []);

  const updateRule = (localId, patch) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.localId === localId ? { ...rule, ...patch } : rule,
      ),
    );
  };

  const buildPayloadRules = () =>
    rules.map((rule) => ({
      invite_count: Number(rule.invite_count || 0),
      target_group: rule.target_group || '',
      enabled: rule.enabled !== false,
    }));

  const validateBeforeSave = () => {
    const payloadRules = buildPayloadRules();
    if (payloadRules.length === 0) {
      return [];
    }

    const seenInviteCounts = new Set();
    for (const rule of payloadRules) {
      if (!rule.invite_count || rule.invite_count <= 0) {
        throw new Error('Invite count must be greater than 0');
      }
      if (!rule.target_group) {
        throw new Error('Target group is required');
      }
      if (seenInviteCounts.has(rule.invite_count)) {
        throw new Error(`Duplicate invite count: ${rule.invite_count}`);
      }
      seenInviteCounts.add(rule.invite_count);
    }

    return payloadRules.sort((a, b) => a.invite_count - b.invite_count);
  };

  const persistSettings = async (showToast = true) => {
    const payloadRules = validateBeforeSave();
    await Promise.all([
      API.put('/api/option/', {
        key: 'invite_group_upgrade_setting.enabled',
        value: String(enabled),
      }),
      API.put('/api/option/', {
        key: 'invite_group_upgrade_setting.rules',
        value: JSON.stringify(payloadRules),
      }),
    ]);
    if (showToast) {
      showSuccess('Invite group upgrade settings saved');
    }
    await props.refresh();
    return payloadRules;
  };

  const onSave = async () => {
    try {
      setLoading(true);
      await persistSettings(true);
    } catch (error) {
      showError(error?.response?.data?.message || error.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const onApply = async () => {
    try {
      setLoading(true);
      const payloadRules = await persistSettings(false);
      if (payloadRules.length === 0) {
        return showWarning('Please add at least one invite upgrade rule first');
      }
      const res = await API.post('/api/option/invite_group_upgrade/apply', {});
      if (!res.data.success) {
        throw new Error(res.data.message || 'Apply failed');
      }
      const summary = res.data.data?.summary || null;
      setLastApplyResult(summary);
      showSuccess('Historical invite upgrade apply finished');
      await props.refresh();
    } catch (error) {
      showError(error?.response?.data?.message || error.message || 'Apply failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title heading={5} style={{ margin: 0 }}>
          {t('Invite auto group upgrade')}
        </Typography.Title>
      </div>

      <Banner
        type='info'
        bordered
        closeIcon={null}
        description={t(
          'After enabling, the system will automatically evaluate inviter counts after each successful invite and upgrade the user to the configured target group. The manual apply button can backfill historical data.',
        )}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Typography.Text strong>
              {t('Enable invite auto upgrade')}
            </Typography.Text>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
        </Col>
      </Row>

      <Space vertical align='start' style={{ width: '100%' }} spacing='medium'>
        {rules.map((rule, index) => (
          <div
            key={rule.localId}
            style={{
              width: '100%',
              padding: 16,
              border: '1px solid var(--semi-color-border)',
              borderRadius: 12,
            }}
          >
            <Row gutter={16} align='middle'>
              <Col xs={24} sm={8} md={6} lg={6} xl={5}>
                <Typography.Text strong>
                  {t('Rule')} #{index + 1}
                </Typography.Text>
              </Col>
              <Col xs={24} sm={8} md={6} lg={6} xl={5}>
                <InputNumber
                  min={1}
                  value={rule.invite_count}
                  onChange={(value) =>
                    updateRule(rule.localId, {
                      invite_count: Number(value || 0),
                    })
                  }
                  placeholder={t('Invite count')}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={8} md={7} lg={7} xl={6}>
                <Select
                  value={rule.target_group}
                  optionList={groupOptions}
                  onChange={(value) =>
                    updateRule(rule.localId, { target_group: value })
                  }
                  placeholder={t('Target group')}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={12} sm={6} md={3} lg={3} xl={3}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text>{t('Enabled')}</Typography.Text>
                  <Switch
                    checked={rule.enabled}
                    onChange={(value) =>
                      updateRule(rule.localId, { enabled: value })
                    }
                  />
                </div>
              </Col>
              <Col xs={12} sm={6} md={2} lg={2} xl={2}>
                <Button
                  theme='borderless'
                  type='danger'
                  onClick={() =>
                    setRules((prev) =>
                      prev.filter((item) => item.localId !== rule.localId),
                    )
                  }
                >
                  {t('Delete')}
                </Button>
              </Col>
            </Row>
          </div>
        ))}

        <Space>
          <Button theme='light' onClick={() => setRules((prev) => [...prev, createRule()])}>
            {t('Add rule')}
          </Button>
          <Button onClick={onSave}>{t('Save invite upgrade settings')}</Button>
          <Button type='primary' theme='solid' onClick={onApply}>
            {t('Apply to historical users')}
          </Button>
        </Space>

        {lastApplyResult && (
          <Banner
            type='success'
            bordered
            closeIcon={null}
            description={`${t('Scanned')} ${lastApplyResult.scanned || 0}, ${t('Eligible')} ${lastApplyResult.eligible || 0}, ${t('Upgraded')} ${lastApplyResult.upgraded || 0}.`}
            style={{ width: '100%' }}
          />
        )}
      </Space>
    </Spin>
  );
}
