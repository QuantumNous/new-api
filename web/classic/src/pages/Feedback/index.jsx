import React, { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Select,
  SideSheet,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconComment } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import FeedbackThread from '../../components/feedback/FeedbackThread';
import {
  ADMIN_FEEDBACK_BASE,
  FEEDBACK_ROLE_ADMIN,
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY,
  FEEDBACK_CATEGORY_OPTIONS,
} from '../../components/feedback/feedbackHelpers';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: 0, label: '全部状态' },
  { value: 1, label: '待处理' },
  { value: 2, label: '处理中' },
  { value: 3, label: '已回复' },
  { value: 4, label: '已关闭' },
];

export default function FeedbackPage() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // 筛选
  const [filters, setFilters] = useState({
    user_id: '',
    username: '',
    status: 0,
    category: 0,
    keyword: '',
  });

  // 详情抽屉
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);

  const buildQuery = (p, ps, f) => {
    const params = new URLSearchParams();
    params.set('page', p);
    params.set('page_size', ps);
    if (f.user_id) params.set('user_id', f.user_id);
    if (f.username) params.set('username', f.username);
    if (f.status) params.set('status', f.status);
    if (f.category) params.set('category', f.category);
    if (f.keyword) params.set('keyword', f.keyword);
    return params.toString();
  };

  // f 默认取当前 filters；重置等场景显式传入清空后的对象，避免闭包读到旧值。
  const loadList = async (p = page, ps = pageSize, f = filters) => {
    setLoading(true);
    try {
      const res = await API.get(
        `${ADMIN_FEEDBACK_BASE}/topics?${buildQuery(p, ps, f)}`,
      );
      if (res.data.success) {
        setList(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        showError(res.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    loadList(1, pageSize);
  };

  const handleReset = () => {
    const cleared = {
      user_id: '',
      username: '',
      status: 0,
      category: 0,
      keyword: '',
    };
    setFilters(cleared);
    setPage(1);
    loadList(1, pageSize, cleared);
  };

  const openDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await API.get(
        `${ADMIN_FEEDBACK_BASE}/topics/${id}?page=1&page_size=200`,
      );
      if (res.data.success) {
        setDetail(res.data.data);
        loadList(); // 刷新未读
      } else {
        showError(res.data.message);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleReply = async (content, images) => {
    setSending(true);
    try {
      const res = await API.post(
        `${ADMIN_FEEDBACK_BASE}/topics/${detail.topic.id}/messages`,
        { content, images },
      );
      if (res.data.success) {
        await openDetail(detail.topic.id);
        return true;
      }
      showError(res.data.message);
      return false;
    } catch {
      showError(t('发送失败'));
      return false;
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    try {
      const res = await API.put(
        `${ADMIN_FEEDBACK_BASE}/topics/${detail.topic.id}/status`,
        {
          status,
        },
      );
      if (res.data.success) {
        showSuccess(t('状态已更新'));
        await openDetail(detail.topic.id);
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('用户'),
      dataIndex: 'username',
      render: (v, r) => v || `#${r.user_id}`,
    },
    {
      title: t('标题'),
      dataIndex: 'title',
      render: (v, r) => (
        <Space>
          {r.admin_unread && <Badge dot />}
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 220 }}>
            {v}
          </Text>
        </Space>
      ),
    },
    {
      title: t('分类'),
      dataIndex: 'category',
      width: 110,
      render: (v) => (
        <Tag color='white'>{t((FEEDBACK_CATEGORY[v] || {}).label)}</Tag>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (v) => {
        const st = FEEDBACK_STATUS[v] || {};
        return <Tag color={st.color}>{t(st.label)}</Tag>;
      },
    },
    { title: t('消息数'), dataIndex: 'message_count', width: 80 },
    {
      title: t('最后回复'),
      dataIndex: 'last_reply_at',
      width: 170,
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: t('操作'),
      width: 90,
      render: (_, r) => (
        <Button theme='light' size='small' onClick={() => openDetail(r.id)}>
          {t('查看')}
        </Button>
      ),
    },
  ];

  return (
    <div className='p-2 md:p-4'>
      <div className='flex items-center gap-2 mb-4'>
        <IconComment />
        <Title heading={4} style={{ margin: 0 }}>
          {t('工单管理')}
        </Title>
      </div>

      <Space wrap className='mb-4'>
        <Input
          prefix={t('用户ID')}
          value={filters.user_id}
          onChange={(v) =>
            setFilters({ ...filters, user_id: v.replace(/\D/g, '') })
          }
          style={{ width: 130 }}
        />
        <Input
          prefix={t('用户名')}
          value={filters.username}
          onChange={(v) => setFilters({ ...filters, username: v })}
          style={{ width: 160 }}
        />
        <Select
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          style={{ width: 130 }}
          optionList={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: t(o.label),
          }))}
        />
        <Select
          value={filters.category}
          onChange={(v) => setFilters({ ...filters, category: v })}
          style={{ width: 130 }}
          optionList={[
            { value: 0, label: t('全部分类') },
            ...FEEDBACK_CATEGORY_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.label),
            })),
          ]}
        />
        <Input
          prefix={t('标题')}
          value={filters.keyword}
          onChange={(v) => setFilters({ ...filters, keyword: v })}
          style={{ width: 180 }}
          onEnterPress={handleSearch}
        />
        <Button theme='solid' type='primary' onClick={handleSearch}>
          {t('查询')}
        </Button>
        <Button onClick={handleReset}>{t('重置')}</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={list}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize,
          total,
          showSizeChanger: true,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (ps) => {
            setPageSize(ps);
            setPage(1);
          },
        }}
      />

      <SideSheet
        title={detail ? detail.topic.title : t('工单详情')}
        visible={!!detail}
        onCancel={() => {
          setDetail(null);
          loadList();
        }}
        width={560}
      >
        {detail && (
          <div className='flex flex-col h-full'>
            <div className='flex items-center justify-between mb-3'>
              <Space>
                <Text type='tertiary'>
                  {detail.topic.username || `#${detail.topic.user_id}`}
                </Text>
                <Tag color='white'>
                  {t((FEEDBACK_CATEGORY[detail.topic.category] || {}).label)}
                </Tag>
                <Tag color={(FEEDBACK_STATUS[detail.topic.status] || {}).color}>
                  {t((FEEDBACK_STATUS[detail.topic.status] || {}).label)}
                </Tag>
              </Space>
              <Space>
                {detail.topic.status !== 2 && detail.topic.status !== 4 && (
                  <Button size='small' onClick={() => setStatus(2)}>
                    {t('标记处理中')}
                  </Button>
                )}
                {detail.topic.status !== 4 && (
                  <Button
                    size='small'
                    type='danger'
                    onClick={() => setStatus(4)}
                  >
                    {t('关闭')}
                  </Button>
                )}
              </Space>
            </div>
            <FeedbackThread
              messages={detail.messages}
              viewerRole={FEEDBACK_ROLE_ADMIN}
              imageBase={ADMIN_FEEDBACK_BASE}
              onSend={handleReply}
              sending={sending}
              placeholder={t('输入回复，将以「官方客服」身份发送…')}
            />
          </div>
        )}
      </SideSheet>
    </div>
  );
}
