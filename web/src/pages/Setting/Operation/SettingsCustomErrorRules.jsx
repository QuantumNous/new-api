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

import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Table,
  Tag,
  Space,
  Popconfirm,
  SideSheet,
  Form,
  Typography,
  Switch,
  Spin,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsCustomErrorRules() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [editVisible, setEditVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const formRef = useRef(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/custom_error_rule/');
      if (res.data.success) {
        setRules(res.data.data || []);
      } else {
        showError(res.data.message || t('获取错误规则失败'));
      }
    } catch {
      showError(t('获取错误规则失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleDelete = async (id) => {
    try {
      const res = await API.delete(`/api/custom_error_rule/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        loadRules();
      } else {
        showError(res.data.message || t('删除失败'));
      }
    } catch {
      showError(t('删除失败'));
    }
  };

  const handleToggleEnabled = async (rule) => {
    try {
      const res = await API.put('/api/custom_error_rule/', {
        ...rule,
        enabled: !rule.enabled,
      });
      if (res.data.success) {
        loadRules();
      } else {
        showError(res.data.message || t('更新失败'));
      }
    } catch {
      showError(t('更新失败'));
    }
  };

  const handleEdit = (rule = null) => {
    setEditingRule(rule);
    setEditVisible(true);
  };

  const handleEditClose = () => {
    setEditVisible(false);
    setEditingRule(null);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (editingRule && editingRule.id) {
        const res = await API.put('/api/custom_error_rule/', {
          ...values,
          id: editingRule.id,
        });
        if (res.data.success) {
          showSuccess(t('更新成功'));
          handleEditClose();
          loadRules();
        } else {
          showError(res.data.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/custom_error_rule/', values);
        if (res.data.success) {
          showSuccess(t('创建成功'));
          handleEditClose();
          loadRules();
        } else {
          showError(res.data.message || t('创建失败'));
        }
      }
    } catch {
      showError(t('操作失败'));
    }
    setLoading(false);
  };

  const columns = [
    {
      title: t('匹配内容'),
      dataIndex: 'contains',
      key: 'contains',
      render: (text) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('状态码'),
      dataIndex: 'status_code',
      key: 'status_code',
      width: 80,
      render: (val) => (
        <Tag color={val === 0 ? 'grey' : 'blue'} shape='circle' size='small'>
          {val === 0 ? t('任意') : val}
        </Tag>
      ),
    },
    {
      title: t('替换消息'),
      dataIndex: 'new_message',
      key: 'new_message',
      render: (text) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('优先级'),
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
    },
    {
      title: t('启用'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 70,
      render: (val, record) => (
        <Switch
          checked={val}
          size='small'
          onChange={() => handleToggleEnabled(record)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size='small' onClick={() => handleEdit(record)}>
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确定删除此规则？')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size='small' type='danger'>
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Spin spinning={loading}>
        <Form.Section text={t('自定义错误替换规则')}>
          <Typography.Text
            type='tertiary'
            style={{ marginBottom: 16, display: 'block' }}
          >
            {t('当API返回的错误消息包含指定字符串时，将自动替换为自定义消息')}
          </Typography.Text>
          <div className='flex justify-end mb-2'>
            <Button
              type='primary'
              theme='solid'
              size='small'
              icon={<IconPlus />}
              onClick={() => handleEdit()}
            >
              {t('新增规则')}
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={rules}
            rowKey='id'
            pagination={false}
            size='small'
            empty={t('暂无自定义错误规则')}
          />
        </Form.Section>
      </Spin>

      <SideSheet
        title={editingRule?.id ? t('编辑错误规则') : t('新增错误规则')}
        visible={editVisible}
        onCancel={handleEditClose}
        width={450}
      >
        <Form
          key={editingRule?.id ?? 'new'}
          getFormApi={(api) => (formRef.current = api)}
          initValues={
            editingRule
              ? {
                  contains: editingRule.contains,
                  status_code: editingRule.status_code,
                  new_message: editingRule.new_message,
                  priority: editingRule.priority,
                  enabled: editingRule.enabled,
                }
              : {
                  contains: '',
                  status_code: 0,
                  new_message: '',
                  priority: 0,
                  enabled: true,
                }
          }
          onSubmit={handleSubmit}
        >
          <Row gutter={12}>
            <Col span={24}>
              <Form.TextArea
                field='contains'
                label={t('匹配内容')}
                placeholder={t('错误消息中包含此字符串时触发替换')}
                rules={[{ required: true, message: t('请输入匹配内容') }]}
                rows={2}
              />
            </Col>
            <Col span={12}>
              <Form.InputNumber
                field='status_code'
                label={t('状态码')}
                placeholder={t('0表示不限')}
                min={0}
                max={599}
              />
            </Col>
            <Col span={12}>
              <Form.InputNumber
                field='priority'
                label={t('优先级')}
                placeholder={t('数字越小优先级越高')}
                min={0}
              />
            </Col>
            <Col span={24}>
              <Form.TextArea
                field='new_message'
                label={t('替换消息')}
                placeholder={t('替换后展示给用户的消息')}
                rules={[{ required: true, message: t('请输入替换消息') }]}
                rows={2}
              />
            </Col>
            <Col span={24}>
              <Form.Switch
                field='enabled'
                label={t('启用')}
                size='default'
              />
            </Col>
            <Col span={24}>
              <Button
                theme='solid'
                type='primary'
                htmlType='submit'
                loading={loading}
              >
                {t('提交')}
              </Button>
            </Col>
          </Row>
        </Form>
      </SideSheet>
    </>
  );
}
