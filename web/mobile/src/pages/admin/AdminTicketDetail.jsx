import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Dialog, NavBar, TextArea } from 'antd-mobile';

import { API } from '@classic/helpers/api';

import TicketThread from '../../components/ticket/TicketThread';
import { showError, showSuccess } from '../../shims/classic-utils';

const AdminTicketDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(
        `/api/user/feedback/admin/topics/${id}?page=1&page_size=200`,
      );
      if (res.data.success) {
        setDetail(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const res = await API.post(
        `/api/user/feedback/admin/topics/${id}/messages`,
        { content: reply.trim(), images: [] },
      );
      if (res.data.success) {
        setReply('');
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

  const setStatus = (statusValue, label) => {
    Dialog.confirm({
      content: `将工单标记为「${label}」？`,
      onConfirm: async () => {
        try {
          const res = await API.put(
            `/api/user/feedback/admin/topics/${id}/status`,
            { status: statusValue },
          );
          if (res.data.success) {
            showSuccess('已更新');
            load();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e);
        }
      },
    });
  };

  const topicStatus = detail?.topic?.status;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          detail && (
            <span style={{ display: 'flex', gap: 4 }}>
              {topicStatus !== 2 && topicStatus !== 4 && (
                <Button size='mini' fill='none' onClick={() => setStatus(2, '处理中')}>
                  转处理中
                </Button>
              )}
              {topicStatus !== 4 && (
                <Button size='mini' fill='none' onClick={() => setStatus(4, '已关闭')}>
                  关闭
                </Button>
              )}
            </span>
          )
        }
      >
        工单处理
      </NavBar>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {detail && (
          <TicketThread
            topic={detail.topic}
            messages={detail.messages}
            selfIsAdmin
          />
        )}
      </div>
      {topicStatus !== 4 && (
        <div
          style={{
            borderTop: '0.5px solid rgba(17,24,39,0.06)',
            background: '#fff',
            padding: 8,
            paddingBottom: 'calc(8px + var(--safe-area-inset-bottom))',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              flex: 1,
              background: '#f1f2f6',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            <TextArea
              placeholder='回复用户…'
              value={reply}
              onChange={setReply}
              rows={1}
              autoSize={{ minRows: 1, maxRows: 4 }}
            />
          </div>
          <Button
            color='primary'
            loading={submitting}
            disabled={!reply.trim()}
            onClick={handleReply}
          >
            回复
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminTicketDetail;
