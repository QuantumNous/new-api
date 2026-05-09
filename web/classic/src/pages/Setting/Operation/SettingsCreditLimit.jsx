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
import { Button, Col, Form, Row, Spin, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import InvitationRebateRecordsModal from './InvitationRebateRecordsModal';

const { Text } = Typography;

const defaultInputs = {
  QuotaForNewUser: '',
  PreConsumedQuota: '',
  QuotaForInviter: '',
  QuotaForInvitee: '',
  'quota_setting.enable_free_model_pre_consume': true,
  InvitationRebateEnabled: false,
  InvitationRebateRatioPercent: '',
  InvitationRebateMinQuota: '',
};

function formatPercent(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }
  const clampedValue = Math.min(100, Math.max(0, numericValue));
  return String(Number(clampedValue.toFixed(2)));
}

function ratioBpsToPercent(value) {
  return formatPercent(Number(value || 0) / 100);
}

function percentToRatioBps(value) {
  return String(Math.round(Number(formatPercent(value)) * 100));
}

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showRebateRecords, setShowRebateRecords] = useState(false);
  const [inputs, setInputs] = useState(defaultInputs);
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else if (item.key === 'InvitationRebateRatioPercent') {
        value = percentToRatioBps(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key:
          item.key === 'InvitationRebateRatioPercent'
            ? 'InvitationRebateRatioBps'
            : item.key,
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
    const currentInputs = { ...defaultInputs };
    for (let key in props.options) {
      if (Object.keys(defaultInputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    currentInputs.InvitationRebateEnabled =
      props.options.InvitationRebateEnabled ?? false;
    currentInputs.InvitationRebateRatioPercent = ratioBpsToPercent(
      props.options.InvitationRebateRatioBps,
    );
    currentInputs.InvitationRebateMinQuota =
      props.options.InvitationRebateMinQuota ?? '';
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

            <div style={{ margin: '12px 0' }}>
              <Text strong>{t('邀请消费返利')}</Text>
              <div>
                <Text type='tertiary'>
                  {t('返利基于被邀请用户的实际消费额度，不基于充值。')}
                </Text>
              </div>
            </div>

            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  label={t('启用邀请消费返利')}
                  field={'InvitationRebateEnabled'}
                  extraText={t(
                    '开启后，同步消费成功结算后会按比例给邀请人返利。',
                  )}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      InvitationRebateEnabled: value,
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('返利百分比')}
                  field={'InvitationRebateRatioPercent'}
                  step={0.01}
                  min={0}
                  max={100}
                  suffix={'%'}
                  extraText={t(
                    '输入 10 表示 10%。保存时会兼容写入后端 bps 配置。',
                  )}
                  placeholder={t('例如：10')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      InvitationRebateRatioPercent:
                        value === null || value === undefined
                          ? ''
                          : String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('最小触发消费额度')}
                  field={'InvitationRebateMinQuota'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={t('仅当实际消费额度达到该值时才发放返利。')}
                  placeholder={t('例如：1000')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      InvitationRebateMinQuota:
                        value === null || value === undefined
                          ? ''
                          : String(value),
                    })
                  }
                />
              </Col>
            </Row>

            <Row>
              <Button
                theme='outline'
                onClick={() => setShowRebateRecords(true)}
              >
                {t('查看邀请返利流水')}
              </Button>
            </Row>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存额度设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
      <InvitationRebateRecordsModal
        visible={showRebateRecords}
        onCancel={() => setShowRebateRecords(false)}
      />
    </>
  );
}
