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

import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Switch,
  Typography,
} from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const businessFeatureItems = [
  {
    key: 'wallet_topup',
    label: '额度充值',
    description: '用户直接购买余额或额度',
  },
  {
    key: 'subscription_purchase',
    label: '订阅购买',
    description: '用户购买订阅套餐',
  },
  {
    key: 'redemption_redeem',
    label: '兑换码使用',
    description: '用户使用兑换码兑换额度',
  },
  {
    key: 'redemption_manage',
    label: '兑换码管理',
    description: '管理员创建和管理兑换码',
  },
  {
    key: 'invitation_reward',
    label: '邀请奖励',
    description: '邀请人和被邀请人获得奖励额度',
  },
  {
    key: 'invitation_transfer',
    label: '奖励转余额',
    description: '用户将邀请奖励转入余额',
  },
  {
    key: 'checkin_reward',
    label: '签到奖励',
    description: '用户每日签到获得奖励额度',
  },
];

const paymentSceneItems = [
  { key: 'wallet_topup', label: '额度充值' },
  { key: 'subscription_purchase', label: '订阅购买' },
];

const paymentProviderItems = [
  {
    key: 'epay',
    label: '易支付',
    supportedScenes: ['wallet_topup', 'subscription_purchase'],
  },
  {
    key: 'stripe',
    label: 'Stripe',
    supportedScenes: ['wallet_topup', 'subscription_purchase'],
  },
  {
    key: 'creem',
    label: 'Creem',
    supportedScenes: ['wallet_topup', 'subscription_purchase'],
  },
  { key: 'waffo', label: 'Waffo', supportedScenes: ['wallet_topup'] },
  {
    key: 'waffo_pancake',
    label: 'Waffo Pancake',
    supportedScenes: ['wallet_topup'],
  },
];

const defaultBusinessFeatures = {
  wallet_topup: true,
  subscription_purchase: true,
  redemption_redeem: true,
  redemption_manage: true,
  invitation_reward: true,
  invitation_transfer: true,
  checkin_reward: true,
};

const defaultProviderSceneScopes = {
  epay: { wallet_topup: true, subscription_purchase: true },
  stripe: { wallet_topup: true, subscription_purchase: true },
  creem: { wallet_topup: true, subscription_purchase: true },
  waffo: { wallet_topup: true, subscription_purchase: false },
  waffo_pancake: { wallet_topup: true, subscription_purchase: false },
};

const panelStyle = {
  border: '1px solid var(--semi-color-border)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--semi-color-bg-0)',
};

const switchRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 56,
  padding: '10px 0',
  borderBottom: '1px solid var(--semi-color-border)',
};

const sceneGridColumns =
  'minmax(80px, 1fr) minmax(72px, 86px) minmax(72px, 86px)';

const parseObject = (value) => {
  try {
    const parsed = JSON.parse(value || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    return {};
  }
  return {};
};

const readBoolean = (value, fallback) =>
  typeof value === 'boolean' ? value : fallback;

const readBusinessFeatures = (value) => {
  const parsed = parseObject(value);
  return businessFeatureItems.reduce((features, item) => {
    features[item.key] = readBoolean(
      parsed[item.key],
      defaultBusinessFeatures[item.key],
    );
    return features;
  }, {});
};

const writeBusinessFeatures = (features) =>
  JSON.stringify(
    businessFeatureItems.reduce((result, item) => {
      result[item.key] = !!features[item.key];
      return result;
    }, {}),
    null,
    2,
  );

const readProviderSceneScopes = (value) => {
  const parsed = parseObject(value);
  return paymentProviderItems.reduce((providers, provider) => {
    const rawProvider = parsed[provider.key];
    const scenes =
      rawProvider &&
      typeof rawProvider === 'object' &&
      !Array.isArray(rawProvider)
        ? rawProvider
        : {};
    providers[provider.key] = paymentSceneItems.reduce((sceneResult, scene) => {
      const supported = provider.supportedScenes.includes(scene.key);
      sceneResult[scene.key] = supported
        ? readBoolean(
            scenes[scene.key],
            defaultProviderSceneScopes[provider.key][scene.key],
          )
        : false;
      return sceneResult;
    }, {});
    return providers;
  }, {});
};

const writeProviderSceneScopes = (scopes) =>
  JSON.stringify(
    paymentProviderItems.reduce((providerResult, provider) => {
      providerResult[provider.key] = paymentSceneItems.reduce(
        (sceneResult, scene) => {
          const supported = provider.supportedScenes.includes(scene.key);
          sceneResult[scene.key] = supported
            ? !!scopes[provider.key]?.[scene.key]
            : false;
          return sceneResult;
        },
        {},
      );
      return providerResult;
    }, {}),
    null,
    2,
  );

export default function SettingsGeneralPayment(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('通用设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    ServerAddress: '',
    CustomCallbackAddress: '',
    TopupGroupRatio: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',
    BusinessFeatures: '',
    ProviderSceneScopes: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        ServerAddress: props.options.ServerAddress || '',
        CustomCallbackAddress: props.options.CustomCallbackAddress || '',
        TopupGroupRatio: props.options.TopupGroupRatio || '',
        PayMethods: props.options.PayMethods || '',
        AmountOptions: props.options.AmountOptions || '',
        AmountDiscount: props.options.AmountDiscount || '',
        BusinessFeatures: props.options.BusinessFeatures || '',
        ProviderSceneScopes: props.options.ProviderSceneScopes || '',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs((prev) => ({ ...prev, ...values }));
  };

  const updateInputValue = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    formApiRef.current?.setValue(key, value);
  };

  const updateBusinessFeature = (featureKey, enabled) => {
    const next = readBusinessFeatures(inputs.BusinessFeatures);
    next[featureKey] = enabled;
    updateInputValue('BusinessFeatures', writeBusinessFeatures(next));
  };

  const updateProviderSceneScope = (providerKey, sceneKey, enabled) => {
    const next = readProviderSceneScopes(inputs.ProviderSceneScopes);
    next[providerKey] = {
      ...next[providerKey],
      [sceneKey]: enabled,
    };
    updateInputValue('ProviderSceneScopes', writeProviderSceneScopes(next));
  };

  const submitGeneralSettings = async () => {
    if (
      originInputs.TopupGroupRatio !== inputs.TopupGroupRatio &&
      !verifyJSON(inputs.TopupGroupRatio)
    ) {
      showError(t('充值分组倍率不是合法的 JSON 字符串'));
      return;
    }

    if (
      originInputs.PayMethods !== inputs.PayMethods &&
      !verifyJSON(inputs.PayMethods)
    ) {
      showError(t('充值方式设置不是合法的 JSON 字符串'));
      return;
    }

    if (
      originInputs.AmountOptions !== inputs.AmountOptions &&
      inputs.AmountOptions.trim() !== '' &&
      !verifyJSON(inputs.AmountOptions)
    ) {
      showError(t('自定义充值数量选项不是合法的 JSON 数组'));
      return;
    }

    if (
      originInputs.AmountDiscount !== inputs.AmountDiscount &&
      inputs.AmountDiscount.trim() !== '' &&
      !verifyJSON(inputs.AmountDiscount)
    ) {
      showError(t('充值金额折扣配置不是合法的 JSON 对象'));
      return;
    }

    if (
      originInputs.BusinessFeatures !== inputs.BusinessFeatures &&
      inputs.BusinessFeatures.trim() !== '' &&
      !verifyJSON(inputs.BusinessFeatures)
    ) {
      showError(t('业务能力开关配置不是合法的 JSON 对象'));
      return;
    }

    if (
      originInputs.ProviderSceneScopes !== inputs.ProviderSceneScopes &&
      inputs.ProviderSceneScopes.trim() !== '' &&
      !verifyJSON(inputs.ProviderSceneScopes)
    ) {
      showError(t('支付通道场景配置不是合法的 JSON 对象'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        {
          key: 'ServerAddress',
          value: removeTrailingSlash(inputs.ServerAddress),
        },
      ];

      if (inputs.CustomCallbackAddress !== '') {
        options.push({
          key: 'CustomCallbackAddress',
          value: removeTrailingSlash(inputs.CustomCallbackAddress),
        });
      }
      if (originInputs.TopupGroupRatio !== inputs.TopupGroupRatio) {
        options.push({ key: 'TopupGroupRatio', value: inputs.TopupGroupRatio });
      }
      if (originInputs.PayMethods !== inputs.PayMethods) {
        options.push({ key: 'PayMethods', value: inputs.PayMethods });
      }
      if (originInputs.AmountOptions !== inputs.AmountOptions) {
        options.push({
          key: 'payment_setting.amount_options',
          value: inputs.AmountOptions,
        });
      }
      if (originInputs.AmountDiscount !== inputs.AmountDiscount) {
        options.push({
          key: 'payment_setting.amount_discount',
          value: inputs.AmountDiscount,
        });
      }
      if (originInputs.BusinessFeatures !== inputs.BusinessFeatures) {
        options.push({
          key: 'payment_setting.business_features',
          value: inputs.BusinessFeatures,
        });
      }
      if (originInputs.ProviderSceneScopes !== inputs.ProviderSceneScopes) {
        options.push({
          key: 'payment_setting.provider_scene_scopes',
          value: inputs.ProviderSceneScopes,
        });
      }

      const results = await Promise.all(
        options.map((option) =>
          API.put('/api/option/', {
            key: option.key,
            value: option.value,
          }),
        ),
      );

      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length === 0) {
        showSuccess(t('更新成功'));
        setOriginInputs({ ...inputs });
        props.refresh && props.refresh();
      } else {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Form.Input
            field='ServerAddress'
            label={t('服务器地址')}
            placeholder={'https://yourdomain.com'}
            style={{ width: '100%' }}
            extraText={t(
              '该服务器地址将影响支付回调地址以及默认首页展示的地址，请确保正确配置',
            )}
          />
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='CustomCallbackAddress'
                label={t('回调地址')}
                placeholder={t('例如：https://yourdomain.com')}
                extraText={t(
                  '留空时默认使用服务器地址作为回调地址，填写后将覆盖默认值',
                )}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='TopupGroupRatio'
                label={t('充值分组倍率')}
                placeholder={t('为一个 JSON 文本，键为组名称，值为倍率')}
                autosize
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='PayMethods'
                label={t('充值方式设置')}
                placeholder={t('为一个 JSON 文本')}
                autosize
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='AmountOptions'
                label={t('自定义充值数量选项')}
                placeholder={t(
                  '为一个 JSON 数组，例如：[10, 20, 50, 100, 200, 500]',
                )}
                autosize
                extraText={t(
                  '设置用户可选择的充值数量选项，例如：[10, 20, 50, 100, 200, 500]',
                )}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.TextArea
                field='AmountDiscount'
                label={t('充值金额折扣配置')}
                placeholder={t(
                  '为一个 JSON 对象，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
                autosize
                extraText={t(
                  '设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Slot label={t('业务能力开关')}>
                <div style={panelStyle}>
                  {businessFeatureItems.map((item, index) => {
                    const features = readBusinessFeatures(
                      inputs.BusinessFeatures,
                    );
                    return (
                      <div
                        key={item.key}
                        style={{
                          ...switchRowStyle,
                          borderBottom:
                            index === businessFeatureItems.length - 1
                              ? 'none'
                              : switchRowStyle.borderBottom,
                        }}
                      >
                        <div>
                          <Text strong>{t(item.label)}</Text>
                          <br />
                          <Text type='tertiary' size='small'>
                            {t(item.description)}
                          </Text>
                        </div>
                        <Switch
                          checked={features[item.key]}
                          onChange={(checked) =>
                            updateBusinessFeature(item.key, checked)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </Form.Slot>
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Slot label={t('支付通道场景')}>
                <div style={panelStyle}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: sceneGridColumns,
                      gap: 6,
                      paddingBottom: 8,
                      borderBottom: '1px solid var(--semi-color-border)',
                    }}
                  >
                    <Text type='secondary' size='small'>
                      {t('支付通道')}
                    </Text>
                    {paymentSceneItems.map((scene) => (
                      <Text
                        key={scene.key}
                        type='secondary'
                        size='small'
                        style={{ textAlign: 'center' }}
                      >
                        {t(scene.label)}
                      </Text>
                    ))}
                  </div>
                  {paymentProviderItems.map((provider) => {
                    const scopes = readProviderSceneScopes(
                      inputs.ProviderSceneScopes,
                    );
                    return (
                      <div
                        key={provider.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: sceneGridColumns,
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 48,
                          borderBottom: '1px solid var(--semi-color-border)',
                        }}
                      >
                        <Text strong>{t(provider.label)}</Text>
                        {paymentSceneItems.map((scene) => {
                          const supported = provider.supportedScenes.includes(
                            scene.key,
                          );
                          return (
                            <div
                              key={scene.key}
                              style={{
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                            >
                              <Switch
                                checked={
                                  supported && scopes[provider.key]?.[scene.key]
                                }
                                disabled={!supported}
                                onChange={(checked) =>
                                  updateProviderSceneScope(
                                    provider.key,
                                    scene.key,
                                    checked,
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </Form.Slot>
            </Col>
          </Row>
          <Button onClick={submitGeneralSettings} style={{ marginTop: 16 }}>
            {t('保存通用设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
