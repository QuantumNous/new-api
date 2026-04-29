import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Typography,
  Select,
  Space,
  Empty,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const CommissionWithdrawalManagement = () => {
  const { t } = useTranslation();

  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 10;

  // Approve/Reject modal
  const [actionModal, setActionModal] = useState({
    visible: false,
    type: '', // 'approve' or 'reject'
    withdrawal: null,
    remark: '',
    loading: false,
  });

  const fetchWithdrawals = async (p = 1, status = '') => {
    setLoading(true);
    try {
      let url = `/api/user/commission/all_withdrawals?page=${p}&page_size=${pageSize}`;
      if (status) {
        url += `&status=${status}`;
      }
      const res = await API.get(url);
      if (res.data?.success) {
        setWithdrawals(res.data.data?.list || []);
        setTotal(res.data.data?.total || 0);
      } else {
        showError(res.data?.message || t('获取提现记录失败'));
      }
    } catch (e) {
      showError(t('获取提现记录失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals(1, statusFilter);
  }, []);

  const formatMoney = (fen) => {
    if (fen === undefined || fen === null) return '0.00';
    return (fen / 100).toFixed(2);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderStatus = (status) => {
    const map = {
      pending: { text: t('待审核'), color: 'orange' },
      approved: { text: t('已通过'), color: 'green' },
      rejected: { text: t('已拒绝'), color: 'red' },
    };
    const info = map[status] || { text: status, color: 'grey' };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const renderMethod = (method) => {
    const map = {
      balance: t('转入余额'),
      cash: t('现金提现'),
    };
    return map[method] || method;
  };

  const handleAction = (type, withdrawal) => {
    setActionModal({
      visible: true,
      type,
      withdrawal,
      remark: '',
      loading: false,
    });
  };

  const submitAction = async () => {
    const { type, withdrawal, remark } = actionModal;
    setActionModal((prev) => ({ ...prev, loading: true }));

    try {
      const endpoint =
        type === 'approve'
          ? '/api/user/commission/withdrawal/approve'
          : '/api/user/commission/withdrawal/reject';
      const res = await API.post(endpoint, {
        id: withdrawal.id,
        admin_remark: remark,
      });
      if (res.data?.success) {
        showSuccess(
          type === 'approve' ? t('已通过提现申请') : t('已拒绝提现申请'),
        );
        setActionModal({ visible: false, type: '', withdrawal: null, remark: '', loading: false });
        fetchWithdrawals(page, statusFilter);
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch (e) {
      showError(t('操作失败'));
    } finally {
      setActionModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
      width: 80,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (val) => val || '-',
      width: 120,
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
      width: 100,
    },
    {
      title: t('方式'),
      dataIndex: 'method',
      render: (val) => renderMethod(val),
      width: 100,
    },
    {
      title: t('提现账号'),
      dataIndex: 'account',
      render: (val) => val || '-',
      width: 150,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (val) => renderStatus(val),
      width: 100,
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      render: (val) => formatTime(val),
      width: 180,
    },
    {
      title: t('处理时间'),
      dataIndex: 'processed_at',
      render: (val) => formatTime(val),
      width: 180,
    },
    {
      title: t('管理员备注'),
      dataIndex: 'admin_remark',
      render: (val) => val || '-',
      width: 150,
    },
    {
      title: t('操作'),
      dataIndex: 'action',
      fixed: 'right',
      width: 160,
      render: (_, record) => {
        if (record.status !== 'pending') return <Text type='tertiary'>-</Text>;
        return (
          <Space>
            <Button
              size='small'
              type='primary'
              theme='solid'
              onClick={() => handleAction('approve', record)}
            >
              {t('通过')}
            </Button>
            <Button
              size='small'
              type='danger'
              theme='solid'
              onClick={() => handleAction('reject', record)}
            >
              {t('拒绝')}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Select
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
            fetchWithdrawals(1, val);
          }}
          style={{ width: 150 }}
          placeholder={t('筛选状态')}
        >
          <Select.Option value=''>{t('全部')}</Select.Option>
          <Select.Option value='pending'>{t('待审核')}</Select.Option>
          <Select.Option value='approved'>{t('已通过')}</Select.Option>
          <Select.Option value='rejected'>{t('已拒绝')}</Select.Option>
        </Select>
        <Button
          onClick={() => fetchWithdrawals(page, statusFilter)}
        >
          {t('刷新')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={withdrawals}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          onPageChange: (p) => {
            setPage(p);
            fetchWithdrawals(p, statusFilter);
          },
        }}
        empty={<Empty description={t('暂无提现记录')} />}
        size='middle'
      />

      <Modal
        title={
          actionModal.type === 'approve'
            ? t('通过提现申请')
            : t('拒绝提现申请')
        }
        visible={actionModal.visible}
        onCancel={() =>
          setActionModal({
            visible: false,
            type: '',
            withdrawal: null,
            remark: '',
            loading: false,
          })
        }
        onOk={submitAction}
        confirmLoading={actionModal.loading}
        maskClosable={false}
        centered
      >
        {actionModal.withdrawal && (
          <div style={{ marginBottom: 16 }}>
            <p>
              {t('用户')}：{actionModal.withdrawal.username || actionModal.withdrawal.user_id}
            </p>
            <p>
              {t('金额')}：{t('¥')}{formatMoney(actionModal.withdrawal.amount)}
            </p>
            <p>
              {t('方式')}：{renderMethod(actionModal.withdrawal.method)}
            </p>
            {actionModal.withdrawal.account && (
              <p>
                {t('提现账号')}：{actionModal.withdrawal.account}
              </p>
            )}
          </div>
        )}
        <Input
          placeholder={t('管理员备注（可选）')}
          value={actionModal.remark}
          onChange={(val) =>
            setActionModal((prev) => ({ ...prev, remark: val }))
          }
        />
      </Modal>
    </div>
  );
};

export default CommissionWithdrawalManagement;
