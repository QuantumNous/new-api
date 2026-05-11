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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Empty,
  Space,
  Table,
  Tabs,
  TabPane,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError, timestamp2string } from '../../helpers';

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function formatRebatePercent(ratioBps) {
  const percent = Number(ratioBps || 0) / 100;
  return `${Number(percent.toFixed(2))}%`;
}

function buildPageQuery(page, pageSize) {
  return new URLSearchParams({
    p: String(page),
    page_size: String(pageSize),
  }).toString();
}

function SummaryItem({ label, value }) {
  return (
    <div className='rounded-lg bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/40'>
      <div className='text-sm font-semibold'>{value}</div>
      <div className='mt-1 text-xs text-slate-500'>{label}</div>
    </div>
  );
}

export default function InvitationRebateLogPanel({ t, renderQuota }) {
  const [activeTab, setActiveTab] = useState('invitees');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [invitees, setInvitees] = useState([]);
  const [inviteesTotal, setInviteesTotal] = useState(0);
  const [inviteesPage, setInviteesPage] = useState(1);
  const [inviteesPageSize, setInviteesPageSize] = useState(5);
  const [inviteesLoading, setInviteesLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] = useState(5);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await API.get('/api/user/invitation_rebate/self/summary');
      const { success, message, data } = res.data;
      if (success) {
        setSummary(data || {});
      } else {
        showError(message || t('加载邀请返现日志失败'));
      }
    } catch (error) {
      showError(t('加载邀请返现日志失败'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadInvitees = async (
    currentPage = inviteesPage,
    currentPageSize = inviteesPageSize,
  ) => {
    setInviteesLoading(true);
    try {
      const query = buildPageQuery(currentPage, currentPageSize);
      const res = await API.get(
        `/api/user/invitation_rebate/self/invitees?${query}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setInvitees(data?.items || []);
        setInviteesTotal(data?.total || 0);
      } else {
        showError(message || t('加载邀请返现日志失败'));
      }
    } catch (error) {
      showError(t('加载邀请返现日志失败'));
    } finally {
      setInviteesLoading(false);
    }
  };

  const loadRecords = async (
    currentPage = recordsPage,
    currentPageSize = recordsPageSize,
  ) => {
    setRecordsLoading(true);
    try {
      const query = buildPageQuery(currentPage, currentPageSize);
      const res = await API.get(
        `/api/user/invitation_rebate/self/records?${query}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setRecords(data?.items || []);
        setRecordsTotal(data?.total || 0);
      } else {
        showError(message || t('加载邀请返现日志失败'));
      }
    } catch (error) {
      showError(t('加载邀请返现日志失败'));
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadInvitees(inviteesPage, inviteesPageSize);
  }, [inviteesPage, inviteesPageSize]);

  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords(recordsPage, recordsPageSize);
    }
  }, [activeTab, recordsPage, recordsPageSize]);

  const inviteeColumns = useMemo(
    () => [
      {
        title: t('用户'),
        dataIndex: 'username',
        key: 'username',
        render: (username, record) => (
          <div>
            <Text strong>{record.display_name || username || '-'}</Text>
            <div className='text-xs text-slate-500'>
              ID: {record.invitee_user_id}
            </div>
          </div>
        ),
      },
      {
        title: t('注册时间'),
        dataIndex: 'created_at',
        key: 'created_at',
        render: (time) => (time ? timestamp2string(time) : '-'),
      },
      {
        title: t('累计消费'),
        dataIndex: 'total_source_quota',
        key: 'total_source_quota',
        render: (quota) => renderQuota(quota || 0),
      },
      {
        title: t('已结算消费'),
        dataIndex: 'total_settled_source_quota',
        key: 'total_settled_source_quota',
        render: (quota) => renderQuota(quota || 0),
      },
      {
        title: t('返利余额'),
        dataIndex: 'total_rebate_quota',
        key: 'total_rebate_quota',
        render: (quota) => <Tag color='green'>{renderQuota(quota || 0)}</Tag>,
      },
    ],
    [renderQuota, t],
  );

  const recordColumns = useMemo(
    () => [
      {
        title: t('被邀请人用户 ID'),
        dataIndex: 'invitee_user_id',
        key: 'invitee_user_id',
        width: 130,
      },
      {
        title: t('结算消费额度'),
        dataIndex: 'source_quota',
        key: 'source_quota',
        render: (quota) => renderQuota(quota || 0),
      },
      {
        title: t('返利额度'),
        dataIndex: 'rebate_quota',
        key: 'rebate_quota',
        render: (quota) => <Tag color='green'>{renderQuota(quota || 0)}</Tag>,
      },
      {
        title: t('返利比例'),
        dataIndex: 'rebate_ratio_bps',
        key: 'rebate_ratio_bps',
        render: formatRebatePercent,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
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
        render: (time) => (time ? timestamp2string(time) : '-'),
      },
    ],
    [renderQuota, t],
  );

  return (
    <Card
      className='!rounded-xl w-full'
      title={<Text type='tertiary'>{t('邀请返现日志')}</Text>}
    >
      <Space vertical spacing='medium' style={{ width: '100%' }}>
        <Text type='tertiary' size='small'>
          {t('基于被邀请用户实际消费统计，返利进入邀请奖励余额。')}
        </Text>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
          <SummaryItem
            label={t('总返利余额')}
            value={renderQuota(summary?.total_rebate_quota || 0)}
          />
          <SummaryItem
            label={t('已转化余额')}
            value={renderQuota(summary?.converted_quota || 0)}
          />
          <SummaryItem
            label={t('待使用收益')}
            value={renderQuota(summary?.pending_rebate_quota || 0)}
          />
        </div>
        <Tabs
          type='button'
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
        >
          <TabPane tab={t('邀请用户')} itemKey='invitees'>
            <Table
              columns={inviteeColumns}
              dataSource={invitees}
              loading={inviteesLoading || summaryLoading}
              rowKey='invitee_user_id'
              size='small'
              scroll={{ x: 'max-content' }}
              pagination={{
                currentPage: inviteesPage,
                pageSize: inviteesPageSize,
                total: inviteesTotal,
                showSizeChanger: true,
                pageSizeOpts: PAGE_SIZE_OPTIONS,
                onPageChange: setInviteesPage,
                onPageSizeChange: (nextPageSize) => {
                  setInviteesPageSize(nextPageSize);
                  setInviteesPage(1);
                },
              }}
              empty={
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 120, height: 120 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 120, height: 120 }}
                    />
                  }
                  description={t('暂无邀请用户')}
                  style={{ padding: 20 }}
                />
              }
            />
          </TabPane>
          <TabPane tab={t('返利流水')} itemKey='records'>
            <Table
              columns={recordColumns}
              dataSource={records}
              loading={recordsLoading}
              rowKey='id'
              size='small'
              scroll={{ x: 'max-content' }}
              pagination={{
                currentPage: recordsPage,
                pageSize: recordsPageSize,
                total: recordsTotal,
                showSizeChanger: true,
                pageSizeOpts: PAGE_SIZE_OPTIONS,
                onPageChange: setRecordsPage,
                onPageSizeChange: (nextPageSize) => {
                  setRecordsPageSize(nextPageSize);
                  setRecordsPage(1);
                },
              }}
              empty={
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 120, height: 120 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 120, height: 120 }}
                    />
                  }
                  description={t('暂无返利流水')}
                  style={{ padding: 20 }}
                />
              }
            />
          </TabPane>
        </Tabs>
        <Text type='tertiary' size='small'>
          {t('每个用户的返利余额为该被邀请用户贡献的累计返利。')}
        </Text>
      </Space>
    </Card>
  );
}
