import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { ReceiptText } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useTableCompactMode } from '../../hooks/common/useTableCompactMode';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import CompactModeToggle from '../../components/common/ui/CompactModeToggle';
import { createCardProPagination } from '../../helpers/utils';

const { Text } = Typography;

const STATUS_MAP = {
  1: { text: '待审核', color: 'orange' },
  2: { text: '已开具', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const TYPE_LABELS = {
  1: '增值税普通发票',
  2: '增值税专用发票',
};

const MAX_INVOICE_FILE_BYTES = 5 * 1024 * 1024;

function fenToYuanText(fen) {
  const n = parseInt(fen, 10);
  if (!Number.isFinite(n)) return '0.00';
  const whole = Math.trunc(n / 100);
  const frac = String(Math.abs(n % 100)).padStart(2, '0');
  return `${whole}.${frac}`;
}

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

export default function InvoiceTab() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('invoice');

  // 开具 modal（上传发票文件）
  const [issueVisible, setIssueVisible] = useState(false);
  const [issueRow, setIssueRow] = useState(null);
  const [issueFile, setIssueFile] = useState(null); // { name, base64 }
  const [issueLoading, setIssueLoading] = useState(false);
  const fileInputRef = useRef(null);

  // 拒绝 modal
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadList = async (
    p = page,
    s = statusFilter,
    ps = pageSize,
    kw = keyword,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/invoice/admin?status=${s}&page=${p}&page_size=${ps}&keyword=${encodeURIComponent(kw)}`,
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

  const openIssue = (row) => {
    setIssueRow(row);
    setIssueFile(null);
    setIssueVisible(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      showError(t('仅支持 PDF/JPG/PNG 格式的发票文件'));
      return;
    }
    if (file.size > MAX_INVOICE_FILE_BYTES) {
      showError(t('发票文件过大，请控制在 5MB 以内'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1];
      setIssueFile({ name: file.name, base64 });
    };
    reader.onerror = () => showError(t('文件读取失败，请重试'));
    reader.readAsDataURL(file);
  };

  const handleIssueSubmit = async () => {
    if (!issueFile) {
      showError(t('请先上传发票文件'));
      return;
    }
    setIssueLoading(true);
    try {
      const res = await API.put(
        `/api/user/invoice/admin/${issueRow.id}/issue`,
        { file_name: issueFile.name, file_data: issueFile.base64 },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已开具'));
        window.dispatchEvent(new Event('review:changed'));
        setIssueVisible(false);
        setIssueRow(null);
        setIssueFile(null);
        loadList();
      } else {
        showError(message);
      }
    } finally {
      setIssueLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showError(t('请填写拒绝原因'));
      return;
    }
    setRejectLoading(true);
    try {
      const res = await API.put(`/api/user/invoice/admin/${rejectId}/reject`, {
        reason: rejectReason,
      });
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

  const viewFile = async (row) => {
    try {
      const res = await API.get(`/api/user/invoice/admin/${row.id}/file`);
      if (res.data?.success) {
        downloadBase64File(res.data.data.file_name, res.data.data.file_data);
      } else {
        showError(res.data?.message || t('下载失败'));
      }
    } catch (_) {
      showError(t('下载失败'));
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
      title: t('开票金额'),
      dataIndex: 'amount_fen',
      width: 110,
      render: (v) => `¥${fenToYuanText(v)}`,
    },
    {
      title: t('类型'),
      dataIndex: 'invoice_type',
      width: 130,
      render: (v) => t(TYPE_LABELS[v] || '-'),
    },
    {
      title: t('发票抬头'),
      dataIndex: 'title',
      width: 180,
      render: (v) => <Text copyable>{v}</Text>,
    },
    {
      title: t('税号'),
      dataIndex: 'tax_no',
      width: 170,
      render: (v) => (
        <Text copyable size='small'>
          {v}
        </Text>
      ),
    },
    {
      title: t('接收邮箱'),
      dataIndex: 'email',
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
      width: 130,
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
      width: 230,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          {row.status === 1 && (
            <>
              <Button
                size='small'
                theme='solid'
                type='primary'
                onClick={() => openIssue(row)}
              >
                {t('开具')}
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
          {row.status === 2 && (
            <Button size='small' onClick={() => viewFile(row)}>
              {t('查看发票')}
            </Button>
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
              <ReceiptText size={16} className='mr-2' />
              <Text>{t('发票审核')}</Text>
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
              placeholder={t('搜索用户名/抬头')}
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
              <Select.Option value={2}>{t('已开具')}</Select.Option>
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

      {/* 开具 Modal */}
      <Modal
        title={t('开具发票')}
        visible={issueVisible}
        onCancel={() => {
          setIssueVisible(false);
          setIssueRow(null);
          setIssueFile(null);
        }}
        onOk={handleIssueSubmit}
        okButtonProps={{ loading: issueLoading, disabled: !issueFile }}
        okText={t('确认开具')}
        cancelText={t('取消')}
      >
        {issueRow && (
          <div style={{ lineHeight: 2 }}>
            <div>
              <Text type='secondary'>{t('用户')}：</Text>
              <Text>
                {issueRow.username} (#{issueRow.user_id})
              </Text>
            </div>
            <div>
              <Text type='secondary'>{t('开票金额')}：</Text>
              <Text strong>¥{fenToYuanText(issueRow.amount_fen)}</Text>
              <Text type='tertiary'>
                {'　'}
                {t(TYPE_LABELS[issueRow.invoice_type] || '-')}
              </Text>
            </div>
            <div>
              <Text type='secondary'>{t('发票抬头')}：</Text>
              <Text copyable>{issueRow.title}</Text>
            </div>
            <div>
              <Text type='secondary'>{t('税号')}：</Text>
              <Text copyable>{issueRow.tax_no}</Text>
            </div>
            <div className='mt-2'>
              <Button onClick={() => fileInputRef.current?.click()}>
                {issueFile ? t('重新选择文件') : t('上传发票文件')}
              </Button>
              {issueFile && (
                <Text className='ml-2' type='success'>
                  {issueFile.name}
                </Text>
              )}
              <input
                ref={fileInputRef}
                type='file'
                accept='.pdf,.jpg,.jpeg,.png'
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Text type='tertiary' size='small' className='block mt-1'>
                {t('支持 PDF/JPG/PNG，不超过 5MB；确认后用户即可在钱包页下载')}
              </Text>
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
