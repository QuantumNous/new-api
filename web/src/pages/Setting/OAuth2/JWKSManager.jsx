import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Popconfirm, Toast } from '@douyinfe/semi-ui';
import { IconRefresh, IconDelete, IconPlay } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

export default function JWKSManager() {
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/keys');
      if (res?.data?.success) {
        setKeys(res.data.data || []);
      } else {
        showError(res?.data?.message || '获取密钥列表失败');
      }
    } catch (e) {
      showError('获取密钥列表失败');
    } finally {
      setLoading(false);
    }
  };

  const rotate = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/rotate', {});
      if (res?.data?.success) {
        showSuccess('签名密钥已轮换：' + res.data.kid);
        await load();
      } else {
        showError(res?.data?.message || '密钥轮换失败');
      }
    } catch (e) {
      showError('密钥轮换失败');
    } finally {
      setLoading(false);
    }
  };

  const del = async (kid) => {
    setLoading(true);
    try {
      const res = await API.delete(`/api/oauth/keys/${kid}`);
      if (res?.data?.success) {
        Toast.success('已删除：' + kid);
        await load();
      } else {
        showError(res?.data?.message || '删除失败');
      }
    } catch (e) {
      showError('删除失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    {
      title: 'KID',
      dataIndex: 'kid',
      render: (kid) => <Text code copyable>{kid}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '-'),
    },
    {
      title: '状态',
      dataIndex: 'current',
      render: (cur) => (cur ? <Tag color='green'>当前</Tag> : <Tag>历史</Tag>),
    },
    {
      title: '操作',
      render: (_, r) => (
        <Space>
          {!r.current && (
            <Popconfirm
              title={`确定删除密钥 ${r.kid} ？`}
              content='删除后使用该 kid 签发的旧令牌仍可被验证（若 JWKS 已被其他方缓存，建议保留一段时间）'
              okText='删除'
              onConfirm={() => del(r.kid)}
            >
              <Button icon={<IconDelete />} size='small' theme='borderless'>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title='JWKS 管理'
      extra={
        <Space>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
          <Button icon={<IconPlay />} type='primary' onClick={rotate} loading={loading}>轮换密钥</Button>
        </Space>
      }
      style={{ marginTop: 10 }}
    >
      <Table
        dataSource={keys}
        columns={columns}
        rowKey='kid'
        loading={loading}
        pagination={false}
        empty={<Text type='tertiary'>暂无密钥</Text>}
      />
    </Card>
  );
}

