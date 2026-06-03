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
  Banner,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

const { Text } = Typography;

const DEFAULT_CREDIT_LIMIT_INPUTS = {
  QuotaForNewUser: '',
  PreConsumedQuota: '',
  QuotaForInviter: '',
  QuotaForInvitee: '',
  AffiliateQuotaForInvitee: '',
  AffiliateLevelOneQuotaForInvitee: '',
  AffiliateLevelTwoQuotaForInvitee: '',
  AffiliateLevelOneQuotaForInviter: '',
  AffiliateLevelTwoQuotaForInviter: '',
  'quota_setting.enable_free_model_pre_consume': true,
};

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_CREDIT_LIMIT_INPUTS);
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
    const currentInputs = { ...DEFAULT_CREDIT_LIMIT_INPUTS };
    for (let key in props.options) {
      if (Object.keys(DEFAULT_CREDIT_LIMIT_INPUTS).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  const handleInputNumberChange = (field, value) => {
    setInputs((origin) => ({
      ...origin,
      [field]: String(value),
    }));
  };

  const renderQuotaInput = ({
    field,
    label,
    extraText = '',
    min = 0,
    placeholder = '',
  }) => (
    <Col xs={24} sm={12} md={12} lg={8} xl={8}>
      <Form.InputNumber
        label={label}
        field={field}
        step={1}
        min={min}
        suffix={'Token'}
        extraText={extraText}
        placeholder={placeholder}
        onChange={(value) => handleInputNumberChange(field, value)}
      />
    </Col>
  );

  const complianceExtraText = !complianceConfirmed
    ? t('Non-zero values require compliance confirmation')
    : '';
  return (
    <>
      <Spin spinning={loading}>
        {!complianceConfirmed && (
          <Banner
            type='warning'
            description={t(
              'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.',
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
          <Form.Section text={t('Quota Settings')}>
            <Banner
              type='info'
              description={t(
                'Quota is the internal raw billing unit in new-api. User-facing amounts are converted by QuotaPerUnit and exchange rate; these fields keep the raw Token/Quota unit for precise billing compatibility.',
              )}
              closeIcon={null}
              className='!rounded-lg mb-3'
            />

            <Card className='!rounded-2xl mb-4' title={t('Base Quotas')}>
              <Row gutter={16}>
                {renderQuotaInput({
                  field: 'QuotaForNewUser',
                  label: t('New User Initial Quota'),
                })}
                {renderQuotaInput({
                  field: 'PreConsumedQuota',
                  label: t('Pre-Consumed Request Quota'),
                  extraText: t(
                    'Refund or charge the difference after request completion',
                  ),
                })}
              </Row>
            </Card>

            <Card className='!rounded-2xl mb-4' title={t('Normal Invitation')}>
              <Text type='secondary'>
                {t(
                  'Normal invite codes use separate rewards for inviter and invited new users.',
                )}
              </Text>
              <Row gutter={16} className='mt-3'>
                {renderQuotaInput({
                  field: 'QuotaForInviter',
                  label: t('Normal User Inviter Reward Quota'),
                  extraText: complianceExtraText,
                  placeholder: t('Example: 2000'),
                })}
                {renderQuotaInput({
                  field: 'QuotaForInvitee',
                  label: t('New User Normal Invite Code Reward Quota'),
                  extraText: complianceExtraText,
                  placeholder: t('Example: 1000'),
                })}
              </Row>
            </Card>

            <Card
              className='!rounded-2xl mb-4'
              title={t('Affiliate Invite Code New User Reward')}
            >
              <Text type='secondary'>
                {t(
                  'Separate by inviter affiliate level. Use -1 to inherit the compatibility fallback.',
                )}
              </Text>
              <Row gutter={16} className='mt-3'>
                {renderQuotaInput({
                  field: 'AffiliateLevelOneQuotaForInvitee',
                  label: t('Level-One Affiliate Invitee Reward Quota'),
                  min: -1,
                  extraText:
                    complianceExtraText ||
                    t('-1 uses the compatibility fallback below'),
                  placeholder: t('Example: 1000, -1 means inherit'),
                })}
                {renderQuotaInput({
                  field: 'AffiliateLevelTwoQuotaForInvitee',
                  label: t('Level-Two Affiliate Invitee Reward Quota'),
                  min: -1,
                  extraText:
                    complianceExtraText ||
                    t('-1 uses the compatibility fallback below'),
                  placeholder: t('Example: 800, -1 means inherit'),
                })}
                {renderQuotaInput({
                  field: 'AffiliateQuotaForInvitee',
                  label: t('Legacy Affiliate Invitee Reward Fallback'),
                  min: -1,
                  extraText:
                    complianceExtraText ||
                    t('-1 means inherit the normal invitee reward'),
                  placeholder: t(
                    'Example: 1000, -1 means inherit normal invitation',
                  ),
                })}
              </Row>
            </Card>

            <Card
              className='!rounded-2xl mb-4'
              title={t('Affiliate Inviter Reward')}
            >
              <Text type='secondary'>
                {t(
                  'Reward quota granted to affiliates when they invite new users. Use -1 to inherit the normal inviter reward.',
                )}
              </Text>
              <Row gutter={16} className='mt-3'>
                {renderQuotaInput({
                  field: 'AffiliateLevelOneQuotaForInviter',
                  label: t('Level-One Affiliate Inviter Reward Quota'),
                  min: -1,
                  extraText:
                    complianceExtraText ||
                    t('-1 means inherit the normal inviter reward'),
                  placeholder: t('Example: 2000, -1 means inherit'),
                })}
                {renderQuotaInput({
                  field: 'AffiliateLevelTwoQuotaForInviter',
                  label: t('Level-Two Affiliate Inviter Reward Quota'),
                  min: -1,
                  extraText:
                    complianceExtraText ||
                    t('-1 means inherit the normal inviter reward'),
                  placeholder: t('Example: 1500, -1 means inherit'),
                })}
              </Row>
            </Card>

            <Row>
              <Col>
                <Form.Switch
                  label={t('Pre-Consume for Free Models')}
                  field={'quota_setting.enable_free_model_pre_consume'}
                  extraText={t(
                    'When enabled, zero-cost models also pre-consume quota before final settlement.',
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
              <Button size='default' onClick={onSubmit}>
                {t('Save Quota Settings')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
