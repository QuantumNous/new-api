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
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import { isAdmin } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import './TopupHistoryModal.css';
const { Text } = Typography;

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功', className: 'is-success' },
  pending: { type: 'warning', key: '待支付', className: 'is-pending' },
  failed: { type: 'danger', key: '失败', className: 'is-failed' },
  expired: { type: 'danger', key: '已过期', className: 'is-expired' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
};

function maskMiddle(str, keepStart = 6, keepEnd = 4, mask = '***') {
  if (str.length <= keepStart + keepEnd) return str;
  return str.slice(0, keepStart) + mask + str.slice(-keepEnd);
}

const TopupHistoryModal = ({ visible, onCancel, t }) => {
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const isMobile = useIsMobile();
  const { symbol } = getCurrencyConfig();
  const getCurrencySymbolForRecord = (currency) => {
    if (currency === 'USD') return '$';
    if (currency === 'CNY') return '¥';
    return currency || symbol;
  };
  const formatCurrencyAmount = (currencySymbol, amount) => {
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount)) {
      return `${currencySymbol}0.00`;
    }
    return `${currencySymbol}${numericAmount.toFixed(2)}`;
  };

  const getFallbackHistoryMoney = (money) => {
    return formatCurrencyAmount(symbol, money);
  };

  const getRecordDisplayMoney = (record) => {
    const displayAmount = Number(record?.display_amount || 0);
    const displayCurrency = record?.display_currency || '';
    if (
      displayCurrency &&
      Number.isFinite(displayAmount) &&
      displayAmount > 0
    ) {
      return formatCurrencyAmount(
        getCurrencySymbolForRecord(displayCurrency),
        displayAmount,
      );
    }
    return getFallbackHistoryMoney(record?.money);
  };

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
        setTopups(
          (data.items || []).map((e) => ({
            ...e,
            trade_no_show: maskMiddle(e.trade_no),
          })),
        );
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
    if (visible) {
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
    const config = STATUS_CONFIG[status] || {
      type: 'primary',
      key: status,
      className: 'is-default',
    };
    return (
      <span className={`topup-history-status ${config.className}`}>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return (
      <span className='topup-history-method-chip'>
        {displayName ? t(displayName) : pm || '-'}
      </span>
    );
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  // 检查是否为管理员
  const userIsAdmin = useMemo(() => isAdmin(), []);

  const columns = useMemo(() => {
    const baseColumns = [
      ...(userIsAdmin
        ? [
            {
              title: t('用户ID'),
              dataIndex: 'user_id',
              key: 'user_id',
              render: (userId) => <Text>{userId ?? '-'}</Text>,
            },
          ]
        : []),
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text, record) => (
          <div className='topup-history-order-cell'>
            <Text
              className='topup-history-order-code'
              copyable={{ content: text }}
            >
              {record.trade_no_show}
            </Text>
          </div>
        ),
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
              <Tag
                color='white'
                shape='circle'
                type='light'
                size='small'
                className='topup-history-subscription-tag'
              >
                {t('订阅套餐')}
              </Tag>
            );
          }
          return (
            <span className='topup-history-amount'>
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
        render: (_, record) => (
          <Text className='topup-history-money'>
            {getRecordDisplayMoney(record)}
          </Text>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        render: renderStatusBadge,
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
                className='topup-history-action-button'
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
      render: (time) => (
        <span className='topup-history-time'>{timestamp2string(time)}</span>
      ),
    });

    return baseColumns;
  }, [t, userIsAdmin]);

  const shouldShowPagination = total > pageSize;
  const paginationConfig = shouldShowPagination
    ? {
        currentPage: page,
        pageSize: pageSize,
        total: total,
        showSizeChanger: true,
        pageSizeOpts: [10, 20, 50, 100],
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }
    : false;

  return (
    <Modal
      title={t('充值账单')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size={isMobile ? 'full-width' : 'large'}
      className='topup-history-modal'
    >
      <div className='topup-history-toolbar'>
        <Input
          prefix={<IconSearch />}
          placeholder={t('订单号')}
          value={keyword}
          onChange={handleKeywordChange}
          showClear
          className='topup-history-search'
        />
      </div>
      <Table
        columns={columns}
        dataSource={topups}
        loading={loading}
        rowKey='id'
        pagination={paginationConfig}
        size='small'
        className='topup-history-table'
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
    </Modal>
  );
};

export default TopupHistoryModal;
