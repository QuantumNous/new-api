/*
Copyright (C) 2025 QuantumNous
*/
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Form, Row, Spin, Table, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';

export default function InviteRebateAdmin() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [inviterId, setInviterId] = useState('');
  const [inviteeId, setInviteeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { p: 1, page_size: 50 };
      if (inviterId) params.inviter_id = inviterId;
      if (inviteeId) params.invitee_id = inviteeId;
      const [s, list] = await Promise.all([
        API.get('/api/invite_rebate/summary', {
          params: inviterId ? { inviter_id: inviterId } : {},
        }),
        API.get('/api/invite_rebate/', { params }),
      ]);
      if (s.data?.success) setSummary(s.data.data);
      if (list.data?.success) setRows(list.data.data?.items || []);
    } catch (e) {
      showError(t('加载失败'));
    } finally {
      setLoading(false);
    }
  }, [inviteeId, inviterId, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className='p-4'>
      <Typography.Title heading={4}>{t('邀请充值返佣（管理）')}</Typography.Title>
      <Form layout='horizontal' className='mb-3'>
        <Form.Input field='inviter' label={t('邀请人ID')} value={inviterId} onChange={setInviterId} />
        <Form.Input field='invitee' label={t('被邀请人ID')} value={inviteeId} onChange={setInviteeId} />
        <Button onClick={load}>{t('筛选')}</Button>
      </Form>
      <Row gutter={12} className='mb-3'>
        <Col span={8}><Card title={t('记录数')}>{summary?.row_count ?? 0}</Card></Col>
        <Col span={8}><Card title={t('充值合计')}>{summary?.topup_quota_sum ?? 0}</Card></Col>
        <Col span={8}><Card title={t('返佣合计')}>{summary?.rebate_quota_sum ?? 0}</Card></Col>
      </Row>
      {loading ? (
        <Spin />
      ) : (
        <Table
          dataSource={rows}
          rowKey='id'
          pagination={false}
          columns={[
            { title: 'ID', dataIndex: 'id' },
            { title: t('邀请人'), dataIndex: 'inviter_id' },
            { title: t('被邀请人'), dataIndex: 'invitee_id' },
            { title: t('订单号'), dataIndex: 'trade_no' },
            { title: t('充值'), dataIndex: 'topup_quota' },
            { title: t('返佣'), dataIndex: 'rebate_quota' },
            {
              title: t('时间'),
              dataIndex: 'created_at',
              render: (v) => (v ? new Date(v * 1000).toLocaleString() : '-'),
            },
          ]}
        />
      )}
    </div>
  );
}
