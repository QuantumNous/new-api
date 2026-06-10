import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Image,
  Input,
  Select,
  SideSheet,
  Space,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconComment, IconImage, IconClose } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { createCardProPagination } from '../../helpers/utils';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import CardPro from '../../components/common/ui/CardPro';
import FeedbackThread from '../../components/feedback/FeedbackThread';
import {
  USER_FEEDBACK_BASE,
  FEEDBACK_ROLE_USER,
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY,
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_MAX_IMAGES,
  encodeFeedbackImageFiles,
} from '../../components/feedback/feedbackHelpers';

const { Text } = Typography;

const STATUS_OPTIONS = [
  { value: 0, label: '全部状态' },
  { value: 1, label: '待处理' },
  { value: 2, label: '处理中' },
  { value: 3, label: '已回复' },
  { value: 4, label: '已关闭' },
];

// 通知侧边栏未读角标即时刷新（新建首单后恢复轮询 + 打开/关闭工单清未读）。
const notifyChanged = () => window.dispatchEvent(new Event('feedback:changed'));

export default function MyFeedbackPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // 筛选（用户只有自己的工单，无「按用户筛选」）
  const [filters, setFilters] = useState({
    status: 0,
    category: 0,
    keyword: '',
  });

  // 详情抽屉
  const [detail, setDetail] = useState(null);
  const [sending, setSending] = useState(false);

  // 新建抽屉
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ category: 2, title: '', content: '' });
  const [createImages, setCreateImages] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createDragging, setCreateDragging] = useState(false);
  const createFileRef = useRef(null);

  const buildQuery = (p, ps, f) => {
    const params = new URLSearchParams();
    params.set('page', p);
    params.set('page_size', ps);
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
        `${USER_FEEDBACK_BASE}/topics?${buildQuery(p, ps, f)}`,
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
    const cleared = { status: 0, category: 0, keyword: '' };
    setFilters(cleared);
    setPage(1);
    loadList(1, pageSize, cleared);
  };

  const openDetail = async (id) => {
    try {
      const res = await API.get(
        `${USER_FEEDBACK_BASE}/topics/${id}?page=1&page_size=200`,
      );
      if (res.data.success) {
        setDetail(res.data.data);
        loadList(); // 刷新未读
        notifyChanged(); // 打开工单清未读 → 角标即时刷新
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('查询失败'));
    }
  };

  const handleReply = async (content, images) => {
    setSending(true);
    try {
      const res = await API.post(
        `${USER_FEEDBACK_BASE}/topics/${detail.topic.id}/messages`,
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

  const handleClose = async () => {
    try {
      const res = await API.put(
        `${USER_FEEDBACK_BASE}/topics/${detail.topic.id}/close`,
      );
      if (res.data.success) {
        showSuccess(t('工单已关闭'));
        await openDetail(detail.topic.id);
        loadList();
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  // ─── 新建工单 ───────────────────────────────────────────────────────────────

  const resetCreate = () => {
    setForm({ category: 2, title: '', content: '' });
    setCreateImages([]);
  };

  // 点击选择与拖拽共用：处理一批文件 → 追加到 createImages。
  const addCreateFiles = async (fileList) => {
    const { encoded, error } = await encodeFeedbackImageFiles(
      fileList,
      createImages.length,
    );
    if (error) showError(t(error));
    // 函数式封顶：即使并发拖拽/选择读到的是旧 count，也保证不超过上限。
    if (encoded.length)
      setCreateImages((prev) =>
        [...prev, ...encoded].slice(0, FEEDBACK_MAX_IMAGES),
      );
  };

  const handleCreateFiles = async (e) => {
    const fileList = e.target.files;
    e.target.value = '';
    await addCreateFiles(fileList);
  };

  const handleCreateDrop = async (e) => {
    e.preventDefault();
    setCreateDragging(false);
    if (createImages.length >= FEEDBACK_MAX_IMAGES) {
      showError(t('最多上传 3 张图片'));
      return;
    }
    await addCreateFiles(e.dataTransfer.files);
  };

  const submitCreate = async () => {
    if (!form.title.trim()) {
      showError(t('请填写标题'));
      return;
    }
    if (!form.content.trim() && createImages.length === 0) {
      showError(t('请填写内容或上传图片'));
      return;
    }
    setCreating(true);
    try {
      const res = await API.post(`${USER_FEEDBACK_BASE}/topics`, {
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        images: createImages,
      });
      if (res.data.success) {
        showSuccess(t('工单已创建'));
        resetCreate();
        setShowCreate(false);
        await loadList(1, pageSize);
        setPage(1);
        notifyChanged();
        openDetail(res.data.data.id);
      } else {
        showError(res.data.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('标题'),
      dataIndex: 'title',
      render: (v, r) => (
        <Space>
          {r.user_unread && <Badge dot />}
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
      title: t('创建时间'),
      dataIndex: 'created_at',
      width: 170,
      render: (v) => new Date(v).toLocaleString(),
    },
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

  const descriptionArea = (
    <div className='flex items-center text-blue-500'>
      <IconComment className='mr-2' />
      <Text>{t('我的工单')}</Text>
    </div>
  );

  const actionsArea = (
    <Space wrap className='w-full'>
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
      <Button
        theme='solid'
        type='secondary'
        onClick={() => {
          resetCreate();
          setShowCreate(true);
        }}
      >
        {t('新建工单')}
      </Button>
    </Space>
  );

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type1'
        descriptionArea={descriptionArea}
        actionsArea={actionsArea}
        paginationArea={createCardProPagination({
          currentPage: page,
          pageSize,
          total,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (ps) => {
            setPageSize(ps);
            setPage(1);
          },
          isMobile,
          t,
        })}
        t={t}
      >
        <Table
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey='id'
          pagination={false}
        />
      </CardPro>

      {/* 详情抽屉 */}
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
                <Tag color='white'>
                  {t((FEEDBACK_CATEGORY[detail.topic.category] || {}).label)}
                </Tag>
                <Tag color={(FEEDBACK_STATUS[detail.topic.status] || {}).color}>
                  {t((FEEDBACK_STATUS[detail.topic.status] || {}).label)}
                </Tag>
              </Space>
              {detail.topic.status !== 4 && (
                <Button size='small' type='danger' onClick={handleClose}>
                  {t('关闭工单')}
                </Button>
              )}
            </div>
            <FeedbackThread
              messages={detail.messages}
              viewerRole={FEEDBACK_ROLE_USER}
              imageBase={USER_FEEDBACK_BASE}
              onSend={handleReply}
              sending={sending}
              placeholder={
                detail.topic.status === 4
                  ? t('回复将重新打开此工单…')
                  : t('输入回复内容…')
              }
            />
          </div>
        )}
      </SideSheet>

      {/* 新建抽屉 */}
      <SideSheet
        title={t('新建工单')}
        visible={showCreate}
        onCancel={() => setShowCreate(false)}
        width={480}
      >
        <div className='flex flex-col gap-3'>
          <div>
            <Text>{t('分类')}</Text>
            <Select
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              className='w-full mt-1'
              optionList={FEEDBACK_CATEGORY_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.label),
              }))}
            />
          </div>
          <div>
            <Text>{t('标题')}</Text>
            <Input
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              maxLength={128}
              placeholder={t('一句话描述你的问题或建议')}
              className='mt-1'
            />
          </div>
          <div>
            <Text>{t('内容')}</Text>
            <TextArea
              value={form.content}
              onChange={(v) => setForm({ ...form, content: v })}
              maxCount={5000}
              autosize={{ minRows: 3, maxRows: 8 }}
              placeholder={t('详细描述…')}
              className='mt-1'
            />
          </div>
          <div
            className={`rounded-md border border-dashed p-3 transition-colors ${
              createDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!createDragging) setCreateDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setCreateDragging(false);
            }}
            onDrop={handleCreateDrop}
          >
            <input
              ref={createFileRef}
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={handleCreateFiles}
            />
            <div className='flex items-center gap-2'>
              <Button
                icon={<IconImage />}
                onClick={() => createFileRef.current?.click()}
                disabled={createImages.length >= FEEDBACK_MAX_IMAGES}
              >
                {t('添加图片')}（{createImages.length}/{FEEDBACK_MAX_IMAGES}）
              </Button>
              <Text size='small' type='tertiary'>
                {createDragging
                  ? t('松开鼠标上传图片')
                  : t('或将图片拖拽到此处')}
              </Text>
            </div>
            {createImages.length > 0 && (
              <div className='flex flex-wrap gap-2 mt-2'>
                {createImages.map((b64, idx) => (
                  <div key={idx} className='relative'>
                    <Image
                      src={`data:image/jpeg;base64,${b64}`}
                      width={64}
                      height={64}
                      preview={false}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                    <IconClose
                      className='absolute -top-1 -right-1 bg-gray-700 text-white rounded-full cursor-pointer'
                      size='small'
                      onClick={() =>
                        setCreateImages((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className='flex justify-end gap-2'>
            <Button onClick={() => setShowCreate(false)}>{t('取消')}</Button>
            <Button
              theme='solid'
              type='primary'
              loading={creating}
              onClick={submitCreate}
            >
              {t('提交')}
            </Button>
          </div>
        </div>
      </SideSheet>
    </div>
  );
}
