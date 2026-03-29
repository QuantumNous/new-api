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
  const [inputs, setInputs] = useState({
    QuotaForNewUser: '',
    PreConsumedQuota: '',
    QuotaForInviter: '',
    QuotaForInvitee: '',
    InviterRewardType: '',
    InviterRewardValue: '',
    'quota_setting.enable_free_model_pre_consume': true,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    // 邀请充值返利的 Type 和 Value 必须一起提交，确保原子性
    const rewardTypeChanged = updateArray.some(
      (item) => item.key === 'InviterRewardType',
    );
    const rewardValueChanged = updateArray.some(
      (item) => item.key === 'InviterRewardValue',
    );
    if (rewardTypeChanged && !rewardValueChanged) {
      // Type 变了但 Value 没变，也要带上 Value 一起提交
      updateArray.push({ key: 'InviterRewardValue', value: inputs.InviterRewardValue });
    } else if (rewardValueChanged && !rewardTypeChanged) {
      // Value 变了但 Type 没变，也要带上 Type 一起提交（放在最前面确保 Type 先保存）
      updateArray.unshift({ key: 'InviterRewardType', value: inputs.InviterRewardType });
    }

    // 验证邀请充值返利值的范围
    if (rewardTypeChanged || rewardValueChanged) {
      const rewardValue = parseInt(inputs.InviterRewardValue);
      if (inputs.InviterRewardType && isNaN(rewardValue)) {
        showError(t('充值返利值必须是有效的数字'));
        return;
      }
      if (inputs.InviterRewardType === 'percentage') {
        if (rewardValue < 0 || rewardValue > 100) {
          showError(t('当充值返利类型为百分比时，返利值应在0-100之间'));
          return;
        }
      } else if (inputs.InviterRewardType === 'fixed') {
        if (rewardValue < 0) {
          showError(t('当充值返利类型为固定时，返利值应大于等于0'));
          return;
        }
      }
    }

    // 确保 InviterRewardType 在 InviterRewardValue 之前提交（后端依赖顺序做交叉校验）
    updateArray.sort((a, b) => {
      if (a.key === 'InviterRewardType' && b.key === 'InviterRewardValue') return -1;
      if (a.key === 'InviterRewardValue' && b.key === 'InviterRewardType') return 1;
      return 0;
    });

    // 使用串行提交确保 Type 在 Value 之前保存
    async function submitSequentially() {
      for (const item of updateArray) {
        let value = '';
        if (typeof inputs[item.key] === 'boolean') {
          value = String(inputs[item.key]);
        } else {
          value = inputs[item.key];
        }
        const res = await API.put('/api/option/', {
          key: item.key,
          value,
        });
        if (!res || !res.success) {
          showError(res?.message || t('部分保存失败，请重试'));
          return;
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
    }

    setLoading(true);
    submitSequentially()
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
                  extraText={''}
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
                  extraText={''}
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
          </Form.Section>

          <Form.Section text={t('邀请充值返利')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  label={t('充值返利类型')}
                  field={'InviterRewardType'}
                  extraText={t(
                    '设置被邀请人充值时，邀请人获得返利的类型。留空表示关闭返利功能',
                  )}
                  placeholder={t('关闭（不启用返利）')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      InviterRewardType: value || '',
                    })
                  }
                  showClear
                >
                  <Select.Option value='fixed'>{t('固定额度')}</Select.Option>
                  <Select.Option value='percentage'>
                    {t('按充值比例')}
                  </Select.Option>
                </Form.Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={
                    t('充值返利值') +
                    (inputs.InviterRewardType === 'percentage' ? ' (%)' : '')
                  }
                  field={'InviterRewardValue'}
                  step={1}
                  min={0}
                  max={
                    inputs.InviterRewardType === 'percentage' ? 100 : undefined
                  }
                  suffix={
                    inputs.InviterRewardType === 'percentage'
                      ? '%'
                      : 'Token'
                  }
                  extraText={
                    inputs.InviterRewardType === 'percentage'
                      ? t('被邀请人每次充值时，邀请人获得充值额度的百分比作为返利')
                      : t(
                          '被邀请人每次充值时，邀请人获得的固定返利额度',
                        )
                  }
                  placeholder={
                    inputs.InviterRewardType === 'percentage'
                      ? t('例如：10（表示10%）')
                      : t('例如：2000')
                  }
                  disabled={!inputs.InviterRewardType}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      InviterRewardValue: String(value ?? ''),
                    })
                  }
                />
              </Col>
            </Row>
          </Form.Section>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存额度设置')}
              </Button>
            </Row>
        </Form>
      </Spin>
    </>
  );
}
