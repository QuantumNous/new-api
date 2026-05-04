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
import { Coins } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../../helpers';
import { isAdmin } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

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
    const config = INVOICE_STATUS_CONFIG[invoiceStatus] || INVOICE_STATUS_CONFIG.none;
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
                  <div><Text type='tertiary' size='small'>ID: {userId}</Text></div>
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
            <span className='flex items-center gap-1'>
              <Coins size={16} />
              <Text>{amount}</Text>
            </span>
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
          const amount = record.pre_tax_money || (record.money - (record.tax_amount || 0));
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
            const amount = record.pre_tax_money || (record.money - (record.tax_amount || 0));
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
                key="complete"
                size='small'
                type='primary'
                theme='outline'
                onClick={() => confirmAdminComplete(record.trade_no)}
              >
                {t('补单')}
              </Button>
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
              {t('可开票额度')}：¥{(selectedTopUp.include_tax
                ? (selectedTopUp.pre_tax_money || selectedTopUp.money - (selectedTopUp.tax_amount || 0))
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

  if (asPage) {
    return tableContent;
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
