import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { ReceiptText } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const STATUS_TAGS = {
  1: { text: '待审核', color: 'orange' },
  2: { text: '已开具', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const TYPE_LABELS = {
  1: '增值税普通发票',
  2: '增值税专用发票',
};

// 金额一律以「分」整数与后端交互（docs/enterprise-features-design.md D1）。
// 整数部分限 10 位，避免超长输入越过 Number.MAX_SAFE_INTEGER 丢精度。
function yuanStringToFen(str) {
  const s = String(str ?? '').trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10);
}

function fenToYuanText(fen) {
  const n = parseInt(fen, 10);
  if (!Number.isFinite(n)) return '0.00';
  const whole = Math.trunc(n / 100);
  const frac = String(Math.abs(n % 100)).padStart(2, '0');
  return `${whole}.${frac}`;
}

// 由 base64 触发浏览器下载（PDF/图片通用）
function downloadBase64File(fileName, base64) {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  const blob = new Blob([buf]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'invoice';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const InvoiceCard = ({ userState }) => {
  const { t } = useTranslation();
  const [quotaInfo, setQuotaInfo] = useState(null); // { available_fen, company_name }
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState('');
  const [invoiceType, setInvoiceType] = useState(1);
  const [title, setTitle] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [email, setEmail] = useState('');
  const [remark, setRemark] = useState('');

  const enterpriseApproved = userState?.user?.enterprise_status === 2;

  const fetchQuota = async () => {
    try {
      const res = await API.get('/api/user/invoice/quota');
      if (res.data?.success) {
        const d = res.data.data || {};
        setQuotaInfo(d);
        // 默认填入用户上次提交的开票信息（按用户隔离、跨登录持久）；
        // 抬头优先用上次填写，其次回退企业认证公司名；不覆盖用户正在编辑的值。
        if (d.last_invoice_type) setInvoiceType(d.last_invoice_type);
        setTitle((prev) => prev || d.last_title || d.company_name || '');
        setTaxNo((prev) => prev || d.last_tax_no || '');
        setEmail(
          (prev) => prev || d.last_email || userState?.user?.email || '',
        );
      }
    } catch (_) {
      // 未认证/未开放时卡片不展示
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await API.get('/api/user/invoice/self?p=1&page_size=50');
      if (res.data?.success) {
        setInvoices(res.data.data || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!enterpriseApproved) return;
    setLoading(true);
    Promise.all([fetchQuota(), fetchInvoices()]).finally(() =>
      setLoading(false),
    );
  }, [enterpriseApproved]);

  if (!enterpriseApproved || quotaInfo === null) {
    return null;
  }

  const hasPending = invoices.some((i) => i.status === 1);
  const availableFen = quotaInfo.available_fen || 0;

  const submit = async () => {
    const fen = yuanStringToFen(amount);
    if (fen === null || fen <= 0) {
      showError(t('请输入有效的开票金额，最多两位小数'));
      return;
    }
    if (fen > availableFen) {
      showError(
        t('申请金额超出可开票额度') + `（¥${fenToYuanText(availableFen)}）`,
      );
      return;
    }
    if (!title.trim()) {
      showError(t('请填写发票抬头'));
      return;
    }
    if (!taxNo.trim()) {
      showError(t('请填写税号'));
      return;
    }
    if (!email.trim()) {
      showError(t('请填写接收邮箱'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post('/api/user/invoice', {
        amount_fen: fen,
        invoice_type: invoiceType,
        title: title.trim(),
        tax_no: taxNo.trim(),
        email: email.trim(),
        remark,
      });
      if (res.data?.success) {
        showSuccess(t('申请已提交，请等待管理员审核开具'));
        setAmount('');
        setRemark('');
        await Promise.all([fetchQuota(), fetchInvoices()]);
      } else {
        showError(res.data?.message || t('提交失败'));
      }
    } catch (err) {
      showError(err?.response?.data?.message || t('提交失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInvoice = (invoice) => {
    Modal.confirm({
      title: t('撤销发票申请'),
      content: t('确定撤销该笔待审核的发票申请吗？'),
      okText: t('撤销'),
      cancelText: t('再想想'),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/user/invoice/${invoice.id}`);
          if (res.data?.success) {
            showSuccess(t('已撤销'));
            await Promise.all([fetchQuota(), fetchInvoices()]);
          } else {
            showError(res.data?.message || t('撤销失败'));
          }
        } catch (_) {
          showError(t('撤销失败'));
        }
      },
    });
  };

  const downloadInvoice = async (invoice) => {
    try {
      const res = await API.get(`/api/user/invoice/${invoice.id}/file`);
      if (res.data?.success) {
        downloadBase64File(res.data.data.file_name, res.data.data.file_data);
      } else {
        showError(res.data?.message || t('下载失败'));
      }
    } catch (_) {
      showError(t('下载失败'));
    }
  };

  const columns = [
    {
      title: t('提交时间'),
      dataIndex: 'submitted_at',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('开票金额'),
      dataIndex: 'amount_fen',
      render: (v) => `¥${fenToYuanText(v)}`,
    },
    {
      title: t('类型'),
      dataIndex: 'invoice_type',
      render: (v) => t(TYPE_LABELS[v] || '-'),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v, record) => {
        const tag = STATUS_TAGS[v] || { text: '未知', color: 'grey' };
        return (
          <div className='flex flex-col gap-1'>
            <Tag color={tag.color}>{t(tag.text)}</Tag>
            {v === 3 && record.reject_reason && (
              <Text size='small' type='danger'>
                {record.reject_reason}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      dataIndex: 'op',
      render: (_, record) => {
        if (record.status === 1) {
          return (
            <Button
              theme='borderless'
              type='danger'
              size='small'
              onClick={() => cancelInvoice(record)}
            >
              {t('撤销')}
            </Button>
          );
        }
        if (record.status === 2) {
          return (
            <Button
              theme='borderless'
              size='small'
              onClick={() => downloadInvoice(record)}
            >
              {t('下载发票')}
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      {/* 卡片头部（参考账户充值/邀请奖励：圆形图标 + 标题 + 说明小字） */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='orange' className='mr-3 shadow-md'>
          <ReceiptText size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('增值税发票')}
          </Typography.Text>
          <div className='text-xs'>
            {t('对已到账的对公转账金额申请开具增值税发票')}
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 顶部：可开票额度高亮条（整宽） */}
        <div
          className='rounded-xl px-4 py-3 mb-4'
          style={{ background: 'var(--semi-color-fill-0)' }}
        >
          <div className='flex items-baseline gap-2'>
            <Text type='secondary'>{t('可开票额度')}</Text>
            <Title heading={3} style={{ margin: 0 }}>
              ¥{fenToYuanText(availableFen)}
            </Title>
          </div>
          <Text type='tertiary' size='small' className='block mt-1'>
            {t(
              '可开票额度为已审核到账的对公转账累计金额，减去已申请/已开具的发票金额。发票由管理员人工审核开具，开具后可在下方记录中下载。',
            )}
          </Text>
        </div>

        {/* 申请表单 */}
        <div>
          {hasPending ? (
            <Text type='secondary'>
              {t('您有一笔发票申请待审核，审核完成后方可提交新的申请。')}
            </Text>
          ) : availableFen <= 0 ? (
            <Text type='secondary'>
              {t('暂无可开票额度，完成对公转账充值后即可申请开票。')}
            </Text>
          ) : (
            <>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <div>
                    <Text type='secondary' className='block mb-1'>
                      {t('开票金额（元）')} <span style={{ color: 'red' }}>*</span>
                    </Text>
                    <Input value={amount} onChange={setAmount} prefix='¥' />
                  </div>
                  <div>
                    <Text type='secondary' className='block mb-1'>
                      {t('发票类型')}
                    </Text>
                    <Select
                      value={invoiceType}
                      onChange={setInvoiceType}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value={1}>
                        {t('增值税普通发票')}
                      </Select.Option>
                      <Select.Option value={2}>
                        {t('增值税专用发票')}
                      </Select.Option>
                    </Select>
                  </div>
                </div>
                <Text type='secondary' className='block mb-1 mt-3'>
                  {t('发票抬头')} <span style={{ color: 'red' }}>*</span>
                </Text>
                <Input value={title} onChange={setTitle} maxLength={128} />
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mt-3'>
                  <div>
                    <Text type='secondary' className='block mb-1'>
                      {t('税号')} <span style={{ color: 'red' }}>*</span>
                    </Text>
                    <Input
                      value={taxNo}
                      onChange={setTaxNo}
                      maxLength={32}
                      placeholder={t('统一社会信用代码')}
                    />
                  </div>
                  <div>
                    <Text type='secondary' className='block mb-1'>
                      {t('接收邮箱')} <span style={{ color: 'red' }}>*</span>
                    </Text>
                    <Input value={email} onChange={setEmail} maxLength={128} />
                  </div>
                </div>
                <Text type='secondary' className='block mb-1 mt-3'>
                  {t('备注（选填）')}
                </Text>
                <TextArea
                  value={remark}
                  onChange={setRemark}
                  maxLength={255}
                  rows={2}
                />
                <Button
                  theme='solid'
                  type='primary'
                  className='mt-4 w-full'
                  loading={submitting}
                  onClick={submit}
                >
                  {t('提交开票申请')}
                </Button>
              </>
            )}
        </div>

        {/* 申请记录 */}
        <div className='mt-6'>
          <Text strong className='block mb-2'>
            {t('开票记录')}
          </Text>
          {invoices.length === 0 ? (
            <Empty description={t('暂无开票记录')} />
          ) : (
            <Table
              columns={columns}
              dataSource={invoices}
              pagination={false}
              size='small'
              rowKey='id'
              scroll={invoices.length > 10 ? { y: 420 } : undefined}
            />
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default InvoiceCard;
