import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Space, Tag, Typography, Popconfirm, Toast, Form, TextArea, Divider, Input } from '@douyinfe/semi-ui';
import { IconRefresh, IconDelete, IconPlay } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

export default function JWKSManagerModal({ visible, onClose }) {
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/oauth/keys');
      if (res?.data?.success) setKeys(res.data.data || []);
      else showError(res?.data?.message || '获取密钥列表失败');
    } catch { showError('获取密钥列表失败'); } finally { setLoading(false); }
  };

  const rotate = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/rotate', {});
      if (res?.data?.success) { showSuccess('签名密钥已轮换：' + res.data.kid); await load(); }
      else showError(res?.data?.message || '密钥轮换失败');
    } catch { showError('密钥轮换失败'); } finally { setLoading(false); }
  };

  const del = async (kid) => {
    setLoading(true);
    try {
      const res = await API.delete(`/api/oauth/keys/${kid}`);
      if (res?.data?.success) { Toast.success('已删除：' + kid); await load(); }
      else showError(res?.data?.message || '删除失败');
    } catch { showError('删除失败'); } finally { setLoading(false); }
  };

  useEffect(() => { if (visible) load(); }, [visible]);
  useEffect(() => {
    if (!visible) return;
    (async ()=>{
      try{
        const res = await API.get('/api/oauth/server-info');
        const p = res?.data?.default_private_key_path;
        if (p) setGenPath(p);
      }catch{}
    })();
  }, [visible]);

  // Import PEM state
  const [showImport, setShowImport] = useState(false);
  const [pem, setPem] = useState('');
  const [customKid, setCustomKid] = useState('');
  const importPem = async () => {
    if (!pem.trim()) return Toast.warning('请粘贴 PEM 私钥');
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/import_pem', { pem, kid: customKid.trim() });
      if (res?.data?.success) {
        Toast.success('已导入私钥并切换到 kid=' + res.data.kid);
        setPem(''); setCustomKid(''); setShowImport(false);
        await load();
      } else {
        Toast.error(res?.data?.message || '导入失败');
      }
    } catch { Toast.error('导入失败'); } finally { setLoading(false); }
  };

  // Generate PEM file state
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPath, setGenPath] = useState('/etc/new-api/oauth2-private.pem');
  const [genKid, setGenKid] = useState('');
  const generatePemFile = async () => {
    if (!genPath.trim()) return Toast.warning('请填写保存路径');
    setLoading(true);
    try {
      const res = await API.post('/api/oauth/keys/generate_file', { path: genPath.trim(), kid: genKid.trim() });
      if (res?.data?.success) {
        Toast.success('已生成并生效：' + res.data.path);
        await load();
      } else {
        Toast.error(res?.data?.message || '生成失败');
      }
    } catch { Toast.error('生成失败'); } finally { setLoading(false); }
  };

  const columns = [
    { title: 'KID', dataIndex: 'kid', render: (kid) => <Text code copyable>{kid}</Text> },
    { title: '创建时间', dataIndex: 'created_at', render: (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '-') },
    { title: '状态', dataIndex: 'current', render: (cur) => (cur ? <Tag color='green'>当前</Tag> : <Tag>历史</Tag>) },
    { title: '操作', render: (_, r) => (
        <Space>
          {!r.current && (
            <Popconfirm title={`确定删除密钥 ${r.kid} ？`} content='删除后使用该 kid 签发的旧令牌仍可被验证（外部 JWKS 缓存可能仍保留）' okText='删除' onConfirm={() => del(r.kid)}>
              <Button icon={<IconDelete />} size='small' theme='borderless'>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ) },
  ];

  return (
    <Modal
      visible={visible}
      title='JWKS 管理'
      onCancel={onClose}
      footer={null}
      width={820}
      style={{ top: 48 }}
    >
      <Space style={{ marginBottom: 8 }}>
        <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
        <Button icon={<IconPlay />} type='primary' onClick={rotate} loading={loading}>轮换密钥</Button>
        <Button onClick={()=>setShowImport(!showImport)}>导入 PEM 私钥</Button>
        <Button onClick={()=>setShowGenerate(!showGenerate)}>生成 PEM 文件</Button>
        <Button onClick={onClose}>关闭</Button>
      </Space>
      {showGenerate && (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <Form labelPosition='left' labelWidth={120}>
            <Form.Input field='path' label='保存路径' value={genPath} onChange={setGenPath} placeholder='/secure/path/oauth2-private.pem' />
            <Form.Input field='genKid' label='自定义 KID' value={genKid} onChange={setGenKid} placeholder='可留空自动生成' />
          </Form>
          <div style={{ marginTop: 8 }}>
            <Button type='primary' onClick={generatePemFile} loading={loading}>生成并生效</Button>
          </div>
          <Divider margin='12px' />
          <Text type='tertiary'>建议：仅在合规要求下使用文件私钥。请确保目录权限安全（建议 0600），并妥善备份。</Text>
        </div>
      )}
      {showImport && (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <Form labelPosition='left' labelWidth={120}>
            <Form.Input field='kid' label='自定义 KID' placeholder='可留空自动生成' value={customKid} onChange={setCustomKid} />
            <Form.TextArea field='pem' label='PEM 私钥' value={pem} onChange={setPem} rows={6} placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'} />
          </Form>
          <div style={{ marginTop: 8 }}>
            <Button type='primary' onClick={importPem} loading={loading}>导入并生效</Button>
          </div>
          <Divider margin='12px' />
          <Text type='tertiary'>建议：优先使用内存签名密钥与 JWKS 轮换；仅在有合规要求时导入外部私钥。</Text>
        </div>
      )}
      <Table dataSource={keys} columns={columns} rowKey='kid' loading={loading} pagination={false} empty={<Text type='tertiary'>暂无密钥</Text>} />
    </Modal>
  );
}
