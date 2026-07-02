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
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
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
  const [inputs, setInputs] = useState({
    QuotaForNewUser: '',
    PreConsumedQuota: '',
    QuotaForInviter: '',
    QuotaForInvitee: '',
    'quota_setting.enable_free_model_pre_consume': true,
    'payment_setting.aff_commission_enabled': false,
    'payment_setting.aff_commission_type': 'percentage',
    'payment_setting.aff_commission_rate': 0,
    'payment_setting.aff_commission_fixed_amount': 0,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const complianceConfirmed =
    props.options?.['payment_setting.compliance_confirmed'] === true ||
    props.options?.['payment_setting.compliance_confirmed'] === 'true';

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
        {!complianceConfirmed && (
          <Banner
            type='warning'
            description={t(
              '设置非零邀请奖励额度前，需要先在支付设置中确认合规声明。',
            )}
            closeIcon={null}
            className='!rounded-lg mb-3'
          />
        )}
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('额度设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('新用户初始额度')}
                  field={'QuotaForNewUser'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  placeholder={''}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForNewUser: String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('请求预扣费额度')}
                  field={'PreConsumedQuota'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={t('请求结束后多退少补')}
                  placeholder={''}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      PreConsumedQuota: String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('邀请新用户奖励额度')}
                  field={'QuotaForInviter'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={
                    !complianceConfirmed ? t('非零值需先确认合规声明') : ''
                  }
                  placeholder={t('例如：2000')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInviter: String(value),
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
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={
                    !complianceConfirmed ? t('非零值需先确认合规声明') : ''
                  }
                  placeholder={t('例如：1000')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInvitee: String(value),
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
                  extraText={t(
                    '开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度',
                  )}
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
              <Col>
                <Form.Switch
                  label={t('下级充值佣金')}
                  field={'payment_setting.aff_commission_enabled'}
                  extraText={t('开启后，被邀请用户付款时，邀请者将按配置获得佣金')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'payment_setting.aff_commission_enabled': value,
                    })
                  }
                />
              </Col>
            </Row>

            {(inputs['payment_setting.aff_commission_enabled'] === true ||
              inputs['payment_setting.aff_commission_enabled'] === 'true') && (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.Select
                      label={t('佣金类型')}
                      field={'payment_setting.aff_commission_type'}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          'payment_setting.aff_commission_type': value,
                        })
                      }
                    >
                      <Form.Select.Option value='percentage'>{t('按百分比')}</Form.Select.Option>
                      <Form.Select.Option value='fixed'>{t('固定额度')}</Form.Select.Option>
                    </Form.Select>
                  </Col>

                  {inputs['payment_setting.aff_commission_type'] === 'percentage' ? (
                    <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                      <Form.InputNumber
                        label={t('佣金比例 (%)')}
                        field={'payment_setting.aff_commission_rate'}
                        step={0.01}
                        min={0}
                        max={100}
                        suffix={'%'}
                        extraText={t('按下级用户充值额度的百分比奖励邀请者')}
                        placeholder={'例如：10'}
                        onChange={(value) =>
                          setInputs({
                            ...inputs,
                            'payment_setting.aff_commission_rate': value,
                          })
                        }
                      />
                    </Col>
                  ) : (
                    <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                      <Form.InputNumber
                        label={t('固定佣金额度')}
                        field={'payment_setting.aff_commission_fixed_amount'}
                        step={1}
                        min={0}
                        suffix={'Token'}
                        extraText={t('每次下级用户付款后奖励邀请者的固定额度')}
                        placeholder={'例如：10000'}
                        onChange={(value) =>
                          setInputs({
                            ...inputs,
                            'payment_setting.aff_commission_fixed_amount': value,
                          })
                        }
                      />
                    </Col>
                  )}
                </Row>
              </>
            )}

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
