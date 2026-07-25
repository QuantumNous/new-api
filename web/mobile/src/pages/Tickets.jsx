import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  List,
  NavBar,
  Picker,
  Popup,
  PullToRefresh,
  TextArea,
  Input,
} from 'antd-mobile';

import { API } from '@classic/helpers/api';

import { showError, showSuccess } from '../shims/classic-utils';
import {
  FEEDBACK_CATEGORY,
  FEEDBACK_STATUS,
  formatTs,
} from '../utils/review';

const categoryColumns = [
  Object.entries(FEEDBACK_CATEGORY).map(([v, label]) => ({
    label,
    value: Number(v),
  })),
];

const Tickets = () => {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [category, setCategory] = useState(2);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/api/user/feedback/topics?page=1&page_size=50');
      if (res.data.success) {
        setList(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) {
      showError('请填写标题');
      return;
    }
    if (!content.trim()) {
      showError('请描述你的问题');
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post('/api/user/feedback/topics', {
        category,
        title: title.trim(),
        content: content.trim(),
        images: [],
      });
      if (res.data.success) {
        showSuccess('工单已提交');
        setCreateVisible(false);
        setTitle('');
        setContent('');
        load();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          <Button
            size='small'
            color='primary'
            fill='none'
            onClick={() => setCreateVisible(true)}
          >
            新建
          </Button>
        }
      >
        我的工单
      </NavBar>
      <PullToRefresh onRefresh={load}>
        {list.length > 0 ? (
          <List className='m-list-card' style={{ marginTop: 12 }}>
            {list.map((t) => {
              const st = FEEDBACK_STATUS[t.status] || {};
              return (
                <List.Item
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  description={`${FEEDBACK_CATEGORY[t.category] || '其他'} · ${formatTs(t.created_at)} · ${t.message_count} 条消息`}
                  extra={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!!t.user_unread && (
                        <span className='m-badge danger'>新回复</span>
                      )}
                      <span className={`m-badge ${st.badge || ''}`}>
                        {st.text}
                      </span>
                    </span>
                  }
                >
                  {t.title}
                </List.Item>
              );
            })}
          </List>
        ) : (
          <p
            style={{
              textAlign: 'center',
              color: '#9aa1ad',
              fontSize: 14,
              marginTop: 48,
            }}
          >
            暂无工单，遇到问题点右上角新建
          </p>
        )}
      </PullToRefresh>

      <Popup
        visible={createVisible}
        onMaskClick={() => setCreateVisible(false)}
        bodyStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          paddingBottom: 'calc(16px + var(--safe-area-inset-bottom))',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 14 }}>
          新建工单
        </div>
        <div
          className='m-config-chip active'
          style={{ display: 'inline-block', marginBottom: 12 }}
          onClick={() => setCategoryPickerVisible(true)}
        >
          分类：{FEEDBACK_CATEGORY[category]}
        </div>
        <Picker
          columns={categoryColumns}
          visible={categoryPickerVisible}
          value={[category]}
          onClose={() => setCategoryPickerVisible(false)}
          onConfirm={(v) => setCategory(v[0])}
        />
        <div
          style={{
            background: '#f1f2f6',
            borderRadius: 10,
            padding: '8px 12px',
            marginBottom: 10,
          }}
        >
          <Input placeholder='标题（128 字内）' value={title} onChange={setTitle} />
        </div>
        <div
          style={{
            background: '#f1f2f6',
            borderRadius: 10,
            padding: '8px 12px',
            marginBottom: 16,
          }}
        >
          <TextArea
            placeholder='详细描述你的问题…'
            value={content}
            onChange={setContent}
            rows={4}
          />
        </div>
        <Button block color='primary' loading={submitting} onClick={handleCreate}>
          提交工单
        </Button>
      </Popup>
    </div>
  );
};

export default Tickets;
