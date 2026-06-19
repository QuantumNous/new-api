import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Spin,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconUpload, IconClose } from '@douyinfe/semi-icons';
import { Landmark } from 'lucide-react';
import { API, copy, showError, showSuccess, renderQuota } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STATUS_TAGS = {
  1: { text: '待审核', color: 'orange' },
  2: { text: '已通过', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

// 金额一律以「分」整数与后端交互（docs/enterprise-features-design.md D1）。
// 元 → 分按字符串拆段解析，禁止浮点乘法。
// 整数部分限 10 位（≤99 亿元），避免超长输入越过 Number.MAX_SAFE_INTEGER 丢精度。
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

// 与 KYCSetting / EnterpriseSetting 同款的客户端压缩（canvas → JPEG）
async function compressImageToBase64(
  file,
  maxLongEdgePx = 2400,
  maxSizeKB = 1500,
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxLongEdgePx) {
        if (width >= height) {
          height = Math.round((height * maxLongEdgePx) / width);
          width = maxLongEdgePx;
        } else {
          width = Math.round((width * maxLongEdgePx) / height);
          height = maxLongEdgePx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      // Encode at the given quality. Retry exactly once at a lower quality if
      // the result is still over target — a single fallback, never a loop
      // (re-encoding at a fixed quality would never shrink and would hang).
      const tryEncode = (quality, isRetry) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('canvas.toBlob failed'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = reader.result.split(',')[1];
              if (!isRetry && b64.length > maxSizeKB * 1024 * (4 / 3)) {
                tryEncode(0.82, true);
              } else {
                resolve(b64);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality,
        );
      };
      tryEncode(0.88, false);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// 收款信息单行：标签 + 值 + 一键复制
function PayeeField({ label, value, t }) {
  return (
    <div
      className='flex items-start justify-between gap-3 py-1.5'
      style={{ borderBottom: '1px dashed var(--semi-color-border)' }}
    >
      <Text type='tertiary' style={{ flexShrink: 0 }}>
        {t(label)}
      </Text>
      <div className='flex items-start gap-1 min-w-0 flex-1 justify-end'>
        {/* 完整展示，长值（开户行/账号）自动换行，不再省略号截断 */}
        <Text className='break-all' style={{ textAlign: 'right' }}>
          {value}
        </Text>
        <Button
          theme='borderless'
          size='small'
          style={{ flexShrink: 0 }}
          onClick={async () => {
            await copy(value);
            showSuccess(t('已复制'));
          }}
        >
          {t('复制')}
        </Button>
      </div>
    </div>
  );
}

const BankTransferCard = ({ userState }) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [receipt, setReceipt] = useState('');
  const fileInputRef = useRef(null);

  const enterpriseApproved = userState?.user?.enterprise_status === 2;

  const fetchConfig = async () => {
    try {
      const res = await API.get('/api/user/bank_transfer/config');
      if (res.data?.success) {
        setConfig(res.data.data);
      }
    } catch (_) {
      // 配置拉取失败时卡片不展示
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await API.get(
        '/api/user/bank_transfer/self?p=1&page_size=50',
      );
      if (res.data?.success) {
        setOrders(res.data.data || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!enterpriseApproved) return;
    setLoading(true);
    Promise.all([fetchConfig(), fetchOrders()]).finally(() =>
      setLoading(false),
    );
  }, [enterpriseApproved]);

  if (!enterpriseApproved || !config?.enabled) {
    return null;
  }

  const hasPending = orders.some((o) => o.status === 1);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImageToBase64(file);
      setReceipt(b64);
    } catch {
      showError(t('图片处理失败，请重试'));
    }
    e.target.value = '';
  };

  const submit = async () => {
    const fen = yuanStringToFen(amount);
    if (fen === null || fen <= 0) {
      showError(t('请输入有效的转账金额，最多两位小数'));
      return;
    }
    if (config.min_amount_fen > 0 && fen < config.min_amount_fen) {
      showError(
        t('转账金额不能低于') + ` ¥${fenToYuanText(config.min_amount_fen)}`,
      );
      return;
    }
    if (!receipt) {
      showError(t('请上传转账回执'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post('/api/user/bank_transfer', {
        amount_fen: fen,
        remark,
        receipt,
      });
      if (res.data?.success) {
        showSuccess(t('提交成功，请等待管理员审核'));
        setAmount('');
        setRemark('');
        setReceipt('');
        await fetchOrders();
      } else {
        showError(res.data?.message || t('提交失败'));
      }
    } catch (err) {
      showError(err?.response?.data?.message || t('提交失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = (order) => {
    Modal.confirm({
      title: t('撤销转账订单'),
      content: t('确定撤销该笔待审核的转账订单吗？回执将一并删除。'),
      okText: t('撤销'),
      cancelText: t('再想想'),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/user/bank_transfer/${order.id}`);
          if (res.data?.success) {
            showSuccess(t('已撤销'));
            await fetchOrders();
          } else {
            showError(res.data?.message || t('撤销失败'));
          }
        } catch (_) {
          showError(t('撤销失败'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('提交时间'),
      dataIndex: 'submitted_at',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('转账金额'),
      dataIndex: 'amount_fen',
      render: (v) => `¥${fenToYuanText(v)}`,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v, record) => {
        const tag = STATUS_TAGS[v] || { text: '未知', color: 'grey' };
        return (
          <div className='flex flex-col gap-1'>
            <Tag color={tag.color}>{t(tag.text)}</Tag>
            {v === 2 && record.quota_granted > 0 && (
              <Text size='small' type='tertiary'>
                {t('到账额度')}: {renderQuota(record.quota_granted)}
              </Text>
            )}
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
      render: (_, record) =>
        record.status === 1 ? (
          <Button
            theme='borderless'
            type='danger'
            size='small'
            onClick={() => cancelOrder(record)}
          >
            {t('撤销')}
          </Button>
        ) : null,
    },
  ];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      {/* 卡片头部（参考账户充值/邀请奖励：圆形图标 + 标题 + 说明小字） */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='indigo' className='mr-3 shadow-md'>
          <Landmark size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('对公转账')}
          </Typography.Text>
          <div className='text-xs'>
            {t('企业对公账户线下转账，上传回执由管理员审核入账')}
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 上：收款信息 */}
        <div className='mb-5'>
          <Text type='secondary' className='block mb-2'>
            {t('请使用企业对公账户向以下账户转账，完成后在下方提交回执')}
          </Text>
          <PayeeField label='公司名称' value={config.company_name} t={t} />
          <PayeeField label='收款单位' value={config.payee_name} t={t} />
          <PayeeField label='收款账号' value={config.account_number} t={t} />
          <PayeeField label='开户行' value={config.bank_name} t={t} />
          {config.min_amount_fen > 0 && (
            <Text type='tertiary' size='small' className='block mt-2'>
              {t('最低单笔转账金额')}: ¥{fenToYuanText(config.min_amount_fen)}
            </Text>
          )}
          {config.tips && (
            <Banner
              type='warning'
              description={config.tips}
              style={{ marginTop: 8 }}
              closeIcon={null}
            />
          )}
        </div>

        {/* 中：提交订单 */}
        <div className='mb-5'>
          {hasPending ? (
            <Banner
              type='info'
              description={t(
                '您有一笔转账订单待审核，审核完成后方可提交新的订单。',
              )}
              closeIcon={null}
            />
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {/* 左：转账金额 + 备注 */}
              <div>
                <Text type='secondary' className='block mb-1'>
                  {t('转账金额（元）')} <span style={{ color: 'red' }}>*</span>
                </Text>
                <Input
                  value={amount}
                  onChange={setAmount}
                  placeholder={t('与银行实际转账金额一致')}
                  prefix='¥'
                />
                <Text type='secondary' className='block mb-1 mt-3'>
                  {t('备注（选填）')}
                </Text>
                <TextArea
                  value={remark}
                  onChange={setRemark}
                  maxLength={255}
                  rows={3}
                  placeholder={t('如银行转账流水号')}
                />
              </div>

              {/* 右：回执 + 提交按钮 */}
              <div className='flex flex-col'>
                <Text type='secondary' className='block mb-1'>
                  {t('转账回执')} <span style={{ color: 'red' }}>*</span>
                </Text>
                <div
                  className='flex-1'
                  style={{
                    border: '1px dashed var(--semi-color-border)',
                    borderRadius: 8,
                    padding: 8,
                    minHeight: 96,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onClick={() => !receipt && fileInputRef.current?.click()}
                >
                  {receipt ? (
                    <>
                      <img
                        src={`data:image/jpeg;base64,${receipt}`}
                        alt='receipt'
                        style={{ maxHeight: 160, maxWidth: '100%' }}
                      />
                      <Button
                        icon={<IconClose />}
                        theme='borderless'
                        size='small'
                        style={{ position: 'absolute', top: 4, right: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceipt('');
                        }}
                      />
                    </>
                  ) : (
                    <div className='flex flex-col items-center gap-1'>
                      <IconUpload size='large' />
                      <Text type='tertiary' size='small'>
                        {t('点击上传银行转账回执截图')}
                      </Text>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
                <Button
                  theme='solid'
                  type='primary'
                  className='mt-3 w-full'
                  loading={submitting}
                  onClick={submit}
                >
                  {t('提交转账订单')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 下：转账记录 */}
        <div>
          <Text strong className='block mb-2'>
            {t('转账记录')}
          </Text>
          {orders.length === 0 ? (
            <Empty description={t('暂无转账记录')} />
          ) : (
            <Table
              columns={columns}
              dataSource={orders}
              pagination={false}
              size='small'
              rowKey='id'
              scroll={orders.length > 10 ? { y: 420 } : undefined}
            />
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default BankTransferCard;
