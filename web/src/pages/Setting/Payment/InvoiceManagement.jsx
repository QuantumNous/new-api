import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Toast,
  Empty,
  Select,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, timestamp2string } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const INVOICE_STATUS_CONFIG = {
  pending: { color: 'orange', label: '待处理' },
  issued: { color: 'green', label: '已开票' },
  rejected: { color: 'red', label: '已拒绝' },
};

export default function InvoiceManagement() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');

  // 处理弹窗
  const [processVisible, setProcessVisible] = useState(false);
  const [processInvoice, setProcessInvoice] = useState(null);
  const [processStatus, setProcessStatus] = useState('issued');
  const [adminRemark, setAdminRemark] = useState('');
  const [processLoading, setProcessLoading] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      let qs = `p=${page}&page_size=${pageSize}`;
      if (statusFilter) {
        qs += `&status=${statusFilter}`;
      }
      const res = await API.get(`/api/user/invoice/all?${qs}`);
      const { success, message, data } = res.data;
      if (success) {
        setInvoices(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (e) {
      Toast.error({ content: t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [page, pageSize, statusFilter]);

  const openProcess = (record) => {
    setProcessInvoice(record);
    setProcessStatus('issued');
    setAdminRemark('');
    setProcessVisible(true);
  };

  const handleProcess = async () => {
    if (!processInvoice) return;
    setProcessLoading(true);
    try {
      const res = await API.post('/api/user/invoice/process', {
        id: processInvoice.id,
        status: processStatus,
        admin_remark: adminRemark,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('处理成功') });
        setProcessVisible(false);
        await loadInvoices();
      } else {
        Toast.error({ content: message || t('处理失败') });
      }
    } catch (e) {
      Toast.error({ content: t('处理失败') });
    } finally {
      setProcessLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80,
    },
    {
      title: t('订单号'),
      dataIndex: 'trade_no',
      key: 'trade_no',
      width: 180,
    },
    {
      title: t('开票金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount) => `¥${amount?.toFixed(2) || '0.00'}`,
    },
    {
      title: t('服务费'),
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      width: 100,
      render: (amount) => `¥${amount?.toFixed(2) || '0.00'}`,
    },
    {
      title: t('发票抬头'),
      dataIndex: 'invoice_title',
      key: 'invoice_title',
    },
    {
      title: t('税号'),
      dataIndex: 'tax_number',
      key: 'tax_number',
      width: 150,
    },
    {
      title: t('邮箱'),
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const config = INVOICE_STATUS_CONFIG[status] || {
          color: 'grey',
          label: status,
        };
        return (
          <Tag color={config.color} size='small'>
            {t(config.label)}
          </Tag>
        );
      },
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (time) => timestamp2string(time),
    },
    {
      title: t('操作'),
      key: 'action',
      width: 100,
      render: (_, record) => {
        if (record.status === 'pending') {
          return (
            <Button
              size='small'
              type='primary'
              theme='outline'
              onClick={() => openProcess(record)}
            >
              {t('处理')}
            </Button>
          );
        }
        return record.admin_remark ? (
          <Tag size='small'>{record.admin_remark}</Tag>
        ) : null;
      },
    },
  ];

  return (
    <div>
      <div className='mb-3 flex items-center gap-2'>
        <Select
          placeholder={t('筛选状态')}
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 150 }}
          showClear
        >
          <Select.Option value=''>{t('全部')}</Select.Option>
          <Select.Option value='pending'>{t('待处理')}</Select.Option>
          <Select.Option value='issued'>{t('已开票')}</Select.Option>
          <Select.Option value='rejected'>{t('已拒绝')}</Select.Option>
        </Select>
      </div>
      <Table
        columns={columns}
        dataSource={invoices}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        size='small'
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无开票申请')}
            style={{ padding: 30 }}
          />
        }
      />

      {/* 处理弹窗 */}
      <Modal
        title={t('处理开票申请')}
        visible={processVisible}
        onOk={handleProcess}
        onCancel={() => setProcessVisible(false)}
        confirmLoading={processLoading}
        maskClosable={false}
        size='small'
        centered
      >
        {processInvoice && (
          <div className='space-y-3'>
            <div>
              <strong>{t('发票抬头')}：</strong>
              {processInvoice.invoice_title}
            </div>
            <div>
              <strong>{t('税号')}：</strong>
              {processInvoice.tax_number || '-'}
            </div>
            <div>
              <strong>{t('邮箱')}：</strong>
              {processInvoice.email}
            </div>
            <div>
              <strong>{t('开票金额')}：</strong>¥
              {processInvoice.amount?.toFixed(2)}
            </div>
            {processInvoice.remark && (
              <div>
                <strong>{t('用户备注')}：</strong>
                {processInvoice.remark}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <Select
                value={processStatus}
                onChange={setProcessStatus}
                style={{ width: '100%' }}
                label={t('处理结果')}
              >
                <Select.Option value='issued'>{t('确认开票')}</Select.Option>
                <Select.Option value='rejected'>{t('拒绝')}</Select.Option>
              </Select>
            </div>
            <div style={{ marginTop: 12 }}>
              <Input
                value={adminRemark}
                onChange={setAdminRemark}
                placeholder={t('管理员备注（选填）')}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
