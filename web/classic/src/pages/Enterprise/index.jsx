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
import { IconShield } from '@douyinfe/semi-icons';
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

// canViewSensitive mirrors checkEnterpriseSensitiveAccessPermission on the
// backend: pending/rejected → Admin+Root; approved → Root only.
function canViewSensitive(row) {
  if (row.status === 2) return isRoot();
  return isAdmin();
}

export default function EnterprisePage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('enterprise');

  // reject modal
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // unified inspect modal: reveal (plaintext) + images side by side
  const [inspectVisible, setInspectVisible] = useState(false);
  const [inspectData, setInspectData] = useState(null); // { reveal, images }
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadList = async (p = page, s = statusFilter, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/enterprise/admin?status=${s}&page=${p}&page_size=${ps}`,
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
      const res = await API.put(`/api/user/enterprise/admin/${id}/approve`);
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
      const res = await API.put(`/api/user/enterprise/admin/${rejectId}/reject`, {
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
    if (!window.confirm(t('确认重置该认证？用户认证状态将清空，需重新提交所有信息（含营业执照与法人证件图片）。'))) {
      return;
    }
    try {
      const res = await API.put(`/api/user/enterprise/admin/${id}/reset`);
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
      const calls = [API.get(`/api/user/enterprise/admin/${row.id}/reveal`)];
      if (row.has_images) {
        calls.push(API.get(`/api/user/enterprise/admin/${row.id}/images`));
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
      width: 150,
      render: (_, row) => (
        <span>
          {row.username} <Text type='secondary'>(#{row.user_id})</Text>
        </span>
      ),
    },
    {
      title: t('企业名称'),
      dataIndex: 'company_name',
      width: 180,
    },
    {
      title: t('统一社会信用代码'),
      dataIndex: 'uscc_masked',
      width: 150,
    },
    {
      title: t('法人代表姓名'),
      dataIndex: 'legal_rep_name',
      width: 110,
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
      width: 280,
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
              {t('查看企业信息')}
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
              <IconShield className='mr-2' />
              <Text>{t('企业认证')}</Text>
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

      {/* 企业信息核对 Modal：文字 + 图片并排 */}
      <Modal
        title={t('企业信息核对')}
        visible={inspectVisible}
        onCancel={closeInspect}
        footer={<Button onClick={closeInspect}>{t('关闭')}</Button>}
        width={820}
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
                <Text strong>{t('企业名称')}：</Text>
                <Text copyable>{inspectData.reveal.company_name}</Text>
              </div>
              <div>
                <Text strong>{t('统一社会信用代码')}：</Text>
                <Text copyable>{inspectData.reveal.uscc}</Text>
              </div>
              <div>
                <Text strong>{t('法人代表姓名')}：</Text>
                <Text>{inspectData.reveal.legal_rep_name}</Text>
              </div>
              <div>
                <Text strong>{t('法人身份证号')}：</Text>
                <Text copyable>{inspectData.reveal.legal_rep_id}</Text>
              </div>
            </div>
            {inspectData.images ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Text type='secondary' size='small'>{t('营业执照')}</Text>
                  <Image
                    src={inspectData.images.license_image}
                    alt='license'
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Text type='secondary' size='small'>{t('法人身份证正面')}</Text>
                  <Image
                    src={inspectData.images.legal_front_image}
                    alt='legal-front'
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Text type='secondary' size='small'>{t('法人身份证背面')}</Text>
                  <Image
                    src={inspectData.images.legal_back_image}
                    alt='legal-back'
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
            ) : (
              <Text type='tertiary'>{t('该记录未上传企业认证图片')}</Text>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
