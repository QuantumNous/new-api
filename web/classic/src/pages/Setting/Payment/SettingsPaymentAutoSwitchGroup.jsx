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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
import {
  Banner,
  Button,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { API, getQuotaPerUnit, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const createRuleId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createRuleRow = (rule = {}) => ({
  id: createRuleId(),
  threshold:
    rule.threshold === undefined || rule.threshold === null
      ? ''
      : rule.threshold,
  group: String(rule.group || ''),
});

const parseRulesValue = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const parseGroupOptions = (value, fallbackGroups = []) => {
  let groupRatio = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    groupRatio = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        groupRatio = parsed;
      }
    } catch (error) {
      groupRatio = {};
    }
  }

  return Array.from(
    new Set([
      'default',
      ...Object.keys(groupRatio),
      ...fallbackGroups.filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b));
};

export default function SettingsPaymentAutoSwitchGroup(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('充值自动切组');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AutoSwitchGroupEnabled: false,
    AutoSwitchGroupOnlyNewTopups: false,
    AutoSwitchGroupBaseGroup: 'default',
  });
  const [rules, setRules] = useState([]);
  const formApiRef = useRef(null);

  const getDisplayConfig = () => {
    let type = props.options?.['general_setting.quota_display_type'];
    if (!type && props.options?.DisplayInCurrencyEnabled !== undefined) {
      type = props.options.DisplayInCurrencyEnabled ? 'USD' : 'TOKENS';
    }
    if (!type) {
      type = 'USD';
    }

    const usdExchangeRate = Number(props.options?.USDExchangeRate || 1);
    const customRate = Number(
      props.options?.['general_setting.custom_currency_exchange_rate'] || 1,
    );
    const customSymbol =
      props.options?.['general_setting.custom_currency_symbol'] || 'CUSTOM';
    const quotaUnit = Number(props.options?.QuotaPerUnit || getQuotaPerUnit());

    if (type === 'TOKENS') {
      return {
        type,
        multiplier: Number.isFinite(quotaUnit) && quotaUnit > 0 ? quotaUnit : 1,
        unitLabel: 'TOKENS',
        precision: 0,
      };
    }

    if (type === 'CNY') {
      return {
        type,
        multiplier:
          Number.isFinite(usdExchangeRate) && usdExchangeRate > 0
            ? usdExchangeRate
            : 1,
        unitLabel: 'CNY',
        precision: 6,
      };
    }

    if (type === 'CUSTOM') {
      return {
        type,
        multiplier:
          Number.isFinite(customRate) && customRate > 0 ? customRate : 1,
        unitLabel: customSymbol || 'CUSTOM',
        precision: 6,
      };
    }

    return {
      type: 'USD',
      multiplier: 1,
      unitLabel: 'USD',
      precision: 6,
    };
  };

  const displayConfig = getDisplayConfig();

  const convertUsdToDisplayThreshold = (usdValue) => {
    const numeric = Number(usdValue || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '';
    }
    const converted = numeric * displayConfig.multiplier;
    if (displayConfig.type === 'TOKENS') {
      return Math.round(converted);
    }
    return Number(converted.toFixed(6));
  };

  const convertDisplayThresholdToUsd = (displayValue) => {
    const numeric = Number(displayValue);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }
    return Number((numeric / displayConfig.multiplier).toFixed(8));
  };

  const groupOptions = useMemo(
    () =>
      parseGroupOptions(props.options?.GroupRatio, [
        props.options?.AutoSwitchGroupBaseGroup,
        ...parseRulesValue(props.options?.AutoSwitchGroupRules).map(
          (rule) => rule.group,
        ),
      ]),
    [
      props.options?.AutoSwitchGroupBaseGroup,
      props.options?.AutoSwitchGroupRules,
      props.options?.GroupRatio,
    ],
  );

  useEffect(() => {
    if (!props.options || !formApiRef.current) {
      return;
    }

    const currentInputs = {
      AutoSwitchGroupEnabled: Boolean(props.options.AutoSwitchGroupEnabled),
      AutoSwitchGroupOnlyNewTopups: Boolean(
        props.options.AutoSwitchGroupOnlyNewTopups,
      ),
      AutoSwitchGroupBaseGroup:
        props.options.AutoSwitchGroupBaseGroup || 'default',
    };

    setInputs(currentInputs);
    formApiRef.current.setValues(currentInputs);
    setRules(
      parseRulesValue(props.options.AutoSwitchGroupRules).map((rule) =>
        createRuleRow({
          threshold: convertUsdToDisplayThreshold(rule.threshold_usd),
          group: rule.group,
        }),
      ),
    );
  }, [props.options]);

  const updateRule = (ruleId, patch) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              ...patch,
            }
          : rule,
      ),
    );
  };

  const addRule = () => {
    setRules((prev) => [...prev, createRuleRow()]);
  };

  const removeRule = (ruleId) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  const buildRulesPayload = () => {
    const effectiveRules = rules
      .map((rule) => ({
        threshold: rule.threshold,
        group: String(rule.group || '').trim(),
      }))
      .filter((rule) => rule.threshold !== '' || rule.group !== '');

    if (effectiveRules.length === 0) {
      if (inputs.AutoSwitchGroupEnabled) {
        showError(t('启用充值后自动切换分组前，请至少配置一条合法规则'));
        return null;
      }
      return [];
    }

    const payload = [];
    for (let index = 0; index < effectiveRules.length; index += 1) {
      const rule = effectiveRules[index];
      const threshold = Number(rule.threshold);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        showError(
          t('第 {{index}} 条充值自动切换分组规则的阈值必须大于 0', {
            index: index + 1,
          }),
        );
        return null;
      }
      if (!rule.group) {
        showError(
          t('第 {{index}} 条充值自动切换分组规则请选择分组', {
            index: index + 1,
          }),
        );
        return null;
      }

      payload.push({
        threshold_usd: convertDisplayThresholdToUsd(threshold),
        group: rule.group,
      });
    }
    return payload;
  };

  const submitAutoSwitchGroupSettings = async () => {
    const rulesPayload = buildRulesPayload();
    if (rulesPayload === null) {
      return;
    }

    const enabled = Boolean(inputs.AutoSwitchGroupEnabled);
    const onlyNewTopups =
      enabled && Boolean(inputs.AutoSwitchGroupOnlyNewTopups);

    setLoading(true);
    try {
      const res = await API.put('/api/option/payment_auto_switch_group', {
        enabled,
        only_new_topups: onlyNewTopups,
        base_group: inputs.AutoSwitchGroupBaseGroup || 'default',
        rules: rulesPayload,
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        props.refresh && props.refresh();
      } else {
        showError(t(res.data.message || '保存失败，请重试'));
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={setInputs}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AutoSwitchGroupEnabled'
                label={t('充值后自动切换分组')}
                size='default'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='AutoSwitchGroupOnlyNewTopups'
                label={t('启用后仅统计新充值')}
                size='default'
                disabled={!inputs.AutoSwitchGroupEnabled}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Select
                field='AutoSwitchGroupBaseGroup'
                label={t('基础分组')}
                placeholder={t('请选择基础分组')}
                optionList={groupOptions.map((group) => ({
                  label: group,
                  value: group,
                }))}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 12 }}>
            <Banner
              type='info'
              description={t(
                '按累计成功的普通充值金额命中规则后切换分组；开启“仅统计新充值”后会从当前时刻重新累计，不回溯历史成功充值。',
              )}
            />
            <Banner
              type='warning'
              description={`${t(
                '仅对普通充值生效，不影响 subscription 套餐购买时的 upgrade_group 逻辑。',
              )} ${t('当前按 {{unit}} 编辑阈值，保存后统一换算为 USD。', {
                unit: displayConfig.unitLabel,
              })}`}
              style={{ marginTop: 8 }}
            />
          </div>

          <Space
            vertical
            align='start'
            spacing={12}
            style={{ width: '100%', marginTop: 12 }}
          >
            {rules.length === 0 ? (
              <Text type='tertiary'>{t('暂无规则，请点击下方按钮新增')}</Text>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <Text>{`${t('阈值')} (${displayConfig.unitLabel})`}</Text>
                      <InputNumber
                        style={{ width: '100%', marginTop: 6 }}
                        min={displayConfig.type === 'TOKENS' ? 1 : 0.000001}
                        precision={displayConfig.precision}
                        value={
                          rule.threshold === '' ? undefined : rule.threshold
                        }
                        placeholder={t('请输入阈值')}
                        onChange={(value) =>
                          updateRule(rule.id, {
                            threshold: value ?? '',
                          })
                        }
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <Text>{t('分组')}</Text>
                      <Select
                        style={{ width: '100%', marginTop: 6 }}
                        value={rule.group || undefined}
                        showClear
                        placeholder={t('请选择分组')}
                        onChange={(value) =>
                          updateRule(rule.id, {
                            group: value || '',
                          })
                        }
                      >
                        {groupOptions.map((group) => (
                          <Select.Option key={group} value={group}>
                            {group}
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      icon={<IconDelete />}
                      theme='borderless'
                      type='danger'
                      onClick={() => removeRule(rule.id)}
                    >
                      {t('删除规则')}
                    </Button>
                  </div>
                </div>
              ))
            )}

            <Button icon={<IconPlus />} onClick={addRule}>
              {t('新增规则')}
            </Button>
          </Space>

          <Button
            onClick={submitAutoSwitchGroupSettings}
            style={{ marginTop: 16 }}
          >
            {t('保存自动切组设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
