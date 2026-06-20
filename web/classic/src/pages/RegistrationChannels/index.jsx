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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy, IconEdit, IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import { API, copy, showError, showSuccess } from '../../helpers';

const { Paragraph, Text } = Typography;

const emptyForm = {
  code: '',
  name: '',
  description: '',
  landing_path: '/register',
  enabled: true,
};

const channelUrl = (channel) => {
  const landingPath = channel?.landing_path || '/register';
  const sep = landingPath.includes('?') ? '&' : '?';
  return `${window.location.origin}${landingPath}${sep}ch=${channel.code}`;
};

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const RegistrationChannels = () => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/admin/registration-channels');
      const { success, message, data } = res.data;
      if (success) {
        setChannels(
          (data?.items || []).map((item) => ({ ...item, key: item.code })),
        );
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormValues(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (channel) => {
    setEditing(channel);
    setFormValues({
      code: channel.code,
      name: channel.name,
      description: channel.description || '',
      landing_path: channel.landing_path || '/register',
      enabled: channel.enabled !== false,
    });
    setModalVisible(true);
  };

  const submitChannel = async () => {
    setSaving(true);
    try {
      const res = await API.post(
        '/api/admin/registration-channels',
        formValues,
      );
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        setModalVisible(false);
        await loadChannels();
        if (data?.url) {
          await copy(data.url);
          showSuccess(t('注册链接已复制到剪贴板'));
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  const setChannelStatus = async (channel, enabled) => {
    try {
      const res = await API.patch('/api/admin/registration-channels/status', {
        code: channel.code,
        enabled,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('操作成功完成！'));
        setChannels((items) =>
          items.map((item) =>
            item.code === channel.code ? { ...item, enabled } : item,
          ),
        );
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('渠道码'),
        dataIndex: 'code',
        render: (text) => (
          <Tag color="blue" shape="circle">
            {text}
          </Tag>
        ),
      },
      {
        title: t('渠道名称'),
        dataIndex: 'name',
        render: (text, record) => (
          <div className="flex flex-col gap-1">
            <Text strong>{text}</Text>
            {record.description ? (
              <Text type="secondary" size="small">
                {record.description}
              </Text>
            ) : null}
          </div>
        ),
      },
      {
        title: t('注册链接'),
        dataIndex: 'url',
        render: (text, record) => {
          const url = channelUrl(record);
          return (
            <Paragraph
              copyable={{ content: url }}
              ellipsis={{ rows: 1, showTooltip: true }}
              style={{ maxWidth: 360, marginBottom: 0 }}
            >
              {url}
            </Paragraph>
          );
        },
      },
      {
        title: t('注册人数'),
        dataIndex: 'registered_count',
        render: (text) => text || 0,
      },
      {
        title: t('状态'),
        dataIndex: 'enabled',
        render: (enabled, record) => (
          <Switch
            checked={enabled}
            checkedText={t('启用')}
            uncheckedText={t('禁用')}
            onChange={(value) => setChannelStatus(record, value)}
          />
        ),
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: formatTime,
      },
      {
        title: '',
        dataIndex: 'operate',
        fixed: 'right',
        width: 150,
        render: (text, record) => (
          <Space>
            <Button
              type="tertiary"
              size="small"
              icon={<IconCopy />}
              onClick={async () => {
                if (await copy(channelUrl(record))) {
                  showSuccess(t('复制成功'));
                }
              }}
            />
            <Button
              type="tertiary"
              size="small"
              icon={<IconEdit />}
              onClick={() => openEdit(record)}
            />
          </Space>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="mt-[60px] px-2">
      <CardPro
        type="type1"
        descriptionArea={
          <div className="flex flex-col gap-1">
            <Text strong>{t('注册渠道管理')}</Text>
            <Text type="secondary" size="small">
              {t('生成带渠道码的注册链接，并查看每个渠道带来的注册用户数量')}
            </Text>
          </div>
        }
        actionsArea={
          <div className="flex justify-between items-center w-full">
            <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
              {t('新建渠道')}
            </Button>
          </div>
        }
        t={t}
      >
        <CardTable
          columns={columns}
          dataSource={channels}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="code"
          className="overflow-hidden"
          size="middle"
        />
      </CardPro>

      <Modal
        title={editing ? t('编辑渠道') : t('新建渠道')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={submitChannel}
        confirmLoading={saving}
        okText={t('保存')}
        cancelText={t('取消')}
      >
        <Form layout="vertical">
          <div className="mb-4 flex flex-col gap-2">
            <Text strong>{t('渠道码')}</Text>
            <Input
              value={formValues.code}
              disabled={!!editing}
              placeholder="xhs_june"
              onChange={(value) =>
                setFormValues((prev) => ({ ...prev, code: value }))
              }
            />
          </div>
          <div className="mb-4 flex flex-col gap-2">
            <Text strong>{t('渠道名称')}</Text>
            <Input
              value={formValues.name}
              placeholder={t('例如：小红书 6月投放')}
              onChange={(value) =>
                setFormValues((prev) => ({ ...prev, name: value }))
              }
            />
          </div>
          <div className="mb-4 flex flex-col gap-2">
            <Text strong>{t('落地路径')}</Text>
            <Input
              value={formValues.landing_path}
              placeholder="/register"
              onChange={(value) =>
                setFormValues((prev) => ({ ...prev, landing_path: value }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Text strong>{t('渠道说明')}</Text>
            <TextArea
              value={formValues.description}
              placeholder={t('渠道说明')}
              autosize
              onChange={(value) =>
                setFormValues((prev) => ({ ...prev, description: value }))
              }
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Text>{t('启用渠道')}</Text>
            <Switch
              checked={formValues.enabled}
              onChange={(value) =>
                setFormValues((prev) => ({ ...prev, enabled: value }))
              }
            />
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default RegistrationChannels;
