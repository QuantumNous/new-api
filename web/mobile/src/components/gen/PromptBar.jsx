import React, { useState } from 'react';
import { Button, TextArea } from 'antd-mobile';

// 底部提示词输入条。extra 用于放置模式相关的上传按钮等。
const PromptBar = ({
  onSend,
  generating,
  disabled = false,
  placeholder = '输入提示词…',
  allowEmpty = false,
  extra = null,
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const value = text.trim();
    if (!value && !allowEmpty) return;
    onSend(value);
    setText('');
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--adm-color-border)',
        background: '#fff',
        padding: 8,
        paddingBottom: 'calc(8px + var(--safe-area-inset-bottom))',
      }}
    >
      {extra}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div
          style={{
            flex: 1,
            background: 'var(--adm-color-fill-content, #f5f5f5)',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <TextArea
            placeholder={placeholder}
            value={text}
            onChange={setText}
            rows={1}
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        </div>
        <Button
          color='primary'
          loading={generating}
          disabled={disabled || generating}
          onClick={handleSend}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default PromptBar;
