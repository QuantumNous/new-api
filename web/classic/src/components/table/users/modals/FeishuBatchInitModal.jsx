import React, { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const defaultRow = () => ({
  employee_id: '',
  mobile: '',
  email: '',
  display_name: '',
  group: 'default',
  remark: '',
});

const FeishuBatchInitModal = ({ visible, onCancel, onSuccess, t }) => {
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState([defaultRow()]);
  const [previewedUsers, setPreviewedUsers] = useState([]);
  const [previewResults, setPreviewResults] = useState([]);
  const [selectedMap, setSelectedMap] = useState({});

  const setRowField = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setPreviewedUsers([]);
    setPreviewResults([]);
    setSelectedMap({});
  };

  const addRow = () => setRows((prev) => [...prev, defaultRow()]);
  const removeRow = (idx) =>
    setRows((prev) => prev.filter((_, index) => index !== idx));

  const validateUsers = () => {
    const users = rows.filter(
      (u) =>
        u.employee_id?.trim() ||
        u.mobile?.trim() ||
        u.email?.trim() ||
        u.display_name?.trim(),
    );
    if (users.length === 0) {
      showError(t('请至少填写一条用户记录'));
      return null;
    }
    return users;
  };

  const buildInputIdentifier = (u) =>
    u?.employee_id ||
    u?.mobile ||
    u?.email ||
    u?.feishu_open_id ||
    u?.feishu_union_id ||
    u?.feishu_user_id ||
    '-';

  const handlePreview = async () => {
    const users = validateUsers();
    if (!users) return;
    setSubmitting(true);
    try {
      const previewPayload = users.map((u) => ({ ...u, confirmed: false }));
      const res = await API.post('/api/user/feishu/users/batch', {
        preview_only: true,
        users: previewPayload,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('预览失败'));
        return;
      }
      const results = data?.results || [];
      const nextSelected = {};
      results.forEach((item, idx) => {
        nextSelected[idx] = item.action === 'preview_only';
      });
      setPreviewedUsers(users);
      setPreviewResults(results);
      setSelectedMap(nextSelected);
      showSuccess(t('预览完成，请勾选后确认初始化'));
    } catch (e) {
      showError(e.message || t('请求失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    let usersToSubmit = [];
    if (previewedUsers.length > 0 && previewResults.length > 0) {
      usersToSubmit = previewedUsers.filter((_, idx) => selectedMap[idx]);
      if (usersToSubmit.length === 0) {
        showError(t('请至少勾选一个用户'));
        return;
      }
    } else {
      const parsed = validateUsers();
      if (!parsed) return;
      usersToSubmit = parsed;
    }

    setSubmitting(true);
    try {
      const confirmedPayload = usersToSubmit.map((u) => ({ ...u, confirmed: true }));
      const res = await API.post('/api/user/feishu/users/batch', {
        preview_only: false,
        users: confirmedPayload,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('批量初始化失败'));
        return;
      }
      showSuccess(
        t('批量初始化完成：成功 {{s}}，跳过 {{k}}，失败 {{f}}', {
          s: data?.success || 0,
          k: data?.skipped || 0,
          f: data?.failed || 0,
        }),
      );
      setRows([defaultRow()]);
      setPreviewedUsers([]);
      setPreviewResults([]);
      setSelectedMap({});
      onSuccess?.();
    } catch (e) {
      showError(e.message || t('请求失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const previewTableData = useMemo(
    () =>
      previewResults.map((item, idx) => ({
        key: idx,
        index: idx,
        selected: !!selectedMap[idx],
        input_identifier: buildInputIdentifier(previewedUsers[idx]),
        ...item,
      })),
    [previewResults, selectedMap, previewedUsers],
  );

  const handleSelectAllPreview = () => {
    const nextSelected = {};
    previewResults.forEach((item, idx) => {
      nextSelected[idx] = item.action === 'preview_only';
    });
    setSelectedMap(nextSelected);
  };

  const handleClearSelection = () => setSelectedMap({});

  const inputColumns = [
    {
      title: t('工号'),
      render: (_, __, idx) => (
        <Input
          value={rows[idx]?.employee_id || ''}
          onChange={(v) => setRowField(idx, 'employee_id', v)}
          placeholder='074234'
        />
      ),
    },
    {
      title: t('手机号'),
      render: (_, __, idx) => (
        <Input
          value={rows[idx]?.mobile || ''}
          onChange={(v) => setRowField(idx, 'mobile', v)}
          placeholder='13800138000'
        />
      ),
    },
    {
      title: t('邮箱'),
      render: (_, __, idx) => (
        <Input
          value={rows[idx]?.email || ''}
          onChange={(v) => setRowField(idx, 'email', v)}
          placeholder='name@company.com'
        />
      ),
    },
    {
      title: t('显示名(可选)'),
      render: (_, __, idx) => (
        <Input
          value={rows[idx]?.display_name || ''}
          onChange={(v) => setRowField(idx, 'display_name', v)}
          placeholder='林壁秋'
        />
      ),
    },
    {
      title: t('分组'),
      render: (_, __, idx) => (
        <Select
          value={rows[idx]?.group || 'default'}
          onChange={(v) => setRowField(idx, 'group', v)}
          style={{ width: 120 }}
          optionList={[
            { label: 'default', value: 'default' },
            { label: 'vip', value: 'vip' },
          ]}
        />
      ),
    },
    {
      title: t('操作'),
      width: 90,
      render: (_, __, idx) => (
        <Button
          type='danger'
          size='small'
          disabled={rows.length === 1}
          onClick={() => removeRow(idx)}
        >
          {t('删除')}
        </Button>
      ),
    },
  ];

  const columns = [
    {
      title: t('选择'),
      dataIndex: 'selected',
      width: 70,
      render: (_, record) => (
        <Checkbox
          checked={!!selectedMap[record.index]}
          disabled={record.action !== 'preview_only'}
          onChange={(checked) =>
            setSelectedMap((prev) => ({ ...prev, [record.index]: !!checked }))
          }
        />
      ),
    },
    { title: t('输入标识'), dataIndex: 'input_identifier' },
    { title: t('姓名'), dataIndex: 'display_name' },
    { title: 'OpenID', dataIndex: 'feishu_open_id' },
    { title: 'UnionID', dataIndex: 'feishu_union_id' },
    { title: 'UserID', dataIndex: 'feishu_user_id' },
    { title: t('组织'), dataIndex: 'org_name' },
    { title: t('岗位'), dataIndex: 'job_title' },
    { title: t('状态'), dataIndex: 'action' },
    { title: t('说明'), dataIndex: 'error' },
  ];

  return (
    <Modal
      title={t('飞书批量初始化')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1300}
    >
      <Space vertical align='start' style={{ width: '100%' }}>
        <Typography.Text type='secondary'>
          {t('先在页面填写用户标识，再预览匹配结果，确认后初始化。')}
        </Typography.Text>

        <Table
          style={{ width: '100%' }}
          columns={inputColumns}
          dataSource={rows.map((_, idx) => ({ key: idx }))}
          pagination={false}
          size='small'
        />

        <Button size='small' onClick={addRow}>
          {t('新增一行')}
        </Button>

        {previewTableData.length > 0 ? (
          <>
            <div className='w-full flex justify-end gap-2'>
              <Button size='small' onClick={handleSelectAllPreview}>
                {t('全选可初始化项')}
              </Button>
              <Button size='small' onClick={handleClearSelection}>
                {t('清空选择')}
              </Button>
            </div>
            <Table
              style={{ width: '100%' }}
              columns={columns}
              dataSource={previewTableData}
              pagination={false}
              size='small'
            />
          </>
        ) : null}

        <div className='w-full flex justify-end gap-2'>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button loading={submitting} onClick={handlePreview}>
            {t('预览用户')}
          </Button>
          <Button type='primary' loading={submitting} onClick={handleSubmit}>
            {t('确认初始化')}
          </Button>
        </div>
      </Space>
    </Modal>
  );
};

export default FeishuBatchInitModal;
