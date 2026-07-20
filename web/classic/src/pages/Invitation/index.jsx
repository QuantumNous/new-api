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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCopy,
  IconDelete,
  IconDownload,
  IconPlus,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../helpers';

const { Text, Title } = Typography;
const PAGE_SIZE = 20;
const INVITATION_STATUS_ENABLED = 1;
const INVITATION_STATUS_DISABLED = 2;

const Invitation = () => {
  const { t } = useTranslation();
  const createFormApi = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState([]);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(targetPage),
        page_size: String(PAGE_SIZE),
      });
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (status) params.set('status', status);
      const path = keyword.trim() || status ? 'search' : '';
      const res = await API.get(`/api/invitation/${path}?${params}`);
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      setRows(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
      setPage(res.data.data.page > 0 ? res.data.data.page : targetPage);
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const updateStatus = async (record, nextStatus) => {
    try {
      const res = await API.put('/api/invitation/?status_only=true', {
        id: record.id,
        status: nextStatus,
      });
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      showSuccess(t('邀请码状态已更新'));
      await load();
    } catch (error) {
      showError(error);
    }
  };

  const deleteOne = (record) => {
    Modal.confirm({
      title: t('删除邀请码'),
      content: t('删除后该邀请码将无法再次使用，是否继续？'),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/invitation/${record.id}`);
          if (!res.data.success) {
            showError(res.data.message);
            return;
          }
          showSuccess(t('邀请码已删除'));
          await load(rows.length === 1 && page > 1 ? page - 1 : page);
        } catch (error) {
          showError(error);
        }
      },
    });
  };

  const deleteUsed = () => {
    Modal.confirm({
      title: t('清理已使用邀请码'),
      content: t('已使用邀请码将从列表中移除，使用记录仍会保留。'),
      onOk: async () => {
        try {
          const res = await API.delete('/api/invitation/used');
          if (!res.data.success) {
            showError(res.data.message);
            return;
          }
          showSuccess(
            t('已清理 {{count}} 个邀请码', { count: res.data.data || 0 }),
          );
          await load(1);
        } catch (error) {
          showError(error);
        }
      },
    });
  };

  const createCodes = async () => {
    const values = createFormApi.current?.getValues() || {};
    if (!values.name?.trim()) {
      showError(t('请输入名称'));
      return;
    }
    const expiredTime = values.expired_time
      ? Math.floor(values.expired_time.getTime() / 1000)
      : 0;
    try {
      const res = await API.post('/api/invitation/', {
        name: values.name.trim(),
        count: values.count || 1,
        expired_time: expiredTime,
      });
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      setCreateVisible(false);
      setGeneratedCodes(res.data.data || []);
      createFormApi.current?.reset();
      await load(1);
    } catch (error) {
      showError(error);
    }
  };

  const copyGenerated = async () => {
    if (await copy(generatedCodes.join('\n'))) {
      showSuccess(t('邀请码已复制'));
    }
  };

  const downloadGenerated = () => {
    const url = URL.createObjectURL(
      new Blob([generatedCodes.join('\n')], {
        type: 'text/plain;charset=utf-8',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'invitation-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: t('名称'), dataIndex: 'name' },
      {
        title: t('邀请码'),
        dataIndex: 'code_prefix',
        render: (value) => <Text code>{value}********</Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'state',
        render: (value) => {
          const config = {
            enabled: ['green', t('未使用')],
            disabled: ['grey', t('已停用')],
            used: ['blue', t('已使用')],
            expired: ['red', t('已过期')],
          }[value] || ['grey', value];
          return <Tag color={config[0]}>{config[1]}</Tag>;
        },
      },
      {
        title: t('使用人'),
        render: (_, record) =>
          record.used_username || record.used_user_id || '-',
      },
      {
        title: t('使用时间'),
        dataIndex: 'used_time',
        render: (value) =>
          value ? new Date(value * 1000).toLocaleString() : '-',
      },
      {
        title: t('操作'),
        width: 220,
        render: (_, record) => (
          <Space>
            {record.state === 'enabled' && (
              <Button
                size='small'
                onClick={() => updateStatus(record, INVITATION_STATUS_DISABLED)}
              >
                {t('停用')}
              </Button>
            )}
            {record.state === 'disabled' && (
              <Button
                size='small'
                onClick={() => updateStatus(record, INVITATION_STATUS_ENABLED)}
              >
                {t('启用')}
              </Button>
            )}
            <Button
              size='small'
              type='danger'
              icon={<IconDelete />}
              aria-label={t('删除邀请码')}
              onClick={() => deleteOne(record)}
            />
          </Space>
        ),
      },
    ],
    [keyword, page, rows.length, status, t],
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Title heading={4}>{t('注册邀请码')}</Title>
            <Space wrap>
              <Button icon={<IconRefresh />} onClick={() => load()}>
                {t('刷新')}
              </Button>
              <Button type='danger' icon={<IconDelete />} onClick={deleteUsed}>
                {t('清理已使用')}
              </Button>
              <Button
                theme='solid'
                type='primary'
                icon={<IconPlus />}
                onClick={() => setCreateVisible(true)}
              >
                {t('生成邀请码')}
              </Button>
            </Space>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Input
              value={keyword}
              placeholder={t('搜索名称')}
              onChange={setKeyword}
              style={{ width: 220 }}
            />
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 160 }}
              optionList={[
                { value: '', label: t('全部状态') },
                { value: 'enabled', label: t('未使用') },
                { value: 'used', label: t('已使用') },
                { value: 'disabled', label: t('已停用') },
                { value: 'expired', label: t('已过期') },
              ]}
            />
            <Button onClick={() => load(1)}>{t('搜索')}</Button>
          </div>

          <Table
            rowKey='id'
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{
              currentPage: page,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: load,
            }}
          />
        </div>
      </Card>

      <Modal
        title={t('生成邀请码')}
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={createCodes}
      >
        <Form
          initValues={{ count: 1 }}
          getFormApi={(api) => (createFormApi.current = api)}
        >
          <Form.Input
            field='name'
            label={t('名称')}
            placeholder={t('请输入名称')}
          />
          <Form.InputNumber
            field='count'
            label={t('数量')}
            min={1}
            max={100}
            style={{ width: '100%' }}
          />
          <Form.DatePicker
            field='expired_time'
            label={t('过期时间')}
            type='dateTime'
            placeholder={t('留空表示永久有效')}
            style={{ width: '100%' }}
          />
        </Form>
      </Modal>

      <Modal
        title={t('邀请码已生成')}
        visible={generatedCodes.length > 0}
        footer={
          <Space>
            <Button icon={<IconCopy />} onClick={copyGenerated}>
              {t('复制全部')}
            </Button>
            <Button icon={<IconDownload />} onClick={downloadGenerated}>
              {t('下载')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              onClick={() => setGeneratedCodes([])}
            >
              {t('完成')}
            </Button>
          </Space>
        }
        onCancel={() => setGeneratedCodes([])}
      >
        <Text>{t('邀请码明文仅在本次生成后显示，请妥善保存。')}</Text>
        <pre className='mt-3 max-h-72 overflow-auto rounded border p-3'>
          {generatedCodes.join('\n')}
        </pre>
      </Modal>
    </div>
  );
};

export default Invitation;
