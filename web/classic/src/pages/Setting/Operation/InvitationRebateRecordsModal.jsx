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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import {
  API,
  renderQuota,
  showError,
  timestamp2string,
} from '../../../helpers';

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatRebatePercent(ratioBps) {
  const percent = Number(ratioBps || 0) / 100;
  return `${Number(percent.toFixed(2))}%`;
}

function buildQuery(page, pageSize, filters) {
  const params = new URLSearchParams({
    p: String(page),
    page_size: String(pageSize),
  });

  Object.entries(filters).forEach(([key, value]) => {
    const trimmed = String(value || '').trim();
    if (trimmed) {
      params.set(key, trimmed);
    }
  });

  return params.toString();
}

export default function InvitationRebateRecordsModal({ visible, onCancel }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    inviter_user_id: '',
    invitee_user_id: '',
    source_key: '',
    status: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadRecords = async (
    currentPage = page,
    currentPageSize = pageSize,
  ) => {
    setLoading(true);
    try {
      const query = buildQuery(currentPage, currentPageSize, appliedFilters);
      const res = await API.get(`/api/user/invitation_rebate?${query}`);
      const { success, message, data } = res.data;
      if (success) {
        setRecords(data?.items || []);
        setTotal(data?.total || 0);
      } else {
        showError(message || t('加载邀请返利流水失败'));
      }
    } catch (error) {
      showError(t('加载邀请返利流水失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadRecords(page, pageSize);
    }
  }, [visible, page, pageSize, appliedFilters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const nextFilters = {
      inviter_user_id: '',
      invitee_user_id: '',
      source_key: '',
      status: '',
    };
    setFilters(nextFilters);
    setPage(1);
    setAppliedFilters(nextFilters);
  };

  const loadRecordDetail = useCallback(
    async (record) => {
      setDetailVisible(true);
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await API.get(`/api/user/invitation_rebate/${record.id}`);
        const { success, message, data } = res.data;
        if (success) {
          setDetail(data || null);
        } else {
          showError(
            message || t('Failed to load invitation rebate record detail'),
          );
        }
      } catch (error) {
        showError(t('Failed to load invitation rebate record detail'));
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const detailColumns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
      },
      {
        title: t('Source Key'),
        dataIndex: 'source_key',
        key: 'source_key',
        width: 180,
        render: (text) => <Text copyable>{text || '-'}</Text>,
      },
      {
        title: t('Request ID'),
        dataIndex: 'source_request_id',
        key: 'source_request_id',
        width: 180,
        render: (text) => <Text copyable>{text || '-'}</Text>,
      },
      {
        title: t('Settled Source Quota'),
        dataIndex: 'settled_source_quota',
        key: 'settled_source_quota',
        width: 150,
        render: (quota) => <Tag color='grey'>{renderQuota(quota)}</Tag>,
      },
      {
        title: t('Rebate Percentage'),
        dataIndex: 'rebate_ratio_bps',
        key: 'rebate_ratio_bps',
        width: 130,
        render: formatRebatePercent,
      },
      {
        title: t('Rebate Quota'),
        dataIndex: 'rebate_quota',
        key: 'rebate_quota',
        width: 130,
        render: (quota) => <Tag color='green'>{renderQuota(quota)}</Tag>,
      },
      {
        title: t('Remainder Before'),
        dataIndex: 'remainder_before',
        key: 'remainder_before',
        width: 140,
      },
      {
        title: t('Remainder After'),
        dataIndex: 'remainder_after',
        key: 'remainder_after',
        width: 140,
      },
    ],
    [t],
  );

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
      },
      {
        title: t('邀请人用户 ID'),
        dataIndex: 'inviter_user_id',
        key: 'inviter_user_id',
        width: 130,
      },
      {
        title: t('被邀请人用户 ID'),
        dataIndex: 'invitee_user_id',
        key: 'invitee_user_id',
        width: 140,
      },
      {
        title: t('来源类型'),
        dataIndex: 'source_type',
        key: 'source_type',
        width: 160,
        render: (text) => <Text>{text || '-'}</Text>,
      },
      {
        title: t('来源 Key'),
        dataIndex: 'source_key',
        key: 'source_key',
        width: 180,
        render: (text) => <Text copyable>{text || '-'}</Text>,
      },
      {
        title: t('消费额度'),
        dataIndex: 'source_quota',
        key: 'source_quota',
        width: 130,
        render: (quota) => <Tag color='grey'>{renderQuota(quota)}</Tag>,
      },
      {
        title: t('返利额度'),
        dataIndex: 'rebate_quota',
        key: 'rebate_quota',
        width: 130,
        render: (quota) => <Tag color='green'>{renderQuota(quota)}</Tag>,
      },
      {
        title: t('返利百分比'),
        dataIndex: 'rebate_ratio_bps',
        key: 'rebate_ratio_bps',
        width: 120,
        render: formatRebatePercent,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status) => (
          <Tag color={status === 'success' ? 'green' : 'grey'}>
            {status === 'success' ? t('成功') : status || '-'}
          </Tag>
        ),
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (time) => (time ? timestamp2string(time) : '-'),
      },
      {
        title: t('Actions'),
        key: 'actions',
        width: 100,
        render: (_, record) => (
          <Button onClick={() => loadRecordDetail(record)}>
            {t('Details')}
          </Button>
        ),
      },
    ],
    [loadRecordDetail, t],
  );

  return (
    <>
      <Modal
        title={t('邀请返利流水')}
        visible={visible}
        onCancel={onCancel}
        footer={null}
        size='large'
      >
        <div style={{ marginBottom: 12 }}>
          <Text type='tertiary'>
            {t(
              'Cumulative rebate records based on actual invited consumption.',
            )}
          </Text>
        </div>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 150 }}
            value={filters.inviter_user_id}
            placeholder={t('邀请人用户 ID')}
            onChange={(value) => updateFilter('inviter_user_id', value)}
            showClear
          />
          <Input
            style={{ width: 160 }}
            value={filters.invitee_user_id}
            placeholder={t('被邀请人用户 ID')}
            onChange={(value) => updateFilter('invitee_user_id', value)}
            showClear
          />
          <Input
            style={{ width: 180 }}
            value={filters.source_key}
            placeholder={t('来源 Key')}
            onChange={(value) => updateFilter('source_key', value)}
            showClear
          />
          <Select
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => updateFilter('status', value)}
          >
            <Select.Option value=''>{t('全部状态')}</Select.Option>
            <Select.Option value='success'>{t('成功')}</Select.Option>
          </Select>
          <Button type='primary' onClick={handleSearch}>
            {t('搜索')}
          </Button>
          <Button onClick={handleReset}>{t('重置')}</Button>
          <Button onClick={() => loadRecords(page, pageSize)}>
            {t('刷新')}
          </Button>
        </Space>
        <Table
          columns={columns}
          dataSource={records}
          loading={loading}
          rowKey='id'
          size='small'
          scroll={{ x: 'max-content' }}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOpts: PAGE_SIZE_OPTIONS,
            onPageChange: setPage,
            onPageSizeChange: (nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            },
          }}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('暂无邀请返利流水')}
              style={{ padding: 30 }}
            />
          }
        />
      </Modal>
      <Modal
        title={t('Invitation Rebate Settlement Detail')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        size='large'
      >
        <div style={{ marginBottom: 12 }}>
          <Text type='tertiary'>
            {detail?.legacy
              ? t(
                  'Legacy rebate records only retain the trigger source key and do not include settlement item details.',
                )
              : t(
                  'Each row shows one consumed request included in this cumulative rebate settlement.',
                )}
          </Text>
        </div>
        <Table
          columns={detailColumns}
          dataSource={detail?.items || []}
          loading={detailLoading}
          rowKey='id'
          size='small'
          scroll={{ x: 'max-content' }}
          pagination={false}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('No settlement item details found')}
              style={{ padding: 30 }}
            />
          }
        />
      </Modal>
    </>
  );
}
