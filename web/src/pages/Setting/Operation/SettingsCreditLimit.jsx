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
import { Button, Col, Form, Row, Spin, Popconfirm } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

const SYNC_SERVICE_URL = '/api/sync';

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    QuotaForNewUser: '',
    PreConsumedQuota: '',
    QuotaForInviter: '',
    QuotaForInvitee: '',
    'quota_setting.enable_free_model_pre_consume': true,
    'oidc_quota_reset.enabled': false,
    'oidc_quota_reset.amount': 500000,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const [resetting, setResetting] = useState(false);

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

  async function handleManualReset() {
    setResetting(true);
    try {
      const response = await fetch(`${SYNC_SERVICE_URL}/reset-oidc-quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        showSuccess(t('重置成功，已重置 {{count}} 个用户的额度为 {{quota}}', {
          count: data.affected,
          quota: data.quota,
        }));
      } else {
        showError(data.message || t('重置失败'));
      }
    } catch (error) {
      showError(t('重置失败：') + error.message);
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    const defaultInputs = {
      QuotaForNewUser: '',
      PreConsumedQuota: '',
      QuotaForInviter: '',
      QuotaForInvitee: '',
      'quota_setting.enable_free_model_pre_consume': true,
      'oidc_quota_reset.enabled': false,
      'oidc_quota_reset.amount': 500000,
    };
    const currentInputs = { ...defaultInputs };
    for (let key in props.options) {
      if (Object.keys(defaultInputs).includes(key)) {
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

          <Form.Section text={t('OIDC 用户月度额度重置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  label={t('启用月度自动重置')}
                  field={'oidc_quota_reset.enabled'}
                  extraText={t('每月 1 日自动重置所有 OIDC 用户额度')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'oidc_quota_reset.enabled': value,
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('重置额度')}
                  field={'oidc_quota_reset.amount'}
                  step={10000}
                  min={0}
                  suffix={'Token'}
                  extraText={t('每次重置时设置的额度值')}
                  placeholder={'500000'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'oidc_quota_reset.amount': String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col>
                <Button size='default' onClick={onSubmit}>
                  {t('保存设置')}
                </Button>
              </Col>
              <Col>
                <Popconfirm
                  title={t('确认重置')}
                  content={t('确定要立即重置所有 OIDC 用户的额度吗？')}
                  onConfirm={handleManualReset}
                >
                  <Button
                    size='default'
                    type='warning'
                    loading={resetting}
                  >
                    {t('立即重置所有 OIDC 用户额度')}
                  </Button>
                </Popconfirm>
              </Col>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
