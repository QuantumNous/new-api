import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const UserTokenManagerModal = ({ visible, onCancel, t, initialUser }) => {
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [tokenName, setTokenName] = useState('admin-created');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [newKey, setNewKey] = useState('');

  const ensureSkPrefix = (value) => {
    const v = (value || '').trim();
    if (!v) return '';
    return v.startsWith('sk-') ? v : `sk-${v}`;
  };

  const loadTokens = async (uid, uname) => {
    const currentUserId = (uid ?? userId).trim();
    const currentUsername = (uname ?? username).trim();
    if (!currentUserId && !currentUsername) {
      setTokens([]);
      return;
    }
    setLoading(true);
    try {
      const res = await API.get('/api/user/feishu/tokens', {
        params: {
          user_id: currentUserId || undefined,
          username: currentUsername || undefined,
          p: 1,
          page_size: 100,
        },
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('查询失败'));
        return;
      }
      const items = data?.items || [];
      setTokens(
        items.map((item) => ({
          ...item,
          key: ensureSkPrefix(item?.key),
        })),
      );
    } catch (e) {
      showError(e.message || t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    const uid = initialUser?.id ? String(initialUser.id) : '';
    const uname = initialUser?.username || '';
    setUserId(uid);
    setUsername(uname);
    setNewKey('');
    setTokens([]);
    loadTokens(uid, uname);
  }, [visible, initialUser]);

  const createToken = async () => {
    if (!userId.trim() && !username.trim()) {
      showError(t('缺少用户信息'));
      return;
    }
    setCreating(true);
    try {
      const res = await API.post('/api/user/feishu/tokens', {
        user_id: userId.trim() ? Number(userId.trim()) : undefined,
        username: username.trim() || undefined,
        name: tokenName.trim() || 'admin-created',
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('创建失败'));
        return;
      }
      setNewKey(ensureSkPrefix(data?.key));
      showSuccess(t('创建成功'));
      await loadTokens();
    } catch (e) {
      showError(e.message || t('请求失败'));
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: t('名称'), dataIndex: 'name', width: 180 },
    {
      title: t('明文令牌'),
      dataIndex: 'key',
      render: (text) => <Typography.Text copyable>{ensureSkPrefix(text)}</Typography.Text>,
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (s) => <Tag color={s === 1 ? 'green' : 'red'}>{s}</Tag>,
    },
  ];

  return (
    <Modal
      title={t('用户令牌管理')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1100}
    >
      <Space vertical align='start' style={{ width: '100%' }}>
        <Typography.Text type='secondary'>
          {t('当前用户')}：{username || '-'} (ID: {userId || '-'})
        </Typography.Text>

        <Space>
          <Typography.Text>{t('令牌名称')}</Typography.Text>
          <Input
            value={tokenName}
            onChange={setTokenName}
            placeholder='admin-created'
            style={{ minWidth: 240 }}
          />
        </Space>

        <Space>
          <Button loading={loading} onClick={() => loadTokens()}>
            {t('刷新列表')}
          </Button>
          <Button type='primary' loading={creating} onClick={createToken}>
            {t('创建令牌')}
          </Button>
        </Space>

        {newKey ? (
          <div className='w-full rounded border border-yellow-300 bg-yellow-50 p-3'>
            <Typography.Text strong>{t('新创建令牌')}：</Typography.Text>
            <Typography.Text copyable>{newKey}</Typography.Text>
          </div>
        ) : null}

        <Table
          style={{ width: '100%' }}
          columns={columns}
          dataSource={tokens}
          rowKey='id'
          loading={loading}
          pagination={false}
        />
      </Space>
    </Modal>
  );
};

export default UserTokenManagerModal;
