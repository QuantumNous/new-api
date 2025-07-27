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
  Form,
  Space,
  Spin,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsChats(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    Chats: '[]',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  async function onSubmit() {
    try {
      console.log('Starting validation...');
      await refForm.current
        .validate()
        .then(() => {
          console.log('Validation passed');
          const updateArray = compareObjects(inputs, inputsRow);
          if (!updateArray.length)
            return showWarning(t('你似乎并没有修改什么'));
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
        })
        .catch((error) => {
          console.error('Validation failed:', error);
          showError(t('请检查输入'));
        });
    } catch (error) {
      showError(t('请检查输入'));
      console.error(error);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        if (key === 'Chats') {
          const obj = JSON.parse(props.options[key]);
          currentInputs[key] = JSON.stringify(obj, null, 2);
        } else {
          currentInputs[key] = props.options[key];
        }
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('聊天设置')}>
          <Banner
            type='info'
            description={t(
              '链接中的{key}将自动替换为sk-xxxx，{address}将自动替换为系统设置的服务器地址，末尾不带/和/v1',
            )}
          />
          <Form.TextArea
            label={t('聊天配置')}
            extraText={''}
            placeholder={t('为一个 JSON 文本')}
            field={'Chats'}
            autosize={{ minRows: 6, maxRows: 12 }}
            trigger='blur'
            stopValidateWithError
            rules={[
              {
                validator: (rule, value) => {
                  return verifyJSON(value);
                },
                message: t('不是合法的 JSON 字符串'),
              },
            ]}
            onChange={(value) =>
              setInputs({
                ...inputs,
                Chats: value,
              })
            }
          />
        </Form.Section>
      </Form>
      <Space>
        <Button onClick={onSubmit}>{t('保存聊天设置')}</Button>
      </Space>
    </Spin>
  );
}
