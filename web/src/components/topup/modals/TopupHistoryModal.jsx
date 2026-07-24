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
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Input,
  Tag,
  Form,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  ArrowUpRight,
  Coins,
  FileText,
  ReceiptText,
  Search,
} from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../../helpers';
import { isAdmin } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import {
  quotaToDisplayAmount,
} from '../../../helpers/quota';

const { Text } = Typography;

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待支付' },
  failed: { type: 'danger', key: '失败' },
  expired: { type: 'danger', key: '已过期' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
};

// 开票状态映射
const INVOICE_STATUS_CONFIG = {
  none: { color: 'grey', key: '未申请' },
  pending: { color: 'orange', key: '待开票' },
  issued: { color: 'green', key: '已开票' },
  rejected: { color: 'red', key: '已拒绝' },
};

const TopupHistoryModal = ({ visible, onCancel, t, asPage = false }) => {
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const isMobile = useIsMobile();

  // 开票申请弹窗
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [selectedTopUp, setSelectedTopUp] = useState(null);
  const invoiceFormRef = React.useRef();

  const loadTopups = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      const base = isAdmin() ? '/api/user/topup' : '/api/user/topup/self';
      const qs =
        `p=${currentPage}&page_size=${currentPageSize}` +
        (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '');
      const endpoint = `${base}?${qs}`;
      const res = await API.get(endpoint);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载账单失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (asPage || visible) {
      loadTopups(page, pageSize);
    }
  }, [visible, page, pageSize, keyword]);

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleKeywordChange = (value) => {
    setKeyword(value);
    setPage(1);
  };

  // 管理员补单
  const handleAdminComplete = async (tradeNo) => {
    try {
      const res = await API.post('/api/user/topup/complete', {
        trade_no: tradeNo,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('补单成功') });
        await loadTopups(page, pageSize);
      } else {
        Toast.error({ content: message || t('补单失败') });
      }
    } catch (e) {
      Toast.error({ content: t('补单失败') });
    }
  };

  const confirmAdminComplete = (tradeNo) => {
    Modal.confirm({
      title: t('确认补单'),
      content: t('是否将该订单标记为成功并为用户入账？'),
      onOk: () => handleAdminComplete(tradeNo),
    });
  };

  // 渲染状态徽章
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { type: 'primary', key: status };
    return (
      <span className='flex items-center gap-2'>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <Text>{displayName ? t(displayName) : pm || '-'}</Text>;
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  // 检查是否为管理员
  const userIsAdmin = useMemo(() => isAdmin(), []);

  const pageSummary = useMemo(() => {
    return topups.reduce(
      (summary, record) => {
        if (record.status === 'success') {
          const money = Number(record.money || 0);
          summary.successCount += 1;
          summary.successAmount += Number.isFinite(money) ? money : 0;

          if (record.include_tax) {
            const invoiceable = Number(
              record.pre_tax_money || record.money - (record.tax_amount || 0),
            );
            summary.invoiceableAmount += Number.isFinite(invoiceable)
              ? Math.max(invoiceable, 0)
              : 0;
          }
        }
        return summary;
      },
      { successCount: 0, successAmount: 0, invoiceableAmount: 0 },
    );
  }, [topups]);

  // 打开开票申请弹窗
  const openInvoiceModal = (record) => {
    setSelectedTopUp(record);
    setInvoiceModalVisible(true);
  };

  // 提交开票申请
  const submitInvoice = async (values) => {
    if (!selectedTopUp) return;
    setInvoiceSubmitting(true);
    try {
      const res = await API.post('/api/user/invoice', {
        topup_id: selectedTopUp.id,
        invoice_title: values.invoice_title,
        tax_number: values.tax_number || '',
        email: values.email,
        remark: values.remark || '',
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('开票申请已提交') });
        setInvoiceModalVisible(false);
        setSelectedTopUp(null);
        await loadTopups(page, pageSize);
      } else {
        Toast.error({ content: message || t('申请失败') });
      }
    } catch (e) {
      Toast.error({ content: t('申请失败') });
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  // 渲染开票状态
  const renderInvoiceStatus = (invoiceStatus, record) => {
    const config =
      INVOICE_STATUS_CONFIG[invoiceStatus] || INVOICE_STATUS_CONFIG.none;
    return (
      <Tag color={config.color} size='small'>
        {t(config.key)}
      </Tag>
    );
  };

  const columns = useMemo(() => {
    const baseColumns = [
      ...(userIsAdmin
        ? [
            {
              title: t('用户'),
              dataIndex: 'user_id',
              key: 'user_id',
              render: (userId, record) => (
                <div>
                  <Text>{record.username || '-'}</Text>
                  <div>
                    <Text type='tertiary' size='small'>
                      ID: {userId}
                    </Text>
                  </div>
                </div>
              ),
            },
          ]
        : []),
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text) => <Text copyable>{text}</Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        render: (amount, record) => {
          if (isSubscriptionTopup(record)) {
            return (
              <Tag color='purple' shape='circle' size='small'>
                {t('订阅套餐')}
              </Tag>
            );
          }
          return (
            <div>
              <span className='flex items-center gap-1'>
                <Coins size={16} />
                <Text>{amount}</Text>
              </span>
              {(() => {
                const gift = record.expected_gift || record.gift;
                if (!gift || gift <= 0) return null;
                return (
                  <div>
                    <Text
                      type='success'
                      size='small'
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      + {t('赠送')} ${Number(
                        quotaToDisplayAmount(gift).toFixed(2),
                      )}
                    </Text>
                  </div>
                );
              })()}
            </div>
          );
        },
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        render: (money, record) => (
          <div>
            <Text type='danger'>¥{money.toFixed(2)}</Text>
            {record.include_tax && record.tax_amount > 0 && (
              <div>
                <Text type='tertiary' size='small'>
                  {t('含服务费')} ¥{record.tax_amount.toFixed(2)}
                </Text>
              </div>
            )}
          </div>
        ),
      },
      {
        title: t('可开票额度'),
        key: 'invoiceable_amount',
        render: (_, record) => {
          if (!record.include_tax) return <Text type='tertiary'>¥0.00</Text>;
          const amount =
            record.pre_tax_money || record.money - (record.tax_amount || 0);
          return <Text>¥{amount.toFixed(2)}</Text>;
        },
      },
      {
        title: t('已开票额度'),
        key: 'invoiced_amount',
        render: (_, record) => {
          if (!record.include_tax) return <Text type='tertiary'>¥0.00</Text>;
          const status = record.invoice_status || 'none';
          if (status === 'issued') {
            const amount =
              record.pre_tax_money || record.money - (record.tax_amount || 0);
            return <Text type='success'>¥{amount.toFixed(2)}</Text>;
          }
          return <Text type='tertiary'>¥0.00</Text>;
        },
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        render: renderStatusBadge,
      },
      {
        title: t('开票'),
        dataIndex: 'invoice_status',
        key: 'invoice_status',
        render: (invoiceStatus, record) => {
          if (record.status !== 'success') return '-';
          if (!record.include_tax) return '-';
          const status = invoiceStatus || 'none';
          if (status === 'none' || status === 'rejected') {
            return (
              <div>
                <Button
                  size='small'
                  theme='outline'
                  onClick={() => openInvoiceModal(record)}
                >
                  {status === 'rejected' ? t('重新申请') : t('申请开票')}
                </Button>
                {status === 'rejected' && record.invoice_admin_remark && (
                  <div style={{ marginTop: 4 }}>
                    <Text type='danger' size='small'>
                      {record.invoice_admin_remark}
                    </Text>
                  </div>
                )}
              </div>
            );
          }
          return renderInvoiceStatus(status, record);
        },
      },
    ];

    // 管理员才显示操作列
    if (userIsAdmin) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        render: (_, record) => {
          const actions = [];
          if (record.status === 'pending') {
            actions.push(
              <Button
                key='complete'
                size='small'
                type='primary'
                theme='outline'
                onClick={() => confirmAdminComplete(record.trade_no)}
              >
                {t('补单')}
              </Button>,
            );
          }
          return actions.length > 0 ? <>{actions}</> : null;
        },
      });
    }

    baseColumns.push({
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    });

    return baseColumns;
  }, [t, userIsAdmin]);

  const tableNode = (
    <Table
      columns={columns}
      dataSource={topups}
      loading={loading}
      rowKey='id'
      pagination={{
        currentPage: page,
        pageSize: pageSize,
        total: total,
        showSizeChanger: true,
        pageSizeOpts: [10, 20, 50, 100],
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
      size='small'
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('暂无充值记录')}
          style={{ padding: 30 }}
        />
      }
    />
  );

  const invoiceModalNode = (
    <>
      {/* 开票申请弹窗 */}
      <Modal
        title={t('申请开票')}
        visible={invoiceModalVisible}
        onCancel={() => {
          setInvoiceModalVisible(false);
          setSelectedTopUp(null);
        }}
        onOk={() => invoiceFormRef.current?.submitForm()}
        confirmLoading={invoiceSubmitting}
        maskClosable={false}
        size='small'
        centered
      >
        {selectedTopUp && (
          <div className='mb-4'>
            <Text type='secondary'>
              {t('订单号')}：{selectedTopUp.trade_no}
            </Text>
            <br />
            <Text type='secondary'>
              {t('支付金额')}：¥{selectedTopUp.money?.toFixed(2)}
            </Text>
            {selectedTopUp.include_tax && selectedTopUp.tax_amount > 0 && (
              <>
                <br />
                <Text type='secondary'>
                  {t('其中服务费')}：¥{selectedTopUp.tax_amount?.toFixed(2)}
                </Text>
              </>
            )}
            <br />
            <Text strong>
              {t('可开票额度')}：¥
              {(selectedTopUp.include_tax
                ? selectedTopUp.pre_tax_money ||
                  selectedTopUp.money - (selectedTopUp.tax_amount || 0)
                : 0
              ).toFixed(2)}
            </Text>
          </div>
        )}
        <Form
          getFormApi={(api) => (invoiceFormRef.current = api)}
          onSubmit={submitInvoice}
        >
          <Form.Input
            field='invoice_title'
            label={t('发票抬头')}
            rules={[{ required: true, message: t('请填写发票抬头') }]}
            placeholder={t('请输入公司名称')}
          />
          <Form.Input
            field='tax_number'
            label={t('税号')}
            placeholder={t('选填')}
          />
          <Form.Input
            field='email'
            label={t('接收邮箱')}
            rules={[{ required: true, message: t('请填写接收邮箱') }]}
            placeholder={t('发票将发送至此邮箱')}
          />
          <Form.TextArea
            field='remark'
            label={t('备注')}
            placeholder={t('选填')}
            rows={2}
          />
        </Form>
      </Modal>
    </>
  );

  const tableContent = (
    <>
      <div className='mb-3'>
        <Input
          prefix={<IconSearch />}
          placeholder={t('订单号')}
          value={keyword}
          onChange={handleKeywordChange}
          showClear
        />
      </div>
      {tableNode}
      {invoiceModalNode}
    </>
  );

  if (asPage) {
    return (
      <>
        <div
          className='console-finance-hero-card'
          style={{
            marginBottom: 26,
            borderRadius: 30,
            overflow: 'hidden',
            border: '1px solid var(--console-border)',
            background: 'var(--console-card-bg)',
            boxShadow: 'var(--console-shadow)',
          }}
        >
          <div
            className='console-finance-hero-grid'
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
              minHeight: 236,
            }}
          >
            <div
              className='console-finance-hero-main'
              style={{
                padding: '34px 36px 32px',
                borderRight: '1px solid var(--console-border)',
                background: 'var(--console-card-gradient)',
              }}
            >
              <div
                className='console-finance-hero-head'
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
                    className='console-finance-hero-eyebrow'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 14,
                      color: 'var(--console-text-strong)',
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    <ReceiptText size={18} />
                    {t('充值资金流水')}
                  </div>
                  <div
                    className='console-finance-hero-title'
                    style={{
                      color: 'var(--console-text-strong)',
                      fontSize: 44,
                      lineHeight: 1.05,
                      letterSpacing: '-0.07em',
                      fontWeight: 900,
                    }}
                  >
                    {t('充值账单')}
                  </div>
                </div>
                <div
                  className='console-finance-hero-icon'
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--console-text-strong)',
                    background: 'var(--console-icon-bg)',
                    border: '1px solid var(--console-border)',
                  }}
                >
                  <FileText size={21} />
                </div>
              </div>

              <Text
                className='console-finance-hero-desc'
                style={{
                  display: 'block',
                  maxWidth: 520,
                  color: 'var(--console-text)',
                  fontSize: 16,
                  lineHeight: 1.7,
                  letterSpacing: '-0.02em',
                }}
              >
                {t(
                  '查看充值订单、支付状态与开票进度，成功订单可按规则发起开票申请。',
                )}
              </Text>
            </div>

            <div
              className='console-finance-hero-metrics'
              style={{
                display: 'grid',
                background: 'var(--console-card-muted-bg)',
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: '1fr 1fr 1fr',
                  background: 'var(--console-card-bg)',
                }}
              >
                <div
                  className='console-finance-hero-metric-row'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 18,
                    padding: '22px 24px',
                    borderBottom: '1px solid var(--console-border-strong)',
                  }}
                >
                  <div>
                    <div
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <ReceiptText size={16} />
                      {t('账单记录')}
                    </div>
                    <div
                      className='console-finance-hero-metric-value'
                      style={{
                        color: 'var(--console-text-strong)',
                        fontSize: 31,
                        lineHeight: 1,
                        fontWeight: 900,
                        letterSpacing: '-0.055em',
                      }}
                    >
                      {total}
                    </div>
                  </div>
                  <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
                </div>

                <div
                  className='console-finance-hero-metric-row'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 18,
                    padding: '22px 24px',
                    borderBottom: '1px solid var(--console-border-strong)',
                  }}
                >
                  <div>
                    <div
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <Coins size={16} />
                      {t('当前页成功金额')}
                    </div>
                    <div
                      className='console-finance-hero-metric-value'
                      style={{
                        color: 'var(--console-text-strong)',
                        fontSize: 31,
                        lineHeight: 1,
                        fontWeight: 900,
                        letterSpacing: '-0.055em',
                      }}
                    >
                      ¥{pageSummary.successAmount.toFixed(2)}
                    </div>
                  </div>
                  <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
                </div>

                <div
                  className='console-finance-hero-metric-row'
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '22px 24px',
                  }}
                >
                  <div>
                    <div
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <FileText size={16} />
                      {t('当前页可开票')}
                    </div>
                    <div
                      className='console-finance-hero-metric-value'
                      style={{
                        color: 'var(--console-text-strong)',
                        fontSize: 31,
                        lineHeight: 1,
                        fontWeight: 900,
                        letterSpacing: '-0.055em',
                      }}
                    >
                      ¥{pageSummary.invoiceableAmount.toFixed(2)}
                    </div>
                  </div>
                  <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 28,
            border: '1px solid var(--console-border)',
            background: 'var(--console-card-bg)',
            boxShadow: 'var(--console-shadow)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              padding: '18px 20px',
              borderBottom: '1px solid var(--console-border)',
              background: 'var(--console-card-bg)',
            }}
          >
            <div>
              <Text
                strong
                style={{
                  display: 'block',
                  color: 'var(--console-text-strong)',
                  fontSize: 16,
                  letterSpacing: '-0.02em',
                }}
              >
                {t('账单明细')}
              </Text>
              <Text
                style={{ color: 'var(--console-text-muted)', fontSize: 13 }}
              >
                {t('按订单号搜索充值和开票记录')}
              </Text>
            </div>
            <Input
              prefix={<Search size={16} />}
              placeholder={t('订单号')}
              value={keyword}
              onChange={handleKeywordChange}
              showClear
              style={{ width: isMobile ? '100%' : 320 }}
            />
          </div>
          <div style={{ padding: 20 }}>{tableNode}</div>
        </div>
        {invoiceModalNode}
      </>
    );
  }

  return (
    <Modal
      title={t('充值账单')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size={isMobile ? 'full-width' : 'large'}
    >
      {tableContent}
    </Modal>
  );
};

export default TopupHistoryModal;
