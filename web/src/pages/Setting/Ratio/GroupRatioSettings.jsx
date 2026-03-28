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
import { Button, Col, Form, Row, Spin, Typography, TextArea } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import GroupManagement from '../../../components/table/groups/GroupManagement';

const { Text } = Typography;

export default function GroupRatioSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    GroupRatio: '',
    UserUsableGroups: '',
    GroupGroupRatio: '',
    'group_ratio_setting.group_special_usable_group': '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  const groupRatio = useMemo(() => {
    try {
      return inputs.GroupRatio ? JSON.parse(inputs.GroupRatio) : {};
    } catch {
      return {};
    }
  }, [inputs.GroupRatio]);

  const userUsableGroups = useMemo(() => {
    try {
      return inputs.UserUsableGroups ? JSON.parse(inputs.UserUsableGroups) : {};
    } catch {
      return {};
    }
  }, [inputs.UserUsableGroups]);

  async function onSubmit() {
    try {
      await refForm.current
        .validate()
        .then(() => {
          const updateArray = compareObjects(inputs, inputsRow);
          if (!updateArray.length)
            return showWarning(t('你似乎并没有修改什么'));

          const requestQueue = updateArray.map((item) => {
            const value =
              typeof inputs[item.key] === 'boolean'
                ? String(inputs[item.key])
                : inputs[item.key];
            return API.put('/api/option/', { key: item.key, value });
          });

          setLoading(true);
          Promise.all(requestQueue)
            .then((res) => {
              if (res.includes(undefined)) {
                return showError(
                  requestQueue.length > 1
                    ? t('部分保存失败，请重试')
                    : t('保存失败'),
                );
              }

              for (let i = 0; i < res.length; i++) {
                if (!res[i].data.success) {
                  return showError(res[i].data.message);
                }
              }

              showSuccess(t('保存成功'));
              props.refresh();
            })
            .catch((error) => {
              console.error('Unexpected error:', error);
              showError(t('保存失败，请重试'));
            })
            .finally(() => {
              setLoading(false);
            });
        })
        .catch(() => {
          showError(t('请检查输入'));
        });
    } catch (error) {
      showError(t('请检查输入'));
      console.error(error);
    }
  }

  const handleGroupManagementSave = async (data) => {
    const updateArray = [];
    if (data.GroupRatio !== inputsRow.GroupRatio) {
      updateArray.push({ key: 'GroupRatio', value: data.GroupRatio });
    }
    if (data.UserUsableGroups !== inputsRow.UserUsableGroups) {
      updateArray.push({ key: 'UserUsableGroups', value: data.UserUsableGroups });
    }

    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }

    setLoading(true);
    try {
      const requestQueue = updateArray.map((item) =>
        API.put('/api/option/', { key: item.key, value: item.value })
      );

      const res = await Promise.all(requestQueue);

      if (res.includes(undefined)) {
        showError(t('保存失败，请重试'));
        return;
      }

      for (let i = 0; i < res.length; i++) {
        if (!res[i].data.success) {
          showError(res[i].data.message);
          return;
        }
      }

      showSuccess(t('保存成功'));
      
      setInputs((prev) => ({
        ...prev,
        GroupRatio: data.GroupRatio,
        UserUsableGroups: data.UserUsableGroups,
      }));
      setInputsRow((prev) => ({
        ...prev,
        GroupRatio: data.GroupRatio,
        UserUsableGroups: data.UserUsableGroups,
      }));
      
      props.refresh();
    } catch (error) {
      console.error('Unexpected error:', error);
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

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
    <Spin spinning={loading}>
      <GroupManagement
        groupRatio={groupRatio}
        userUsableGroups={userUsableGroups}
        loading={loading}
        onSave={handleGroupManagementSave}
        refresh={props.refresh}
      />

      <div style={{ marginBottom: 16, marginTop: 16 }}>
        <Text type="tertiary" size="small">
          {t('当前配置 JSON（只读，请通过上方表格修改）')}
        </Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" size="small">{t('分组倍率 JSON')}</Text>
            </div>
            <TextArea
              value={inputs.GroupRatio}
              autosize={{ minRows: 4, maxRows: 8 }}
              disabled
              style={{ fontFamily: 'monospace' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" size="small">{t('用户可选分组 JSON')}</Text>
            </div>
            <TextArea
              value={inputs.UserUsableGroups}
              autosize={{ minRows: 4, maxRows: 8 }}
              disabled
              style={{ fontFamily: 'monospace' }}
            />
          </Col>
        </Row>
      </div>

      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15, marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('分组特殊倍率')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为分组名称，值为另一个 JSON 对象，键为分组名称，值为该分组的用户的特殊分组倍率，例如：{"vip": {"default": 0.5, "test": 1}}，表示 vip 分组的用户在使用default分组的令牌时倍率为0.5，使用test分组时倍率为1',
              )}
              field={'GroupGroupRatio'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs({ ...inputs, GroupGroupRatio: value })
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('分组特殊可用分组')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为用户分组名称，值为操作映射对象。内层键以"+:"开头表示添加指定分组（键值为分组名称，值为描述），以"-:"开头表示移除指定分组（键值为分组名称），不带前缀的键直接添加该分组。例如：{"vip": {"+:premium": "高级分组", "special": "特殊分组", "-:default": "默认分组"}}，表示 vip 分组的用户可以使用 premium 和 special 分组，同时移除 default 分组的访问权限',
              )}
              field={'group_ratio_setting.group_special_usable_group'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs({
                  ...inputs,
                  'group_ratio_setting.group_special_usable_group': value,
                })
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('自动分组auto，从第一个开始选择')}
              placeholder={t('为一个 JSON 文本')}
              field={'AutoGroups'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => {
                    if (!value || value.trim() === '') {
                      return true;
                    }

                    try {
                      const parsed = JSON.parse(value);

                      if (!Array.isArray(parsed)) {
                        return false;
                      }

                      return parsed.every((item) => typeof item === 'string');
                    } catch (error) {
                      return false;
                    }
                  },
                  message: t('必须是有效的 JSON 字符串数组，例如：["g1","g2"]'),
                },
              ]}
              onChange={(value) => setInputs({ ...inputs, AutoGroups: value })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Switch
              label={t(
                '创建令牌默认选择auto分组，初始令牌也将设为auto（否则留空，为用户默认分组）',
              )}
              field={'DefaultUseAutoGroup'}
              onChange={(value) =>
                setInputs({ ...inputs, DefaultUseAutoGroup: value })
              }
            />
          </Col>
        </Row>
      </Form>
      <Button onClick={onSubmit}>{t('保存分组相关设置')}</Button>
    </Spin>
  );
}
