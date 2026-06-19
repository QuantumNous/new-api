import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { Landmark } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { renderQuota } from '../../helpers/render';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useTableCompactMode } from '../../hooks/common/useTableCompactMode';
import { StatusContext } from '../../context/Status';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import CompactModeToggle from '../../components/common/ui/CompactModeToggle';
import { createCardProPagination } from '../../helpers/utils';

const { Text } = Typography;

const STATUS_MAP = {
  1: { text: '待审核', color: 'orange' },
  2: { text: '已通过', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

// 金额一律以「分」整数与后端交互（docs/enterprise-features-design.md D1）。
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

export default function TransferTab() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [statusState] = useContext(StatusContext);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('bankTransfer');

  // 回执查看 modal
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptImage, setReceiptImage] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);

  // 通过 modal（可修正实际到账金额）
  const [approveVisible, setApproveVisible] = useState(false);
  const [approveRow, setApproveRow] = useState(null);
  const [creditedAmount, setCreditedAmount] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  // 拒绝 modal
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const usdRate = statusState?.status?.usd_exchange_rate || 0;

  const loadList = async (
    p = page,
    s = statusFilter,
    ps = pageSize,
    kw = keyword,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/bank_transfer/admin?status=${s}&page=${p}&page_size=${ps}&keyword=${encodeURIComponent(kw)}`,
      );
      const { success, data, total: t2 } = res.data;
      if (success) {
        setList(data || []);
        setTotal(t2 || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList(page, statusFilter, pageSize);
  }, [page, statusFilter, pageSize]);

  const handlePageChange = (p) => setPage(p);
  const handlePageSizeChange = (ps) => {
    setPageSize(ps);
    setPage(1);
  };

  const handleViewReceipt = async (row) => {
    setReceiptVisible(true);
    setReceiptLoading(true);
    setReceiptImage('');
    try {
      const res = await API.get(
        `/api/user/bank_transfer/admin/${row.id}/receipt`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setReceiptImage(data.receipt_image);
      } else {
        showError(message || t('操作失败'));
        setReceiptVisible(false);
      }
    } catch {
      showError(t('操作失败'));
      setReceiptVisible(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const closeReceipt = () => {
    setReceiptVisible(false);
    setReceiptImage('');
  };

  const openApprove = (row) => {
    setApproveRow(row);
    setCreditedAmount(fenToYuanText(row.amount_fen));
    setReviewRemark('');
    setApproveVisible(true);
  };

  // 折算额度预览（仅展示用；权威折算在后端按固定汇率执行）。
  // 用 renderQuota 按运营设置的额度展示类型渲染（CNY→¥、USD→$、自定义货币），与全站一致。
  const quotaPreview = useMemo(() => {
    const fen = yuanStringToFen(creditedAmount);
    if (fen === null || fen <= 0 || !usdRate) return '';
    const usd = fen / 100 / usdRate; // 元 → 美元额度
    const quotaPerUnit =
      parseFloat(localStorage.getItem('quota_per_unit')) || 500000;
    return renderQuota(usd * quotaPerUnit);
  }, [creditedAmount, usdRate]);

  const handleApproveSubmit = async () => {
    const fen = yuanStringToFen(creditedAmount);
    if (fen === null || fen <= 0) {
      showError(t('请输入有效的到账金额，最多两位小数'));
      return;
    }
    setApproveLoading(true);
    try {
      const res = await API.put(
        `/api/user/bank_transfer/admin/${approveRow.id}/approve`,
        { credited_fen: fen, review_remark: reviewRemark.trim() },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已入账'));
        window.dispatchEvent(new Event('review:changed'));
        setApproveVisible(false);
        setApproveRow(null);
        loadList();
      } else {
        showError(message);
      }
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showError(t('请填写拒绝原因'));
      return;
    }
    setRejectLoading(true);
    try {
      const res = await API.put(
        `/api/user/bank_transfer/admin/${rejectId}/reject`,
        { reason: rejectReason },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已拒绝'));
        window.dispatchEvent(new Event('review:changed'));
        setRejectVisible(false);
        setRejectReason('');
        loadList();
      } else {
        showError(message);
      }
    } finally {
      setRejectLoading(false);
    }
  };

  const baseColumns = [
    {
      title: t('ID'),
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('用户'),
      width: 150,
      render: (_, row) => (
        <span>
          {row.username} <Text type='secondary'>(#{row.user_id})</Text>
        </span>
      ),
    },
    {
      title: t('转账金额'),
      dataIndex: 'amount_fen',
      width: 110,
      render: (v) => `¥${fenToYuanText(v)}`,
    },
    {
      title: t('到账金额'),
      dataIndex: 'credited_fen',
      width: 110,
      render: (v, row) =>
        row.status === 2 ? (
          <div className='flex flex-col'>
            <span>¥{fenToYuanText(v)}</span>
            {row.review_remark && (
              <Text type='tertiary' size='small'>
                {row.review_remark}
              </Text>
            )}
          </div>
        ) : (
          '-'
        ),
    },
    {
      title: t('单号'),
      dataIndex: 'trade_no',
      width: 170,
      render: (v) => (
        <Text copyable size='small'>
          {v}
        </Text>
      ),
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      width: 140,
      render: (v) => v || '-',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (v, row) => {
        const s = STATUS_MAP[v] || { text: String(v), color: 'grey' };
        return (
          <div className='flex flex-col gap-1'>
            <Tag color={s.color}>{t(s.text)}</Tag>
            {v === 3 && row.reject_reason && (
              <Text size='small' type='danger'>
                {row.reject_reason}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: t('提交时间'),
      dataIndex: 'submitted_at',
      width: 170,
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('审核人'),
      dataIndex: 'reviewer_name',
      width: 110,
      render: (v) => v || '-',
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      width: 250,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button size='small' onClick={() => handleViewReceipt(row)}>
            {t('查看回执')}
          </Button>
          {row.status === 1 && (
            <>
              <Button
                size='small'
                theme='solid'
                type='primary'
                onClick={() => openApprove(row)}
              >
                {t('通过')}
              </Button>
              <Button
                size='small'
                type='danger'
                onClick={() => {
                  setRejectId(row.id);
                  setRejectVisible(true);
                }}
              >
                {t('拒绝')}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const columns = useMemo(() => {
    return compactMode
      ? baseColumns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : baseColumns;
  }, [compactMode, baseColumns]);

  return (
    <div>
      <CardPro
        type='type1'
        descriptionArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='flex items-center text-blue-500'>
              <Landmark size={16} className='mr-2' />
              <Text>{t('对公转账')}</Text>
            </div>
            <CompactModeToggle
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              t={t}
            />
          </div>
        }
        actionsArea={
          <div className='flex justify-end items-center gap-2'>
            <Input
              value={keyword}
              onChange={setKeyword}
              placeholder={t('搜索用户名/单号')}
              style={{ width: 180 }}
              showClear
              onEnterPress={() => {
                setPage(1);
                loadList(1, statusFilter, pageSize, keyword);
              }}
            />
            <Select
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              style={{ width: 130 }}
            >
              <Select.Option value={0}>{t('全部')}</Select.Option>
              <Select.Option value={1}>{t('待审核')}</Select.Option>
              <Select.Option value={2}>{t('已通过')}</Select.Option>
              <Select.Option value={3}>{t('已拒绝')}</Select.Option>
            </Select>
            <Button onClick={() => loadList()}>{t('刷新')}</Button>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: page,
          pageSize,
          total,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          isMobile,
          t,
        })}
        t={t}
      >
        <CardTable
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey='id'
          hidePagination={true}
          scroll={compactMode ? undefined : { x: 'max-content' }}
        />
      </CardPro>

      {/* 回执查看 Modal */}
      <Modal
        title={t('转账回执')}
        visible={receiptVisible}
        onCancel={closeReceipt}
        footer={<Button onClick={closeReceipt}>{t('关闭')}</Button>}
        width={640}
      >
        {receiptLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size='large' />
          </div>
        ) : receiptImage ? (
          <Image src={receiptImage} alt='receipt' style={{ width: '100%' }} />
        ) : null}
      </Modal>

      {/* 通过 Modal */}
      <Modal
        title={t('确认入账')}
        visible={approveVisible}
        onCancel={() => {
          setApproveVisible(false);
          setApproveRow(null);
        }}
        onOk={handleApproveSubmit}
        okButtonProps={{ loading: approveLoading }}
        okText={t('确认入账')}
        cancelText={t('取消')}
      >
        {approveRow && (
          <div style={{ lineHeight: 2 }}>
            <div>
              <Text type='secondary'>{t('用户')}：</Text>
              <Text>
                {approveRow.username} (#{approveRow.user_id})
              </Text>
            </div>
            <div>
              <Text type='secondary'>{t('转账金额')}：</Text>
              <Text>¥{fenToYuanText(approveRow.amount_fen)}</Text>
            </div>
            <div className='mt-2'>
              <Text strong>{t('用户账户充值额度（元）')}</Text>
              <Input
                value={creditedAmount}
                onChange={setCreditedAmount}
                prefix='¥'
                style={{ marginTop: 4 }}
              />
              <Text type='tertiary' size='small' className='block mt-1'>
                {t('根据实际签署合同确定入账金额，可能高于转账金额')}
                {quotaPreview && (
                  <>
                    {'；'}
                    {t('预计入账额度')}: {quotaPreview}
                  </>
                )}
              </Text>
            </div>
            <div className='mt-3'>
              <Text strong>{t('入账备注（选填）')}</Text>
              <TextArea
                value={reviewRemark}
                onChange={setReviewRemark}
                maxLength={255}
                rows={2}
                style={{ marginTop: 4 }}
                placeholder={t('如：BD 张三签署 XX 合同，约定 8 折入账')}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 拒绝 Modal */}
      <Modal
        title={t('填写拒绝原因')}
        visible={rejectVisible}
        onCancel={() => {
          setRejectVisible(false);
          setRejectReason('');
        }}
        onOk={handleRejectSubmit}
        okButtonProps={{ loading: rejectLoading }}
        okText={t('确认拒绝')}
        cancelText={t('取消')}
      >
        <TextArea
          placeholder={t('请输入拒绝原因')}
          value={rejectReason}
          onChange={(v) => setRejectReason(v)}
          rows={3}
          maxCount={255}
          showClear
        />
      </Modal>
    </div>
  );
}
