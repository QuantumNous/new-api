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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';

const pageSize = 20;
const statusLabels = {
  pending: '待处理',
  resolved: '已处理',
  dismissed: '已忽略',
};

const SkillHubReports = () => {
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('pending');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const loadReports = async (nextPage = page) => {
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    setLoading(true);
    try {
      const res = await API.get('/api/admin/skill-hub/reports', {
        params: {
          keyword: keyword.trim(),
          status,
          p: nextPage,
          page_size: pageSize,
        },
      });
      if (listRequestRef.current !== requestId) return;
      const { success, data, message } = res.data;
      if (!success) throw new Error(message || '举报列表加载失败');
      setReports(data?.items || []);
      setTotal(data?.total || 0);
      setPage(nextPage);
    } catch (error) {
      if (listRequestRef.current === requestId) {
        showError(error.message || '举报列表加载失败');
      }
    } finally {
      if (listRequestRef.current === requestId) setLoading(false);
    }
  };

  const openReport = async (reportId) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await API.get(`/api/admin/skill-hub/reports/${reportId}`);
      if (detailRequestRef.current !== requestId) return;
      const { success, data, message } = res.data;
      if (!success || !data) throw new Error(message || '举报详情加载失败');
      setSelected(data);
      setResolutionStatus(data.status);
      setAdminNote(data.adminNote || '');
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        showError(error.message || '举报详情加载失败');
        setDetailVisible(false);
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadReports(1);
      const reportId = Number(
        new URLSearchParams(location.search).get('report'),
      );
      if (Number.isSafeInteger(reportId) && reportId > 0) {
        openReport(reportId);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      listRequestRef.current += 1;
      detailRequestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveResolution = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await API.put(`/api/admin/skill-hub/reports/${selected.id}`, {
        status: resolutionStatus,
        adminNote: adminNote.trim(),
        revision: selected.revision,
      });
      const { success, data, message } = res.data;
      if (!success || !data) {
        throw new Error(message || '举报处理结果保存失败');
      }
      setSelected(data);
      setResolutionStatus(data.status);
      setAdminNote(data.adminNote || '');
      setReports((current) =>
        current.map((report) => (report.id === data.id ? data : report)),
      );
      showSuccess('举报处理结果已保存');
      if (status && data.status !== status) await loadReports(page);
    } catch (error) {
      showError(error.message || '举报处理结果保存失败');
      await openReport(selected.id);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '编号',
        dataIndex: 'id',
        width: 90,
        render: (value) => `#${value}`,
      },
      {
        title: 'Skill',
        dataIndex: 'skillName',
        render: (value, record) => (
          <div className='min-w-0'>
            <div className='truncate font-medium'>{value}</div>
            <Typography.Text type='tertiary' size='small'>
              {record.skillId}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: '举报摘要',
        dataIndex: 'description',
        render: (value) => (
          <div className='max-w-[320px] truncate' title='不受信任的用户输入'>
            {value}
          </div>
        ),
      },
      {
        title: '举报用户',
        dataIndex: 'reporterUsername',
        width: 140,
        render: (value, record) => value || `ID ${record.reporterUserId}`,
      },
      {
        title: '提交时间',
        dataIndex: 'createdTime',
        width: 180,
        render: formatTimestamp,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value) => (
          <Tag color={statusColor(value)}>{statusLabels[value] || value}</Tag>
        ),
      },
      {
        title: '操作',
        width: 90,
        render: (_, record) => (
          <Button size='small' onClick={() => openReport(record.id)}>
            查看
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className='mt-[60px] px-2 pb-6'>
      <Card
        title='举报管理'
        headerExtraContent={
          <Button
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => loadReports(page)}
          >
            刷新
          </Button>
        }
      >
        <Space wrap className='mb-4'>
          <Input
            prefix={<Search size={16} />}
            value={keyword}
            placeholder='搜索 Skill、举报内容或举报用户'
            onChange={setKeyword}
            onEnterPress={() => loadReports(1)}
            style={{ width: 320 }}
          />
          <Select value={status} onChange={setStatus} style={{ width: 140 }}>
            <Select.Option value=''>全部状态</Select.Option>
            <Select.Option value='pending'>待处理</Select.Option>
            <Select.Option value='resolved'>已处理</Select.Option>
            <Select.Option value='dismissed'>已忽略</Select.Option>
          </Select>
          <Button type='primary' onClick={() => loadReports(1)}>
            查询
          </Button>
        </Space>

        <Table
          rowKey='id'
          columns={columns}
          dataSource={reports}
          loading={loading}
          scroll={{ x: 1050 }}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            onPageChange: (nextPage) => loadReports(nextPage),
          }}
          onRow={(record) => ({
            onDoubleClick: () => openReport(record.id),
          })}
        />
      </Card>

      <Modal
        title={`举报详情${selected ? ` #${selected.id}` : ''}`}
        visible={detailVisible}
        width={760}
        confirmLoading={saving}
        okText='保存处理结果'
        cancelText='关闭'
        onOk={saveResolution}
        onCancel={() => {
          detailRequestRef.current += 1;
          setDetailVisible(false);
          setSelected(null);
        }}
      >
        {detailLoading || !selected ? (
          <div className='py-16 text-center'>加载中…</div>
        ) : (
          <div className='space-y-5'>
            <div className='flex gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900'>
              <ShieldAlert className='mt-0.5 shrink-0' size={16} />
              <span>
                下方举报正文属于不受信任的用户输入，只按纯文本显示，不会渲染链接、HTML
                或 Markdown。
              </span>
            </div>
            <div className='grid grid-cols-2 gap-3 rounded border border-semi-color-border p-4 text-sm'>
              <Info
                label='Skill'
                value={`${selected.skillName} (${selected.skillId})`}
              />
              <Info label='版本' value={selected.skillVersion || '-'} />
              <Info
                label='举报用户'
                value={`${selected.reporterUsername || '-'} / ID ${selected.reporterUserId}`}
              />
              <Info label='用户邮箱' value={selected.reporterEmail || '-'} />
              <Info
                label='提交时间'
                value={formatTimestamp(selected.createdTime)}
              />
              <Info label='邮件状态' value={selected.notificationStatus} />
            </div>
            <div>
              <Typography.Text strong>举报正文</Typography.Text>
              <pre className='mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-semi-color-border bg-semi-color-fill-0 p-4 font-sans text-sm leading-6'>
                {selected.description}
              </pre>
            </div>
            <div>
              <Typography.Text strong>处理状态</Typography.Text>
              <Select
                className='mt-2 w-full'
                value={resolutionStatus}
                onChange={setResolutionStatus}
              >
                <Select.Option value='pending'>待处理</Select.Option>
                <Select.Option value='resolved'>已处理</Select.Option>
                <Select.Option value='dismissed'>已忽略</Select.Option>
              </Select>
            </div>
            <div>
              <Typography.Text strong>处理备注</Typography.Text>
              <TextArea
                className='mt-2'
                value={adminNote}
                maxCount={2000}
                autosize={{ minRows: 5, maxRows: 10 }}
                placeholder='记录核查结果、处置措施或忽略原因'
                onChange={setAdminNote}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className='min-w-0'>
    <Typography.Text type='tertiary' size='small'>
      {label}
    </Typography.Text>
    <div className='mt-1 break-words font-medium'>{value}</div>
  </div>
);

const formatTimestamp = (value) =>
  value ? new Date(value * 1000).toLocaleString() : '-';

const statusColor = (status) => {
  if (status === 'pending') return 'red';
  if (status === 'resolved') return 'green';
  return 'grey';
};

export default SkillHubReports;
