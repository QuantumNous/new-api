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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Spin,
  Modal,
  Input,
  Checkbox,
  Select,
  TagInput,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function GeneralSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrency, setNewCurrency] = useState({
    code: '',
    symbol: '',
    exchange_rate: '',
  });
  const [inputs, setInputs] = useState({
    TopUpLink: '',
    'general_setting.docs_link': '',
    'general_setting.quota_display_type': 'USD',
    'general_setting.enabled_currencies': '["USD"]',
    'general_setting.custom_currency_symbol': '¤',
    'general_setting.custom_currency_exchange_rate': '',
    'general_setting.custom_currencies': '[]',
    'general_setting.redemption_enabled': true,
    'general_setting.redemption_allowed_groups': '[]',
    QuotaPerUnit: '',
    RetryTimes: '',
    USDExchangeRate: '',
    DisplayTokenStatEnabled: false,
    DefaultCollapseSidebar: false,
    DemoSiteEnabled: false,
    SelfUseModeEnabled: false,
    'token_setting.max_user_tokens': 1000,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  // 解析自定义货币列表
  const customCurrencies = useMemo(() => {
    try {
      const val = inputs['general_setting.custom_currencies'];
      if (typeof val === 'string') return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch (e) {
      return [];
    }
  }, [inputs['general_setting.custom_currencies']]);

  // 解析启用的货币列表
  const enabledCurrencies = useMemo(() => {
    try {
      const val = inputs['general_setting.enabled_currencies'];
      if (typeof val === 'string') return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return ['USD'];
    } catch (e) {
      return ['USD'];
    }
  }, [inputs['general_setting.enabled_currencies']]);

  // 解析兑换码允许的分组列表
  const redemptionAllowedGroups = useMemo(() => {
    try {
      const val = inputs['general_setting.redemption_allowed_groups'];
      if (typeof val === 'string') return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch (e) {
      return [];
    }
  }, [inputs['general_setting.redemption_allowed_groups']]);

  // 获取所有可用货币选项列表（内置 + 自定义）
  const allCurrencyOptions = useMemo(() => {
    const builtIn = [
      { code: 'USD', label: 'USD ($)' },
      { code: 'CNY', label: 'CNY (¥)' },
      { code: 'TOKENS', label: 'Tokens' },
    ];
    // 旧版 CUSTOM 仅在当前选中时展示
    if (inputs['general_setting.quota_display_type'] === 'CUSTOM' || enabledCurrencies.includes('CUSTOM')) {
      builtIn.push({
        code: 'CUSTOM',
        label: `${t('自定义')} (${inputs['general_setting.custom_currency_symbol'] || '¤'})`,
      });
    }
    const custom = customCurrencies.map((c) => ({
      code: c.code,
      label: `${c.code} (${c.symbol})`,
    }));
    return [...builtIn, ...custom];
  }, [customCurrencies, enabledCurrencies, inputs['general_setting.quota_display_type'], inputs['general_setting.custom_currency_symbol'], t]);

  // 更新自定义货币列表
  const updateCustomCurrencies = (newList) => {
    setInputs((prev) => ({
      ...prev,
      'general_setting.custom_currencies': JSON.stringify(newList),
    }));
  };

  // 切换启用/禁用货币
  const handleCurrencyToggle = (code) => {
    const current = [...enabledCurrencies];
    const idx = current.indexOf(code);
    if (idx >= 0) {
      // 至少保留一种
      if (current.length <= 1) {
        return;
      }
      current.splice(idx, 1);
      // 如果禁用了当前默认货币，自动切换默认到第一个启用的
      if (inputs['general_setting.quota_display_type'] === code) {
        setInputs((prev) => ({
          ...prev,
          'general_setting.quota_display_type': current[0],
        }));
      }
    } else {
      current.push(code);
    }
    setInputs((prev) => ({
      ...prev,
      'general_setting.enabled_currencies': JSON.stringify(current),
    }));
  };

  // 新增自定义货币
  const handleAddCurrency = () => {
    const code = newCurrency.code.trim().toUpperCase();
    const symbol = newCurrency.symbol.trim();
    const rate = parseFloat(newCurrency.exchange_rate) || 1;

    if (!code || !symbol) {
      showError(t('请填写货币代码和符号'));
      return;
    }

    const presetCodes = ['USD', 'CNY', 'TOKENS', 'CUSTOM'];
    if (
      presetCodes.includes(code) ||
      customCurrencies.some((c) => c.code === code)
    ) {
      showError(t('货币代码已存在'));
      return;
    }

    const newList = [
      ...customCurrencies,
      { code, symbol, exchange_rate: rate },
    ];
    updateCustomCurrencies(newList);
    setShowAddCurrencyModal(false);
    setNewCurrency({ code: '', symbol: '', exchange_rate: '' });
  };

  // 删除自定义货币
  const handleDeleteCustomCurrency = (index) => {
    const currency = customCurrencies[index];
    const newList = customCurrencies.filter((_, i) => i !== index);
    updateCustomCurrencies(newList);
    // 如果当前选中的正是被删除的货币，切换到 USD
    if (inputs['general_setting.quota_display_type'] === currency.code) {
      setInputs((prev) => ({
        ...prev,
        'general_setting.quota_display_type': 'USD',
      }));
    }
    // 同时从启用列表中移除
    const currentEnabled = [...enabledCurrencies];
    const enabledIdx = currentEnabled.indexOf(currency.code);
    if (enabledIdx >= 0) {
      currentEnabled.splice(enabledIdx, 1);
      // 确保至少保留一个
      if (currentEnabled.length === 0) {
        currentEnabled.push('USD');
      }
      setInputs((prev) => ({
        ...prev,
        'general_setting.enabled_currencies': JSON.stringify(currentEnabled),
      }));
    }
  };

  // 更新自定义货币汇率
  const handleCustomCurrencyRateChange = (index, newRate) => {
    const newList = [...customCurrencies];
    newList[index] = {
      ...newList[index],
      exchange_rate: parseFloat(newRate) || 0,
    };
    updateCustomCurrencies(newList);
  };

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  // Upstream's improved rate/preview helpers
  const combinedRate = useMemo(() => {
    const type = inputs['general_setting.quota_display_type'];
    if (type === 'USD') return '1';
    if (type === 'CNY') return String(inputs['USDExchangeRate'] || '');
    if (type === 'TOKENS') return String(inputs['QuotaPerUnit'] || '');
    if (type === 'CUSTOM')
      return String(
        inputs['general_setting.custom_currency_exchange_rate'] || '',
      );
    return '';
  }, [inputs]);

  const showTokensOption = useMemo(() => {
    const initialType = props.options?.['general_setting.quota_display_type'];
    const initialQuotaPerUnit = parseFloat(props.options?.QuotaPerUnit);
    const legacyTokensMode =
      initialType === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined &&
      !props.options.DisplayInCurrencyEnabled;
    return (
      initialType === 'TOKENS' ||
      legacyTokensMode ||
      (!isNaN(initialQuotaPerUnit) && initialQuotaPerUnit !== 500000)
    );
  }, [props.options]);

  const quotaDisplayType = inputs['general_setting.quota_display_type'];

  const previewText = useMemo(() => {
    if (quotaDisplayType === 'USD') return '$1.00';
    const rate = parseFloat(combinedRate);
    if (!rate || isNaN(rate)) return t('请输入汇率');
    if (quotaDisplayType === 'CNY') return `$1.00 → ¥${rate.toFixed(2)}`;
    if (quotaDisplayType === 'TOKENS')
      return `$1.00 → ${Number(rate).toLocaleString()} Tokens`;
    if (quotaDisplayType === 'CUSTOM') {
      const symbol = inputs['general_setting.custom_currency_symbol'] || '¤';
      return `$1.00 → ${symbol}${rate.toFixed(2)}`;
    }
    return '';
  }, [quotaDisplayType, combinedRate, inputs, t]);

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    // 若旧字段存在且新字段缺失，则做一次兜底映射
    if (
      currentInputs['general_setting.quota_display_type'] === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined
    ) {
      currentInputs['general_setting.quota_display_type'] = props.options
        .DisplayInCurrencyEnabled
        ? 'USD'
        : 'TOKENS';
    }
    // 回填自定义货币相关字段（如果后端已存在）
    if (props.options['general_setting.custom_currency_symbol'] !== undefined) {
      currentInputs['general_setting.custom_currency_symbol'] =
        props.options['general_setting.custom_currency_symbol'];
    }
    if (
      props.options['general_setting.custom_currency_exchange_rate'] !==
      undefined
    ) {
      currentInputs['general_setting.custom_currency_exchange_rate'] =
        props.options['general_setting.custom_currency_exchange_rate'];
    }
    if (
      props.options['general_setting.custom_currencies'] !== undefined
    ) {
      currentInputs['general_setting.custom_currencies'] =
        props.options['general_setting.custom_currencies'];
    }
    if (
      props.options['general_setting.enabled_currencies'] !== undefined
    ) {
      currentInputs['general_setting.enabled_currencies'] =
        props.options['general_setting.enabled_currencies'];
    }
    // 将布尔类型的字符串值转为实际布尔值，确保 Switch 组件正确工作
    for (const key of Object.keys(currentInputs)) {
      if (currentInputs[key] === 'true') currentInputs[key] = true;
      else if (currentInputs[key] === 'false') currentInputs[key] = false;
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  const currencyRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  };

  const radioLabelStyle = {
    minWidth: 120,
    display: 'inline-flex',
    alignItems: 'center',
  };

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('通用设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'TopUpLink'}
                  label={t('充值链接')}
                  initValue={''}
                  placeholder={t('例如发卡网站的购买链接')}
                  onChange={handleFieldChange('TopUpLink')}
                  showClear
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'general_setting.docs_link'}
                  label={t('文档地址')}
                  initValue={''}
                  placeholder={t('例如 https://docs.newapi.pro')}
                  onChange={handleFieldChange('general_setting.docs_link')}
                  showClear
                />
              </Col>
              {/* 单位美元额度已合入汇率组合控件（TOKENS 模式下编辑），不再单独展示 */}
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'RetryTimes'}
                  label={t('失败重试次数')}
                  initValue={''}
                  placeholder={t('失败重试次数')}
                  onChange={handleFieldChange('RetryTimes')}
                  showClear
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={24} md={16} lg={16} xl={16}>
                <Form.Slot label={t('站点额度展示类型及汇率')}>
                  <Typography.Text type="tertiary" size="small" style={{ marginBottom: 8, display: 'block' }}>
                    {t('启用的货币（用户可从中选择偏好）')}
                  </Typography.Text>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {/* USD */}
                    <div style={currencyRowStyle}>
                      <Checkbox
                        checked={enabledCurrencies.includes('USD')}
                        onChange={() => handleCurrencyToggle('USD')}
                        style={radioLabelStyle}
                      >
                        USD ($)
                      </Checkbox>
                      <Input
                        prefix='1 USD ='
                        value='1'
                        disabled
                        style={{ width: 200 }}
                      />
                    </div>
                    {/* CNY */}
                    <div style={currencyRowStyle}>
                      <Checkbox
                        checked={enabledCurrencies.includes('CNY')}
                        onChange={() => handleCurrencyToggle('CNY')}
                        style={radioLabelStyle}
                      >
                        CNY (¥)
                      </Checkbox>
                      <Input
                        prefix='1 USD ='
                        value={String(inputs['USDExchangeRate'] || '')}
                        onChange={(val) =>
                          handleFieldChange('USDExchangeRate')(val)
                        }
                        style={{ width: 200 }}
                      />
                    </div>
                    {/* Tokens */}
                    <div style={currencyRowStyle}>
                      <Checkbox
                        checked={enabledCurrencies.includes('TOKENS')}
                        onChange={() => handleCurrencyToggle('TOKENS')}
                        style={radioLabelStyle}
                      >
                        Tokens
                      </Checkbox>
                      <Input
                        prefix='1 USD ='
                        value={String(inputs['QuotaPerUnit'] || '')}
                        onChange={(val) =>
                          handleFieldChange('QuotaPerUnit')(val)
                        }
                        style={{ width: 200 }}
                      />
                    </div>
                    {/* 旧版 CUSTOM — 仅在当前选中时展示 */}
                    {(inputs['general_setting.quota_display_type'] ===
                      'CUSTOM' || enabledCurrencies.includes('CUSTOM')) && (
                      <div style={currencyRowStyle}>
                        <Checkbox
                          checked={enabledCurrencies.includes('CUSTOM')}
                          onChange={() => handleCurrencyToggle('CUSTOM')}
                          style={radioLabelStyle}
                        >
                          {t('自定义')} (
                          {inputs[
                            'general_setting.custom_currency_symbol'
                          ] || '¤'}
                          )
                        </Checkbox>
                        <Input
                          prefix='1 USD ='
                          value={String(
                            inputs[
                              'general_setting.custom_currency_exchange_rate'
                            ] || '',
                          )}
                          onChange={(val) =>
                            handleFieldChange(
                              'general_setting.custom_currency_exchange_rate',
                            )(val)
                          }
                          style={{ width: 200 }}
                        />
                        <Input
                          prefix={t('符号')}
                          value={String(
                            inputs[
                              'general_setting.custom_currency_symbol'
                            ] || '',
                          )}
                          onChange={(val) =>
                            handleFieldChange(
                              'general_setting.custom_currency_symbol',
                            )(val)
                          }
                          style={{ width: 120 }}
                        />
                      </div>
                    )}
                    {/* 自定义货币列表 */}
                    {customCurrencies.map((currency, index) => (
                      <div key={currency.code} style={currencyRowStyle}>
                        <Checkbox
                          checked={enabledCurrencies.includes(currency.code)}
                          onChange={() => handleCurrencyToggle(currency.code)}
                          style={radioLabelStyle}
                        >
                          {currency.code} ({currency.symbol})
                        </Checkbox>
                        <Input
                          prefix='1 USD ='
                          value={String(currency.exchange_rate || '')}
                          onChange={(val) =>
                            handleCustomCurrencyRateChange(index, val)
                          }
                          style={{ width: 200 }}
                        />
                        <Button
                          type='danger'
                          theme='light'
                          size='small'
                          onClick={() => handleDeleteCustomCurrency(index)}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    ))}
                    {/* 新增按钮 */}
                    <div style={{ paddingTop: 4 }}>
                      <Button
                        theme='light'
                        size='small'
                        onClick={() => setShowAddCurrencyModal(true)}
                      >
                        + {t('新增自定义货币')}
                      </Button>
                    </div>
                  </div>
                  <Text type='tertiary' size='small' style={{ marginTop: 8, display: 'block' }}>
                    {t('预览效果')}：{previewText}
                  </Text>
                </Form.Slot>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Slot label={t('默认货币（未登录用户）')}>
                  <Select
                    value={inputs['general_setting.quota_display_type']}
                    onChange={(val) =>
                      handleFieldChange('general_setting.quota_display_type')(val)
                    }
                    style={{ width: 200 }}
                    optionList={allCurrencyOptions
                      .filter((opt) => enabledCurrencies.includes(opt.code))
                      .map((opt) => ({
                        value: opt.code,
                        label: opt.label,
                      }))}
                  />
                </Form.Slot>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'DisplayTokenStatEnabled'}
                  label={t('额度查询接口返回令牌额度而非用户额度')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('DisplayTokenStatEnabled')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'DefaultCollapseSidebar'}
                  label={t('默认折叠侧边栏')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('DefaultCollapseSidebar')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'DemoSiteEnabled'}
                  label={t('演示站点模式')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('DemoSiteEnabled')}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'SelfUseModeEnabled'}
                  label={t('自用模式')}
                  extraText={t('开启后不限制：必须设置模型倍率')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('SelfUseModeEnabled')}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'general_setting.redemption_enabled'}
                  label={t('兑换码兑换')}
                  extraText={t('关闭后用户将无法使用兑换码')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange('general_setting.redemption_enabled')}
                />
              </Col>
              {inputs['general_setting.redemption_enabled'] && (
                <Col xs={24} sm={12} md={16} lg={16} xl={16}>
                  <Form.Slot label={t('兑换码允许的分组')}>
                    <Typography.Text type="tertiary" size="small" style={{ marginBottom: 4, display: 'block' }}>
                      {t('留空表示所有分组可见，输入分组名后回车添加')}
                    </Typography.Text>
                    <TagInput
                      value={redemptionAllowedGroups}
                      placeholder={t('输入分组名后回车')}
                      onChange={(val) => {
                        setInputs((prev) => ({
                          ...prev,
                          'general_setting.redemption_allowed_groups': JSON.stringify(val),
                        }));
                      }}
                      style={{ width: '100%' }}
                    />
                  </Form.Slot>
                </Col>
              )}
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('用户最大令牌数量')}
                  field={'token_setting.max_user_tokens'}
                  step={1}
                  min={1}
                  extraText={t('每个用户最多可创建的令牌数量，默认 1000，设置过大可能会影响性能')}
                  placeholder={'1000'}
                  onChange={handleFieldChange('token_setting.max_user_tokens')}
                />
              </Col>
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存通用设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>

      <Modal
        title={t('警告')}
        visible={showQuotaWarning}
        onOk={() => setShowQuotaWarning(false)}
        onCancel={() => setShowQuotaWarning(false)}
        closeOnEsc={true}
        width={500}
      >
        <Banner
          type='warning'
          description={t(
            '此设置用于系统内部计算，默认值500000是为了精确到6位小数点设计，不推荐修改。',
          )}
          bordered
          fullMode={false}
          closeIcon={null}
        />
      </Modal>

      <Modal
        title={t('新增自定义货币')}
        visible={showAddCurrencyModal}
        onOk={handleAddCurrency}
        onCancel={() => {
          setShowAddCurrencyModal(false);
          setNewCurrency({ code: '', symbol: '', exchange_rate: '' });
        }}
        closeOnEsc={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Typography.Text strong>
              {t('货币代码')}
            </Typography.Text>
            <Input
              placeholder={t('例如 EUR, GBP, JPY...')}
              value={newCurrency.code}
              onChange={(val) =>
                setNewCurrency((prev) => ({ ...prev, code: val }))
              }
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Typography.Text strong>
              {t('货币符号')}
            </Typography.Text>
            <Input
              placeholder={t('例如 €, £, ¥...')}
              value={newCurrency.symbol}
              onChange={(val) =>
                setNewCurrency((prev) => ({ ...prev, symbol: val }))
              }
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Typography.Text strong>
              {t('汇率')} (1 USD = ?)
            </Typography.Text>
            <Input
              placeholder={t('例如 0.92')}
              value={newCurrency.exchange_rate}
              onChange={(val) =>
                setNewCurrency((prev) => ({ ...prev, exchange_rate: val }))
              }
              style={{ marginTop: 4 }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
