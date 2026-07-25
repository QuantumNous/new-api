import React, { useEffect, useRef } from 'react';

// 生成类页面的消息流：用户消息右侧气泡，助手消息左侧卡片（渲染交给 renderAssistant）。
const MessageFeed = ({ messages = [], renderAssistant, empty }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!messages.length) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--adm-color-weak)',
          fontSize: 14,
        }}
      >
        {empty || '输入提示词开始生成'}
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((m, idx) =>
        m.role === 'user' ? (
          <div
            key={m.id || idx}
            style={{ display: 'flex', justifyContent: 'flex-end' }}
          >
            <div className='m-feed-user-bubble'>{m.prompt || m.content}</div>
          </div>
        ) : (
          <div
            key={m.id || idx}
            style={{ display: 'flex', justifyContent: 'flex-start' }}
          >
            <div className='m-feed-assistant-bubble'>{renderAssistant(m)}</div>
          </div>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageFeed;
