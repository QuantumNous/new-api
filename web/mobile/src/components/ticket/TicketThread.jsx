import React from 'react';

import { FEEDBACK_CATEGORY, FEEDBACK_STATUS, formatTs } from '../../utils/review';

// 工单消息线程（用户端/管理端共用）。selfRole: 当前查看者的 author_role，
// 用于决定气泡靠左还是靠右。
const TicketThread = ({ topic, messages = [], selfIsAdmin = false }) => {
  const status = FEEDBACK_STATUS[topic?.status] || {};

  return (
    <div style={{ padding: 12 }}>
      <div className='m-card' style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{topic?.title}</div>
          <span className={`m-badge ${status.badge || ''}`}>{status.text}</span>
        </div>
        <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 6 }}>
          {FEEDBACK_CATEGORY[topic?.category] || '其他'} · #{topic?.id}
          {topic?.username ? ` · ${topic.username}` : ''} ·{' '}
          {formatTs(topic?.created_at)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg) => {
          const isAdminMsg = msg.author_role >= 10;
          const mine = selfIsAdmin ? isAdminMsg : !isAdminMsg;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                className={
                  mine ? 'm-feed-user-bubble' : 'm-feed-assistant-bubble'
                }
              >
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                >
                  {msg.author_name || (isAdminMsg ? '官方客服' : '用户')} ·{' '}
                  {formatTs(msg.created_at)}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketThread;
