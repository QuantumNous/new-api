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
import { Button, Col, Form, Row, Spin, Select } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [quotaUnit, setQuotaUnit] = useState('Token'); // Token, USD, CNY, CUSTOM
  const [inputs, setInputs] = useState({
    QuotaForNewUser: '',
    PreConsumedQuota: '',
    QuotaForInviter: '',
    QuotaForInvitee: '',
    'quota_setting.enable_free_model_pre_consume': true,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  // 获取汇率配置
  const quotaPerUnit = useMemo(() => {
    return parseFloat(props.options?.QuotaPerUnit) || 500000;
  }, [props.options]);

  const usdExchangeRate = useMemo(() => {
    return parseFloat(props.options?.USDExchangeRate) || 7;
  }, [props.options]);

  const customExchangeRate = useMemo(() => {
    return parseFloat(props.options?.['general_setting.custom_currency_exchange_rate']) || 1;
  }, [props.options]);

  const customCurrencySymbol = useMemo(() => {
    return props.options?.['general_setting.custom_currency_symbol'] || '¤';
  }, [props.options]);

  // Token 转换为显示单位
  const tokenToDisplay = (tokenValue) => {
    if (!tokenValue && tokenValue !== 0) return '';
    const tokens = parseFloat(tokenValue);
    if (isNaN(tokens)) return '';

    switch (quotaUnit) {
      case 'USD':
        return (tokens / quotaPerUnit).toFixed(6);
      case 'CNY':
        return ((tokens / quotaPerUnit) * usdExchangeRate).toFixed(6);
      case 'CUSTOM':
        return ((tokens / quotaPerUnit) * customExchangeRate).toFixed(6);
      default: // Token
        return String(tokens);
    }
  };

  // 显示单位转换为 Token
  const displayToToken = (displayValue) => {
    if (!displayValue && displayValue !== 0) return '';
    const value = parseFloat(displayValue);
    if (isNaN(value)) return '';

    switch (quotaUnit) {
      case 'USD':
        return String(Math.round(value * quotaPerUnit));
      case 'CNY':
        return String(Math.round((value / usdExchangeRate) * quotaPerUnit));
      case 'CUSTOM':
        return String(Math.round((value / customExchangeRate) * quotaPerUnit));
      default: // Token
        return String(value);
    }
  };

  // 获取当前单位后缀
  const getUnitSuffix = () => {
    switch (quotaUnit) {
      case 'USD':
        return 'USD';
      case 'CNY':
        return 'CNY';
      case 'CUSTOM':
        return customCurrencySymbol;
      default:
        return 'Token';
    }
  };

  // 用于显示的值（根据单位转换）
  const displayInputs = useMemo(() => {
    return {
      QuotaForNewUser: tokenToDisplay(inputs.QuotaForNewUser),
      PreConsumedQuota: tokenToDisplay(inputs.PreConsumedQuota),
      QuotaForInviter: tokenToDisplay(inputs.QuotaForInviter),
      QuotaForInvitee: tokenToDisplay(inputs.QuotaForInvitee),
      'quota_setting.enable_free_model_pre_consume': inputs['quota_setting.enable_free_model_pre_consume'],
    };
  }, [inputs, quotaUnit, quotaPerUnit, usdExchangeRate, customExchangeRate]);

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

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);
  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={displayInputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('额度设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Slot label={t('额度单位')}>
                  <Select
                    value={quotaUnit}
                    onChange={setQuotaUnit}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value='Token'>Token</Select.Option>
                    <Select.Option value='USD'>USD ($)</Select.Option>
                    <Select.Option value='CNY'>CNY (¥)</Select.Option>
                    <Select.Option value='CUSTOM'>
                      {t('自定义')} ({customCurrencySymbol})
                    </Select.Option>
                  </Select>
                </Form.Slot>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('新用户初始额度')}
                  field={'QuotaForNewUser'}
                  step={quotaUnit === 'Token' ? 1 : 0.000001}
                  suffix={getUnitSuffix()}
                  extraText={t('支持负数以防止滥用注册')}
                  placeholder={''}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForNewUser: displayToToken(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('请求预扣费额度')}
                  field={'PreConsumedQuota'}
                  step={quotaUnit === 'Token' ? 1 : 0.000001}
                  min={0}
                  suffix={getUnitSuffix()}
                  extraText={t('请求结束后多退少补')}
                  placeholder={''}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      PreConsumedQuota: displayToToken(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('邀请新用户奖励额度')}
                  field={'QuotaForInviter'}
                  step={quotaUnit === 'Token' ? 1 : 0.000001}
                  suffix={getUnitSuffix()}
                  extraText={t('支持负数以防止滥用邀请')}
                  placeholder={t('例如：2000 或 -500')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInviter: displayToToken(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={6}>
                <Form.InputNumber
                  label={t('新用户使用邀请码奖励额度')}
                  field={'QuotaForInvitee'}
                  step={quotaUnit === 'Token' ? 1 : 0.000001}
                  suffix={getUnitSuffix()}
                  extraText={t('支持负数以防止滥用邀请')}
                  placeholder={t('例如：1000 或 -200')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInvitee: displayToToken(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Switch
                  label={t('对免费模型启用预消耗')}
                  field={'quota_setting.enable_free_model_pre_consume'}
                  extraText={t('开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'quota_setting.enable_free_model_pre_consume': value,
                    })
                  }
                />
              </Col>
            </Row>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存额度设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
