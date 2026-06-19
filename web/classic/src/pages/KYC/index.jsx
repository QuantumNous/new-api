import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Image,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconVerify } from '@douyinfe/semi-icons';
import { API, isAdmin, isRoot, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useTableCompactMode } from '../../hooks/common/useTableCompactMode';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import CompactModeToggle from '../../components/common/ui/CompactModeToggle';
import { createCardProPagination } from '../../helpers/utils';

const { Text } = Typography;

const STATUS_MAP = {
  1: { text: '审核中', color: 'orange' },
  2: { text: '已通过', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const ID_TYPE_LABELS = {
  id_card: '身份证',
  passport: '护照',
  other: '其他',
};

// canViewSensitive mirrors checkSensitiveAccessPermission on the backend:
// pending/rejected → Admin+Root; approved → Root only.
function canViewSensitive(row) {
  if (row.status === 2) return isRoot();
  return isAdmin();
}

export default function KYCPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('kyc');

  // reject modal
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // unified inspect modal: combines reveal (plaintext ID number) and images
  // so admins can cross-check the typed number against the photo in one view.
  const [inspectVisible, setInspectVisible] = useState(false);
  const [inspectData, setInspectData] = useState(null); // { reveal, images }
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadList = async (p = page, s = statusFilter, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/kyc/admin?status=${s}&page=${p}&page_size=${ps}`,
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

  const handleApprove = async (id) => {
    try {
      const res = await API.put(`/api/user/kyc/admin/${id}/approve`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('审核通过'));
        loadList();
      } else {
        showError(message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showError(t('请填写拒绝原因'));
      return;
    }
    setRejectLoading(true);
    try {
      const res = await API.put(`/api/user/kyc/admin/${rejectId}/reject`, {
        reason: rejectReason,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已拒绝'));
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

  const handleReset = async (id) => {
    if (!window.confirm(t('确认重置该认证？用户认证状态将清空，需重新提交所有信息（含身份证图片）。'))) {
      return;
    }
    try {
      const res = await API.put(`/api/user/kyc/admin/${id}/reset`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已重置，用户需重新提交认证'));
        loadList();
      } else {
        showError(message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const handleInspect = async (row) => {
    setInspectVisible(true);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const calls = [API.get(`/api/user/kyc/admin/${row.id}/reveal`)];
      if (row.has_images) {
        calls.push(API.get(`/api/user/kyc/admin/${row.id}/images`));
      }
      const results = await Promise.all(calls);
      const revealRes = results[0]?.data;
      if (!revealRes?.success) {
        showError(revealRes?.message || t('操作失败'));
        setInspectVisible(false);
        return;
      }
      const imagesRes = row.has_images ? results[1]?.data : null;
      setInspectData({
        reveal: revealRes.data,
        images: imagesRes?.success ? imagesRes.data : null,
      });
    } catch {
      showError(t('操作失败'));
      setInspectVisible(false);
    } finally {
      setInspectLoading(false);
    }
  };

  const closeInspect = () => {
    setInspectVisible(false);
    setInspectData(null);
  };

  const baseColumns = [
    {
      title: t('ID'),
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('用户'),
      width: 160,
      render: (_, row) => (
        <span>
          {row.username} <Text type='secondary'>(#{row.user_id})</Text>
        </span>
      ),
    },
    {
      title: t('姓名'),
      dataIndex: 'real_name',
      width: 110,
    },
    {
      title: t('证件类型'),
      dataIndex: 'id_type',
      width: 100,
      render: (v) => t(ID_TYPE_LABELS[v] || v),
    },
    {
      title: t('证件号'),
      dataIndex: 'id_number_masked',
      width: 150,
    },
    {
      title: t('图片'),
      dataIndex: 'has_images',
      width: 70,
      align: 'center',
      render: (v) => (
        <Text type={v ? 'success' : 'tertiary'}>{v ? '✓' : '—'}</Text>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (v) => {
        const s = STATUS_MAP[v] || { text: String(v), color: 'grey' };
        return <Tag color={s.color}>{t(s.text)}</Tag>;
      },
    },
    {
      title: t('拒绝原因'),
      dataIndex: 'reject_reason',
      width: 160,
      render: (v) => v || '-',
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
      width: 260,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          {row.status === 1 && (
            <>
              <Button
                size='small'
                theme='solid'
                type='primary'
                onClick={() => handleApprove(row.id)}
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
          {(row.status === 2 || row.status === 3) && isRoot() && (
            <Button size='small' onClick={() => handleReset(row.id)}>
              {t('重置')}
            </Button>
          )}
          {canViewSensitive(row) && (
            <Button
              size='small'
              type='warning'
              onClick={() => handleInspect(row)}
            >
              {t('查看身份信息')}
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
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type1'
        descriptionArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='flex items-center text-blue-500'>
              <IconVerify className='mr-2' />
              <Text>{t('实名认证')}</Text>
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
            <Select
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              style={{ width: 140 }}
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

      {/* 拒绝原因 Modal */}
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

      {/* 身份信息合并 Modal：证件号 + 图片并排，便于核对 */}
      <Modal
        title={t('身份信息核对')}
        visible={inspectVisible}
        onCancel={closeInspect}
        footer={<Button onClick={closeInspect}>{t('关闭')}</Button>}
        width={720}
      >
        {inspectLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size='large' />
          </div>
        ) : inspectData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: 12,
                background: 'var(--semi-color-fill-0)',
                borderRadius: 8,
                lineHeight: 1.9,
              }}
            >
              <div>
                <Text strong>{t('姓名')}：</Text>
                <Text>{inspectData.reveal.real_name}</Text>
              </div>
              <div>
                <Text strong>{t('证件类型')}：</Text>
                <Text>{t(ID_TYPE_LABELS[inspectData.reveal.id_type] || inspectData.reveal.id_type)}</Text>
              </div>
              <div>
                <Text strong>{t('证件号')}：</Text>
                <Text copyable>{inspectData.reveal.id_number}</Text>
              </div>
            </div>
            {inspectData.images ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Text type='secondary' size='small'>{t('正面（人像面）')}</Text>
                  <Image
                    src={inspectData.images.front_image}
                    alt='front'
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Text type='secondary' size='small'>{t('背面（国徽面）')}</Text>
                  <Image
                    src={inspectData.images.back_image}
                    alt='back'
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
            ) : (
              <Text type='tertiary'>{t('该记录未上传身份证图片')}</Text>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
