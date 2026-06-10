import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Image,
  Input,
  Select,
  Spin,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconComment,
  IconArrowLeft,
  IconImage,
  IconClose,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import FeedbackThread from '../../../feedback/FeedbackThread';
import {
  USER_FEEDBACK_BASE,
  FEEDBACK_ROLE_USER,
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY,
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_MAX_IMAGES,
  compressImageToBase64,
} from '../../../feedback/feedbackHelpers';

const { Text, Title } = Typography;

export default function FeedbackConsult() {
  const { t } = useTranslation();
  const [topics, setTopics] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [detail, setDetail] = useState(null); // { topic, messages }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ category: 2, title: '', content: '' });
  const [createImages, setCreateImages] = useState([]);
  const [creating, setCreating] = useState(false);
  const createFileRef = useRef(null);

  const loadTopics = async () => {
    setLoadingList(true);
    try {
      const res = await API.get(
        `${USER_FEEDBACK_BASE}/topics?page=1&page_size=50`,
      );
      if (res.data.success) setTopics(res.data.data || []);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const openTopic = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await API.get(
        `${USER_FEEDBACK_BASE}/topics/${id}?page=1&page_size=200`,
      );
      if (res.data.success) {
        setDetail(res.data.data);
        loadTopics(); // 刷新卡片内未读红点
        // 通知侧边栏角标即时刷新（新建首单后恢复轮询 + 打开工单清未读）
        window.dispatchEvent(new Event('feedback:changed'));
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
        `${USER_FEEDBACK_BASE}/topics/${detail.topic.id}/messages`,
        { content, images },
      );
      if (res.data.success) {
        await openTopic(detail.topic.id);
        return true;
      }
      showError(res.data.message);
      return false;
    } catch (e) {
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
        await openTopic(detail.topic.id);
        loadTopics();
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const handleCreateFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = FEEDBACK_MAX_IMAGES - createImages.length;
    if (room <= 0) {
      showError(t('最多上传 3 张图片'));
      return;
    }
    try {
      const encoded = await Promise.all(
        files.slice(0, room).map((f) => compressImageToBase64(f)),
      );
      setCreateImages((prev) => [...prev, ...encoded]);
    } catch {
      showError(t('图片处理失败'));
    }
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
        setForm({ category: 2, title: '', content: '' });
        setCreateImages([]);
        setShowCreate(false);
        await loadTopics();
        openTopic(res.data.data.id);
      } else {
        showError(res.data.message);
      }
    } finally {
      setCreating(false);
    }
  };

  // ─── 渲染 ───────────────────────────────────────────────────────────────────

  const renderTopicRow = (tp) => {
    const st = FEEDBACK_STATUS[tp.status] || {};
    const cat = FEEDBACK_CATEGORY[tp.category] || {};
    return (
      <div
        key={tp.id}
        className='flex items-center justify-between py-3 px-2 border-b cursor-pointer hover:bg-gray-50 rounded'
        onClick={() => openTopic(tp.id)}
      >
        <div className='flex items-center gap-2 min-w-0'>
          {tp.user_unread && <Badge dot />}
          <Text ellipsis={{ showTooltip: true }} className='max-w-[200px]'>
            {tp.title}
          </Text>
          <Tag size='small' color='white'>
            {t(cat.label)}
          </Tag>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          <Tag size='small' color={st.color}>
            {t(st.label)}
          </Tag>
          <Text size='small' type='tertiary'>
            {new Date(tp.last_reply_at).toLocaleDateString()}
          </Text>
        </div>
      </div>
    );
  };

  const header = (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <IconComment />
        <Title heading={6} style={{ margin: 0 }}>
          {t('我的工单')}
        </Title>
      </div>
      {!detail && !showCreate && (
        <Button
          theme='solid'
          type='primary'
          size='small'
          onClick={() => setShowCreate(true)}
        >
          {t('新建工单')}
        </Button>
      )}
    </div>
  );

  // 详情视图
  if (detail) {
    const st = FEEDBACK_STATUS[detail.topic.status] || {};
    const closed = detail.topic.status === 4;
    return (
      <Card title={header}>
        <div className='flex items-center justify-between mb-2'>
          <Button
            icon={<IconArrowLeft />}
            theme='borderless'
            onClick={() => {
              setDetail(null);
              loadTopics();
            }}
          >
            {t('返回列表')}
          </Button>
          <div className='flex items-center gap-2'>
            <Tag color={st.color}>{t(st.label)}</Tag>
            {!closed && (
              <Button
                size='small'
                type='danger'
                theme='borderless'
                onClick={handleClose}
              >
                {t('关闭工单')}
              </Button>
            )}
          </div>
        </div>
        <Title heading={6} style={{ marginBottom: 8 }}>
          {detail.topic.title}
        </Title>
        <FeedbackThread
          messages={detail.messages}
          viewerRole={FEEDBACK_ROLE_USER}
          imageBase={USER_FEEDBACK_BASE}
          onSend={handleReply}
          sending={sending}
          placeholder={closed ? t('回复将重新打开此工单…') : t('输入回复内容…')}
        />
      </Card>
    );
  }

  // 新建视图
  if (showCreate) {
    return (
      <Card title={header}>
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
          <div>
            <input
              ref={createFileRef}
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={handleCreateFiles}
            />
            <Button
              icon={<IconImage />}
              onClick={() => createFileRef.current?.click()}
              disabled={createImages.length >= FEEDBACK_MAX_IMAGES}
            >
              {t('添加图片')}（{createImages.length}/{FEEDBACK_MAX_IMAGES}）
            </Button>
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
      </Card>
    );
  }

  // 列表视图
  return (
    <Card title={header}>
      {loadingList ? (
        <div className='flex justify-center py-8'>
          <Spin />
        </div>
      ) : topics.length === 0 ? (
        <div className='flex flex-col items-center py-8 gap-2'>
          <Text type='tertiary'>
            {t('还没有工单，点击「新建工单」向我们反馈')}
          </Text>
        </div>
      ) : (
        <div>{topics.map(renderTopicRow)}</div>
      )}
    </Card>
  );
}
