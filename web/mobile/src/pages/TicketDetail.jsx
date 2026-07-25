import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Dialog, NavBar, TextArea } from 'antd-mobile';

import { API } from '@classic/helpers/api';

import TicketThread from '../components/ticket/TicketThread';
import { showError, showSuccess } from '../shims/classic-utils';

const TicketDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(
        `/api/user/feedback/topics/${id}?page=1&page_size=200`,
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
      const res = await API.post(`/api/user/feedback/topics/${id}/messages`, {
        content: reply.trim(),
        images: [],
      });
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

  const handleClose = () => {
    Dialog.confirm({
      content: '确定关闭这个工单吗？',
      onConfirm: async () => {
        try {
          const res = await API.put(`/api/user/feedback/topics/${id}/close`);
          if (res.data.success) {
            showSuccess('工单已关闭');
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

  const closed = detail?.topic?.status === 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          !closed &&
          detail && (
            <Button size='mini' fill='none' onClick={handleClose}>
              关闭工单
            </Button>
          )
        }
      >
        工单详情
      </NavBar>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {detail && (
          <TicketThread
            topic={detail.topic}
            messages={detail.messages}
            selfIsAdmin={false}
          />
        )}
      </div>
      {!closed && (
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
              placeholder='回复工单…'
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
            发送
          </Button>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;
