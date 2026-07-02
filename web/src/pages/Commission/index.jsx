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
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Select,
  Typography,
  Tabs,
  TabPane,
  Space,
  Empty,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { API, showError, showSuccess } from '../../helpers';
import {
  ArrowUpRight,
  Banknote,
  Gift,
  Link2,
  ReceiptText,
  Users,
  WalletCards,
} from 'lucide-react';

const { Text, Title } = Typography;

const Commission = () => {
  const { t } = useTranslation();

  // Summary
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [notice, setNotice] = useState('');

  // Commission records
  const [commissions, setCommissions] = useState([]);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionLoading, setCommissionLoading] = useState(false);

  // Withdrawal records
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalTotal, setWithdrawalTotal] = useState(0);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // Withdrawal form
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState('balance');

  // Invite link
  const [affLink, setAffLink] = useState('');

  const pageSize = 10;

  // Fetch summary
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await API.get('/api/user/commission/summary');
      if (res.data?.success) {
        setSummary(res.data.data);
        setNotice(res.data.notice || '');
      } else {
        showError(res.data?.message || t('获取返佣概览失败'));
      }
    } catch (e) {
      showError(t('获取返佣概览失败'));
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fetch commission records
  const fetchCommissions = async (page = 1) => {
    setCommissionLoading(true);
    try {
      const res = await API.get(
        `/api/user/commission/records?page=${page}&page_size=${pageSize}`,
      );
      if (res.data?.success) {
        setCommissions(res.data.data?.list || []);
        setCommissionTotal(res.data.data?.total || 0);
      }
    } catch (e) {
      showError(t('获取返佣记录失败'));
    } finally {
      setCommissionLoading(false);
    }
  };

  // Fetch withdrawal records
  const fetchWithdrawals = async (page = 1) => {
    setWithdrawalLoading(true);
    try {
      const res = await API.get(
        `/api/user/commission/withdrawals?page=${page}&page_size=${pageSize}`,
      );
      if (res.data?.success) {
        setWithdrawals(res.data.data?.list || []);
        setWithdrawalTotal(res.data.data?.total || 0);
      }
    } catch (e) {
      showError(t('获取提现记录失败'));
    } finally {
      setWithdrawalLoading(false);
    }
  };

  // Fetch invite link
  const fetchAffLink = async () => {
    try {
      const res = await API.get('/api/user/aff');
      if (res.data?.success) {
        setAffLink(`${window.location.origin}/register?aff=${res.data.data}`);
      }
    } catch (e) {
      // ignore
    }
  };

  // Submit withdrawal
  const handleWithdraw = async (values) => {
    const maxYuan = summary ? summary.commission_balance / 100 : 0;
    if (values.amount > maxYuan) {
      showError(t('提现金额不能超过可提现余额'));
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const res = await API.post('/api/user/commission/withdraw', {
        amount: Math.round(values.amount * 100), // convert yuan to fen
        method: values.method,
        account: values.account_type
          ? `[${values.account_type}] ${values.account}`
          : values.account || '',
      });
      if (res.data?.success) {
        showSuccess(res.data.message || t('提现申请已提交'));
        setWithdrawModalVisible(false);
        fetchSummary();
        fetchWithdrawals(1);
        setWithdrawalPage(1);
      } else {
        showError(res.data?.message || t('提现申请失败'));
      }
    } catch (e) {
      showError(t('提现申请失败'));
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchCommissions(1);
    fetchWithdrawals(1);
    fetchAffLink();
  }, []);

  // Format fen to yuan
  const formatMoney = (fen) => {
    if (fen === undefined || fen === null) return '0.00';
    return (fen / 100).toFixed(2);
  };

  // Commission type tag
  const renderCommissionType = (type) => {
    const map = {
      1: { text: t('充值返佣'), color: 'blue' },
      2: { text: t('高价值奖励'), color: 'orange' },
      3: { text: t('手动发放'), color: 'purple' },
    };
    const info = map[type] || { text: t('未知'), color: 'grey' };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  // Withdrawal status tag
  const renderWithdrawalStatus = (status) => {
    const map = {
      pending: { text: t('待审核'), color: 'orange' },
      approved: { text: t('已通过'), color: 'green' },
      rejected: { text: t('已拒绝'), color: 'red' },
    };
    const info = map[status] || { text: status, color: 'grey' };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  // Withdrawal method tag
  const renderWithdrawalMethod = (method) => {
    const map = {
      balance: t('转入余额'),
      cash: t('现金提现'),
    };
    return map[method] || method;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const commissionColumns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (val) => formatTime(val),
      width: 180,
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      render: (val) => renderCommissionType(val),
      width: 120,
    },
    {
      title: t('充值金额'),
      dataIndex: 'top_up_money',
      render: (val) => (val ? `¥${Number(val).toFixed(2)}` : '-'),
      width: 120,
    },
    {
      title: t('佣金金额'),
      dataIndex: 'commission_amount',
      render: (val) => (
        <Text strong style={{ color: 'var(--semi-color-success)' }}>
          {t('¥')}
          {formatMoney(val)}
        </Text>
      ),
      width: 120,
    },
    {
      title: t('来源用户'),
      dataIndex: 'from_username',
      render: (val) => val || '-',
      width: 120,
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      render: (val) => val || '-',
    },
  ];

  const withdrawalColumns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (val) => formatTime(val),
      width: 180,
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      render: (val) => (
        <Text strong>
          {t('¥')}
          {formatMoney(val)}
        </Text>
      ),
      width: 120,
    },
    {
      title: t('方式'),
      dataIndex: 'method',
      render: (val) => renderWithdrawalMethod(val),
      width: 120,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (val) => renderWithdrawalStatus(val),
      width: 100,
    },
    {
      title: t('提现账号'),
      dataIndex: 'account',
      render: (val) => val || '-',
      width: 150,
    },
    {
      title: t('管理员备注'),
      dataIndex: 'admin_remark',
      render: (val) => val || '-',
    },
  ];

  const renderMetricRow = (Icon, label, value, options = {}) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '22px 24px',
        borderBottom: options.last ? 0 : '1px solid rgba(15, 23, 42, 0.12)',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 8,
            color: '#475569',
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          <Icon size={16} />
          {label}
        </div>
        <div
          style={{
            color: options.accent ? '#0f766e' : '#0f172a',
            fontSize: 31,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: '-0.055em',
          }}
        >
          {value}
        </div>
      </div>
      <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '82px 24px 36px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Card
          loading={summaryLoading}
          bodyStyle={{ padding: 0 }}
          style={{
            marginBottom: 26,
            borderRadius: 30,
            overflow: 'hidden',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            background: '#ffffff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
              minHeight: 276,
            }}
          >
            <div
              style={{
                padding: '34px 36px 32px',
                borderRight: '1px solid rgba(15, 23, 42, 0.08)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 18,
                  marginBottom: 30,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 14,
                      color: '#0f172a',
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    <Gift size={18} />
                    {t('返佣资金总览')}
                  </div>
                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: 44,
                      lineHeight: 1.05,
                      letterSpacing: '-0.07em',
                      fontWeight: 900,
                    }}
                  >
                    {t('返佣管理')}
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0f172a',
                    background: '#f8fafc',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                  }}
                >
                  <WalletCards size={21} />
                </div>
              </div>

              <Text
                style={{
                  display: 'block',
                  maxWidth: 540,
                  color: '#475569',
                  fontSize: 16,
                  lineHeight: 1.7,
                  letterSpacing: '-0.02em',
                }}
              >
                {t(
                  '管理邀请返佣、提现申请与返佣流水，清晰追踪可提现余额和累计收益。',
                )}
              </Text>
              {notice && (
                <div
                  style={{
                    marginTop: 64,
                    maxWidth: 560,
                    padding: '18px 20px',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.82)',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.04)',
                    color: '#334155',
                    lineHeight: 1.7,
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        notice.trim().startsWith('<')
                          ? notice
                          : marked.parse(notice),
                      ),
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{ display: 'grid', background: '#f8fafc', padding: 12 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: '1fr 1fr 1fr 1fr',
                  background: '#ffffff',
                }}
              >
                {renderMetricRow(
                  WalletCards,
                  t('可提现余额'),
                  <>
                    {t('¥')}
                    {formatMoney(summary?.commission_balance)}
                  </>,
                  { accent: true },
                )}
                {renderMetricRow(
                  Banknote,
                  t('佣金总额'),
                  <>
                    {t('¥')}
                    {formatMoney(summary?.commission_total)}
                  </>,
                )}
                {renderMetricRow(
                  ReceiptText,
                  t('已提现'),
                  <>
                    {t('¥')}
                    {formatMoney(summary?.commission_withdrawn)}
                  </>,
                )}
                {renderMetricRow(
                  Users,
                  t('邀请人数'),
                  summary?.invite_count ?? 0,
                  { last: true },
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Invite Link & Withdraw Button */}
        <Card
          bodyStyle={{ padding: 0 }}
          style={{
            marginBottom: 26,
            borderRadius: 28,
            overflow: 'hidden',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            background: '#ffffff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 18,
              padding: '22px 24px',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  marginBottom: 10,
                  color: '#0f172a',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                <Link2 size={17} />
                {t('邀请链接')}
              </div>
              <div>
                {affLink ? (
                  <Space>
                    <Text
                      copyable={{ content: affLink, successTip: t('已复制') }}
                      style={{
                        wordBreak: 'break-all',
                        fontSize: '13px',
                        color: '#64748b',
                      }}
                    >
                      {affLink}
                    </Text>
                  </Space>
                ) : (
                  <Text type='tertiary'>{t('加载中...')}</Text>
                )}
              </div>
            </div>
            <Button
              theme='solid'
              type='primary'
              onClick={() => setWithdrawModalVisible(true)}
              disabled={!summary || summary.commission_balance <= 0}
              style={{
                borderRadius: 999,
                background: '#0f766e',
                borderColor: '#0f766e',
                fontWeight: 800,
                padding: '0 22px',
              }}
            >
              {t('申请提现')}
            </Button>
          </div>
        </Card>

        {/* Tabs: Commission Records & Withdrawal Records */}
        <Card
          bodyStyle={{ padding: 20 }}
          style={{
            borderRadius: 28,
            border: '1px solid rgba(15, 23, 42, 0.08)',
            background: '#ffffff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.05)',
            overflow: 'hidden',
          }}
        >
          <Tabs type='line'>
            <TabPane tab={t('返佣记录')} itemKey='commissions'>
              <Table
                columns={commissionColumns}
                dataSource={commissions}
                loading={commissionLoading}
                pagination={{
                  currentPage: commissionPage,
                  pageSize: pageSize,
                  total: commissionTotal,
                  onPageChange: (page) => {
                    setCommissionPage(page);
                    fetchCommissions(page);
                  },
                }}
                empty={<Empty description={t('暂无返佣记录')} />}
                size='middle'
              />
            </TabPane>
            <TabPane tab={t('提现记录')} itemKey='withdrawals'>
              <Table
                columns={withdrawalColumns}
                dataSource={withdrawals}
                loading={withdrawalLoading}
                pagination={{
                  currentPage: withdrawalPage,
                  pageSize: pageSize,
                  total: withdrawalTotal,
                  onPageChange: (page) => {
                    setWithdrawalPage(page);
                    fetchWithdrawals(page);
                  },
                }}
                empty={<Empty description={t('暂无提现记录')} />}
                size='middle'
              />
            </TabPane>
          </Tabs>
        </Card>

        {/* Withdrawal Modal */}
        <Modal
          title={t('申请提现')}
          visible={withdrawModalVisible}
          onCancel={() => {
            setWithdrawModalVisible(false);
            setWithdrawMethod('balance');
          }}
          footer={null}
          maskClosable={false}
          centered
        >
          <Form onSubmit={handleWithdraw} labelPosition='top'>
            <Form.InputNumber
              field='amount'
              label={t('提现金额（元）')}
              placeholder={t('请输入提现金额')}
              min={0.01}
              max={summary ? summary.commission_balance / 100 : 0}
              precision={2}
              step={1}
              rules={[{ required: true, message: t('请输入提现金额') }]}
              style={{ width: '100%' }}
              extraText={
                <span style={{ color: 'var(--semi-color-text-2)' }}>
                  {t('可提现余额')}：
                  <span
                    style={{
                      color: 'var(--semi-color-success)',
                      fontWeight: 600,
                    }}
                  >
                    {t('¥')}
                    {formatMoney(summary?.commission_balance)}
                  </span>
                </span>
              }
            />
            <Form.Select
              field='method'
              label={t('提现方式')}
              placeholder={t('请选择提现方式')}
              rules={[{ required: true, message: t('请选择提现方式') }]}
              style={{ width: '100%' }}
              initValue='balance'
              onChange={(val) => setWithdrawMethod(val)}
            >
              <Select.Option value='balance'>{t('转入余额')}</Select.Option>
              <Select.Option value='cash'>{t('现金提现')}</Select.Option>
            </Form.Select>
            {withdrawMethod === 'cash' && (
              <>
                <Form.Select
                  field='account_type'
                  label={t('收款方式')}
                  placeholder={t('请选择收款方式')}
                  rules={[{ required: true, message: t('请选择收款方式') }]}
                  style={{ width: '100%' }}
                >
                  <Select.Option value='支付宝'>{t('支付宝')}</Select.Option>
                  <Select.Option value='银行卡'>{t('银行卡')}</Select.Option>
                </Form.Select>
                <Form.Input
                  field='account'
                  label={t('收款账号')}
                  placeholder={t('请输入收款账号')}
                  rules={[{ required: true, message: t('请填写收款账号') }]}
                  style={{ width: '100%' }}
                />
              </>
            )}
            <div className='mt-4 mb-2' style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setWithdrawModalVisible(false)}>
                  {t('取消')}
                </Button>
                <Button
                  theme='solid'
                  type='primary'
                  htmlType='submit'
                  loading={withdrawSubmitting}
                >
                  {t('提交申请')}
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default Commission;
