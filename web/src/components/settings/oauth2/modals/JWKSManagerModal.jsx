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
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  Toast,
  Form,
  TextArea,
  Divider,
  Input,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function JWKSManagerModal({ visible, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/keys');
      if (res?.data?.success) setKeys(res.data.data || []);
      else showError(res?.data?.message || t('获取密钥列表失败'));
    } catch {
      showError(t('获取密钥列表失败'));
    } finally {
      setLoading(false);
    }
  };

  const rotate = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/rotate', {});
      if (res?.data?.success) {
        showSuccess(t('签名密钥已轮换：{{kid}}', { kid: res.data.kid }));
        await load();
      } else showError(res?.data?.message || t('密钥轮换失败'));
    } catch {
      showError(t('密钥轮换失败'));
    } finally {
      setLoading(false);
    }
  };

  const del = async (kid) => {
    setLoading(true);
    try {
      const res = await API.delete(`/api/oauth/keys/${kid}`);
      if (res?.data?.success) {
        Toast.success(t('已删除：{{kid}}', { kid }));
        await load();
      } else showError(res?.data?.message || t('删除失败'));
    } catch {
      showError(t('删除失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) load();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const res = await API.get('/api/oauth/server-info');
        const p = res?.data?.default_private_key_path;
        if (p) setGenPath(p);
      } catch {}
    })();
  }, [visible]);

  // Import PEM state
  const [showImport, setShowImport] = useState(false);
  const [pem, setPem] = useState('');
  const [customKid, setCustomKid] = useState('');
  const importPem = async () => {
    if (!pem.trim()) return Toast.warning(t('请粘贴 PEM 私钥'));
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/import_pem', {
        pem,
        kid: customKid.trim(),
      });
      if (res?.data?.success) {
        Toast.success(
          t('已导入私钥并切换到 kid={{kid}}', { kid: res.data.kid }),
        );
        setPem('');
        setCustomKid('');
        setShowImport(false);
        await load();
      } else {
        Toast.error(res?.data?.message || t('导入失败'));
      }
    } catch {
      Toast.error(t('导入失败'));
    } finally {
      setLoading(false);
    }
  };

  // Generate PEM file state
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPath, setGenPath] = useState('/etc/new-api/oauth2-private.pem');
  const [genKid, setGenKid] = useState('');
  const generatePemFile = async () => {
    if (!genPath.trim()) return Toast.warning(t('请填写保存路径'));
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/generate_file', {
        path: genPath.trim(),
        kid: genKid.trim(),
      });
      if (res?.data?.success) {
        Toast.success(t('已生成并生效：{{path}}', { path: res.data.path }));
        await load();
      } else {
        Toast.error(res?.data?.message || t('生成失败'));
      }
    } catch {
      Toast.error(t('生成失败'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'KID',
      dataIndex: 'kid',
      render: (kid) => (
        <Text code copyable>
          {kid}
        </Text>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '-'),
    },
    {
      title: t('状态'),
      dataIndex: 'current',
      render: (cur) =>
        cur ? <Tag color='green'>{t('当前')}</Tag> : <Tag>{t('历史')}</Tag>,
    },
    {
      title: t('操作'),
      render: (_, r) => (
        <Space>
          {!r.current && (
            <Popconfirm
              title={t('确定删除密钥 {{kid}} ？', { kid: r.kid })}
              content={t(
                '删除后使用该 kid 签发的旧令牌仍可被验证（外部 JWKS 缓存可能仍保留）',
              )}
              okText={t('删除')}
              onConfirm={() => del(r.kid)}
            >
              <Button size='small' theme='borderless'>
                {t('删除')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      visible={visible}
      title={t('JWKS 管理')}
      onCancel={onClose}
      footer={null}
      width={820}
      style={{ top: 48 }}
    >
      <Space style={{ marginBottom: 8 }}>
        <Button onClick={load} loading={loading}>
          {t('刷新')}
        </Button>
        <Button type='primary' onClick={rotate} loading={loading}>
          {t('轮换密钥')}
        </Button>
        <Button onClick={() => setShowImport(!showImport)}>
          {t('导入 PEM 私钥')}
        </Button>
        <Button onClick={() => setShowGenerate(!showGenerate)}>
          {t('生成 PEM 文件')}
        </Button>
        <Button onClick={onClose}>{t('关闭')}</Button>
      </Space>
      {showGenerate && (
        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Form labelPosition='left' labelWidth={120}>
            <Form.Input
              field='path'
              label={t('保存路径')}
              value={genPath}
              onChange={setGenPath}
              placeholder='/secure/path/oauth2-private.pem'
            />
            <Form.Input
              field='genKid'
              label={t('自定义 KID')}
              value={genKid}
              onChange={setGenKid}
              placeholder={t('可留空自动生成')}
            />
          </Form>
          <div style={{ marginTop: 8 }}>
            <Button type='primary' onClick={generatePemFile} loading={loading}>
              {t('生成并生效')}
            </Button>
          </div>
          <Divider margin='12px' />
          <Text type='tertiary'>
            {t(
              '建议：仅在合规要求下使用文件私钥。请确保目录权限安全（建议 0600），并妥善备份。',
            )}
          </Text>
        </div>
      )}
      {showImport && (
        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Form labelPosition='left' labelWidth={120}>
            <Form.Input
              field='kid'
              label={t('自定义 KID')}
              placeholder={t('可留空自动生成')}
              value={customKid}
              onChange={setCustomKid}
            />
            <Form.TextArea
              field='pem'
              label={t('PEM 私钥')}
              value={pem}
              onChange={setPem}
              rows={6}
              placeholder={
                '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
              }
            />
          </Form>
          <div style={{ marginTop: 8 }}>
            <Button type='primary' onClick={importPem} loading={loading}>
              {t('导入并生效')}
            </Button>
          </div>
          <Divider margin='12px' />
          <Text type='tertiary'>
            {t(
              '建议：优先使用内存签名密钥与 JWKS 轮换；仅在有合规要求时导入外部私钥。',
            )}
          </Text>
        </div>
      )}
      <Table
        dataSource={keys}
        columns={columns}
        rowKey='kid'
        loading={loading}
        pagination={false}
        empty={<Text type='tertiary'>{t('暂无密钥')}</Text>}
      />
    </Modal>
  );
}
