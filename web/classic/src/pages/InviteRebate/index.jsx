/*
Copyright (C) 2025 QuantumNous
*/
import React, { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Card, Col, Form, Row, Spin, Table, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

export default function InviteRebate() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [invitees, setInvitees] = useState([]);
  const [transferQuota, setTransferQuota] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, i] = await Promise.all([
        API.get('/api/user/invite_rebate/summary'),
        API.get('/api/user/invite_rebate/logs', { params: { p: 1, page_size: 50 } }),
        API.get('/api/user/invite_rebate/invitees', { params: { p: 1, page_size: 50 } }),
      ]);
      if (s.data?.success) setSummary(s.data.data);
      if (l.data?.success) setLogs(l.data.data?.items || []);
      if (i.data?.success) setInvitees(i.data.data?.items || []);
    } catch (e) {
      showError(t('加载失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const doTransfer = async () => {
    const quota = parseInt(transferQuota, 10);
    if (!quota || quota <= 0) {
      showError(t('请输入有效额度'));
      return;
    }
    try {
      const res = await API.post('/api/user/aff_transfer', { quota });
      if (res.data?.success) {
        showSuccess(res.data.message || t('转移成功'));
        setTransferQuota('');
        load();
      } else {
        showError(res.data?.message || t('转移失败'));
      }
    } catch (e) {
      showError(t('转移失败'));
    }
  };

  if (loading && !summary) return <Spin />;

  return (
    <div className='p-4'>
      <Typography.Title heading={4}>{t('邀请充值返佣')}</Typography.Title>
      {!summary?.enabled && (
        <Banner type='warning' description={t('管理员尚未开启充值返佣')} className='mb-3' />
      )}
      <Row gutter={12} className='mb-3'>
        <Col span={6}><Card title={t('邀请人数')}>{summary?.invitee_count ?? 0}</Card></Col>
        <Col span={6}><Card title={t('下级充值额度')}>{summary?.topup_quota_sum ?? 0}</Card></Col>
        <Col span={6}><Card title={t('累计返佣')}>{summary?.rebate_quota_sum ?? 0}</Card></Col>
        <Col span={6}><Card title={t('待提取')}>{summary?.aff_quota ?? 0}</Card></Col>
      </Row>
      <Form layout='horizontal' className='mb-4'>
        <Form.Input
          field='quota'
          label={t('提取额度')}
          value={transferQuota}
          onChange={setTransferQuota}
        />
        <Button theme='solid' onClick={doTransfer}>{t('提取到余额')}</Button>
      </Form>
      <Typography.Title heading={5}>{t('返佣明细')}</Typography.Title>
      <Table
        className='mb-4'
        dataSource={logs}
        rowKey='id'
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id' },
          { title: t('被邀请人'), dataIndex: 'invitee_id' },
          { title: t('订单号'), dataIndex: 'trade_no' },
          { title: t('充值额度'), dataIndex: 'topup_quota' },
          { title: t('返佣额度'), dataIndex: 'rebate_quota' },
          {
            title: t('时间'),
            dataIndex: 'created_at',
            render: (v) => (v ? new Date(v * 1000).toLocaleString() : '-'),
          },
        ]}
      />
      <Typography.Title heading={5}>{t('被邀请人')}</Typography.Title>
      <Table
        dataSource={invitees}
        rowKey='invitee_id'
        pagination={false}
        columns={[
          { title: t('用户'), dataIndex: 'username' },
          { title: t('充值合计'), dataIndex: 'topup_quota_sum' },
          { title: t('返佣合计'), dataIndex: 'rebate_quota_sum' },
          { title: t('笔数'), dataIndex: 'rebate_count' },
        ]}
      />
    </div>
  );
}
