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
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsSeedanceOfficialAsset(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'seedance_asset_official.enabled': false,
    'seedance_asset_official.gateway_channel_id': 0,
    'seedance_asset_official.refresh_on_get': true,
    'seedance_asset_official.default_callback_url': '',
    'seedance_asset_official.platform': 'cn',
    'seedance_asset_official.project_name': 'default',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      return API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
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
    const currentInputs = {
      'seedance_asset_official.enabled': false,
      'seedance_asset_official.gateway_channel_id': 0,
      'seedance_asset_official.refresh_on_get': true,
      'seedance_asset_official.default_callback_url': '',
      'seedance_asset_official.platform': 'cn',
      'seedance_asset_official.project_name': 'default',
    };
    for (let key in props.options) {
      if (Object.keys(currentInputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    if (
      typeof currentInputs['seedance_asset_official.gateway_channel_id'] ===
      'string'
    ) {
      currentInputs['seedance_asset_official.gateway_channel_id'] =
        parseInt(
          currentInputs['seedance_asset_official.gateway_channel_id'],
          10
        ) || 0;
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('Seedance 官方素材网关')}>
            <Typography.Text
              type='tertiary'
              style={{ marginBottom: 16, display: 'block' }}
            >
              {t(
                '将 /api/seedance/official 直连火山方舟私域素材库（控制台 AK|SK），与 83zi 网关并行'
              )}
            </Typography.Text>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'seedance_asset_official.enabled'}
                  label={t('启用 Seedance 官方素材 API')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'seedance_asset_official.enabled'
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'seedance_asset_official.refresh_on_get'}
                  label={t('GET 时回源刷新官方素材状态')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'seedance_asset_official.refresh_on_get'
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Select
                  field={'seedance_asset_official.platform'}
                  label={t('官方素材平台')}
                  optionList={[
                    {
                      label: t('国内火山（cn-beijing）'),
                      value: 'cn',
                    },
                    {
                      label: t('海外 BytePlus（ap-southeast-1）'),
                      value: 'overseas',
                    },
                  ]}
                  onChange={handleFieldChange(
                    'seedance_asset_official.platform'
                  )}
                  extraText={t(
                    '国内与海外可切换，互不替换；渠道 Key 仍填 AK|SK'
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'seedance_asset_official.gateway_channel_id'}
                  label={t('官方网关渠道 ID')}
                  min={0}
                  onChange={handleFieldChange(
                    'seedance_asset_official.gateway_channel_id'
                  )}
                  extraText={t(
                    '渠道 Key 填 AK|SK 或 AK|SK|Region；Base URL 可空（按所选平台使用默认 Host）'
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Input
                  field={'seedance_asset_official.project_name'}
                  label={t('官方素材项目名 ProjectName')}
                  onChange={handleFieldChange(
                    'seedance_asset_official.project_name'
                  )}
                  extraText={t(
                    '对应 BytePlus/火山控制台项目名，例如 project_zzz；默认 default'
                  )}
                />
              </Col>
              <Col xs={24} sm={24} md={16} lg={16} xl={16}>
                <Form.Input
                  field={'seedance_asset_official.default_callback_url'}
                  label={t('默认真人认证 CallbackURL')}
                  onChange={handleFieldChange(
                    'seedance_asset_official.default_callback_url'
                  )}
                  extraText={t(
                    '创建真人会话时若请求未传 callback_url，则使用此默认值'
                  )}
                />
              </Col>
            </Row>
            <Button onClick={onSubmit}>
              {t('保存 Seedance 官方素材设置')}
            </Button>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
