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
  RadioGroup,
  Radio,
  Table,
  Modal,
  Input,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSearch,
  IconSaveStroked,
} from '@douyinfe/semi-icons';
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
  const [editMode, setEditMode] = useState('visual');
  const [chatConfigs, setChatConfigs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [searchText, setSearchText] = useState('');
  const modalFormRef = useRef();

  const jsonToConfigs = (jsonString) => {
    try {
      const configs = JSON.parse(jsonString);
      return Array.isArray(configs)
        ? configs.map((config, index) => ({
            id: index,
            name: Object.keys(config)[0] || '',
            url: Object.values(config)[0] || '',
          }))
        : [];
    } catch (error) {
      console.error('JSON parse error:', error);
      return [];
    }
  };

  const configsToJson = (configs) => {
    const jsonArray = configs.map((config) => ({
      [config.name]: config.url,
    }));
    return JSON.stringify(jsonArray, null, 2);
  };

  const syncJsonToConfigs = () => {
    const configs = jsonToConfigs(inputs.Chats);
    setChatConfigs(configs);
  };

  const syncConfigsToJson = (configs) => {
    const jsonString = configsToJson(configs);
    setInputs((prev) => ({
      ...prev,
      Chats: jsonString,
    }));
    if (refForm.current && editMode === 'json') {
      refForm.current.setValues({ Chats: jsonString });
    }
  };

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
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }

    // 同步到可视化配置
    const configs = jsonToConfigs(currentInputs.Chats || '[]');
    setChatConfigs(configs);
  }, [props.options]);

  useEffect(() => {
    if (editMode === 'visual') {
      syncJsonToConfigs();
    }
  }, [inputs.Chats, editMode]);

  useEffect(() => {
    if (refForm.current && editMode === 'json') {
      refForm.current.setValues(inputs);
    }
  }, [editMode, inputs]);

  const handleAddConfig = () => {
    setEditingConfig({ name: '', url: '' });
    setIsEdit(false);
    setModalVisible(true);
    setTimeout(() => {
      if (modalFormRef.current) {
        modalFormRef.current.setValues({ name: '', url: '' });
      }
    }, 100);
  };

  const handleEditConfig = (config) => {
    setEditingConfig({ ...config });
    setIsEdit(true);
    setModalVisible(true);
    setTimeout(() => {
      if (modalFormRef.current) {
        modalFormRef.current.setValues(config);
      }
    }, 100);
  };

  const handleDeleteConfig = (id) => {
    const newConfigs = chatConfigs.filter((config) => config.id !== id);
    setChatConfigs(newConfigs);
    syncConfigsToJson(newConfigs);
    showSuccess(t('删除成功'));
  };

  const handleModalOk = () => {
    if (modalFormRef.current) {
      modalFormRef.current
        .validate()
        .then((values) => {
          // 检查名称是否重复
          const isDuplicate = chatConfigs.some(
            (config) =>
              config.name === values.name &&
              (!isEdit || config.id !== editingConfig.id),
          );

          if (isDuplicate) {
            showError(t('聊天应用名称已存在，请使用其他名称'));
            return;
          }

          if (isEdit) {
            const newConfigs = chatConfigs.map((config) =>
              config.id === editingConfig.id
                ? { ...editingConfig, name: values.name, url: values.url }
                : config,
            );
            setChatConfigs(newConfigs);
            syncConfigsToJson(newConfigs);
          } else {
            const maxId =
              chatConfigs.length > 0
                ? Math.max(...chatConfigs.map((c) => c.id))
                : -1;
            const newConfig = {
              id: maxId + 1,
              name: values.name,
              url: values.url,
            };
            const newConfigs = [...chatConfigs, newConfig];
            setChatConfigs(newConfigs);
            syncConfigsToJson(newConfigs);
          }
          setModalVisible(false);
          setEditingConfig(null);
          showSuccess(isEdit ? t('编辑成功') : t('添加成功'));
        })
        .catch((error) => {
          console.error('Modal form validation error:', error);
        });
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingConfig(null);
  };

  const filteredConfigs = chatConfigs.filter(
    (config) =>
      !searchText ||
      config.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const highlightKeywords = (text) => {
    if (!text) return text;

    const parts = text.split(/(\{address\}|\{key\})/g);
    return parts.map((part, index) => {
      if (part === '{address}') {
        return (
          <span key={index} style={{ color: '#0077cc', fontWeight: 600 }}>
            {part}
          </span>
        );
      } else if (part === '{key}') {
        return (
          <span key={index} style={{ color: '#ff6b35', fontWeight: 600 }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const columns = [
    {
      title: t('聊天应用名称'),
      dataIndex: 'name',
      key: 'name',
      render: (text) => text || t('未命名'),
    },
    {
      title: t('URL链接'),
      dataIndex: 'url',
      key: 'url',
      render: (text) => (
        <div style={{ maxWidth: 300, wordBreak: 'break-all' }}>
          {highlightKeywords(text)}
        </div>
      ),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type='primary'
            icon={<IconEdit />}
            size='small'
            onClick={() => handleEditConfig(record)}
          >
            {t('编辑')}
          </Button>
          <Button
            type='danger'
            icon={<IconDelete />}
            size='small'
            onClick={() => handleDeleteConfig(record.id)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Space vertical style={{ width: '100%' }}>
        <Form.Section text={t('聊天设置')}>
          <Banner
            type='info'
            description={t(
              '链接中的{key}将自动替换为sk-xxxx，{address}将自动替换为系统设置的服务器地址，末尾不带/和/v1',
            )}
          />

          <Divider />

          <div style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 16, fontWeight: 600 }}>
              {t('编辑模式')}:
            </span>
            <RadioGroup
              type='button'
              value={editMode}
              onChange={(e) => {
                const newMode = e.target.value;
                setEditMode(newMode);

                // 确保模式切换时数据正确同步
                setTimeout(() => {
                  if (newMode === 'json' && refForm.current) {
                    refForm.current.setValues(inputs);
                  }
                }, 100);
              }}
            >
              <Radio value='visual'>{t('可视化编辑')}</Radio>
              <Radio value='json'>{t('JSON编辑')}</Radio>
            </RadioGroup>
          </div>

          {editMode === 'visual' ? (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type='primary'
                  icon={<IconPlus />}
                  onClick={handleAddConfig}
                >
                  {t('添加聊天配置')}
                </Button>
                <Button
                  type='primary'
                  theme='solid'
                  icon={<IconSaveStroked />}
                  onClick={onSubmit}
                >
                  {t('保存聊天设置')}
                </Button>
                <Input
                  prefix={<IconSearch />}
                  placeholder={t('搜索聊天应用名称')}
                  value={searchText}
                  onChange={(value) => setSearchText(value)}
                  style={{ width: 250 }}
                  showClear
                />
              </Space>

              <Table
                columns={columns}
                dataSource={filteredConfigs}
                rowKey='id'
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    t('共 {{total}} 项，当前显示 {{start}}-{{end}} 项', {
                      total,
                      start: range[0],
                      end: range[1],
                    }),
                }}
              />
            </div>
          ) : (
            <Form
              values={inputs}
              getFormApi={(formAPI) => (refForm.current = formAPI)}
            >
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
            </Form>
          )}
        </Form.Section>

        {editMode === 'json' && (
          <Space>
            <Button
              type='primary'
              icon={<IconSaveStroked />}
              onClick={onSubmit}
            >
              {t('保存聊天设置')}
            </Button>
          </Space>
        )}
      </Space>

      <Modal
        title={isEdit ? t('编辑聊天配置') : t('添加聊天配置')}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form getFormApi={(api) => (modalFormRef.current = api)}>
          <Form.Input
            field='name'
            label={t('聊天应用名称')}
            placeholder={t('请输入聊天应用名称')}
            rules={[
              { required: true, message: t('请输入聊天应用名称') },
              { min: 1, message: t('名称不能为空') },
            ]}
          />
          <Form.Input
            field='url'
            label={t('URL链接')}
            placeholder={t('请输入完整的URL链接')}
            rules={[{ required: true, message: t('请输入URL链接') }]}
          />
          <Banner
            type='info'
            description={t(
              '提示：链接中的{key}将被替换为API密钥，{address}将被替换为服务器地址',
            )}
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </Spin>
  );
}
