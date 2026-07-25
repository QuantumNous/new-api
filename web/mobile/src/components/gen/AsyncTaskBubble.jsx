import React from 'react';
import { Button, ProgressCircle, SpinLoading } from 'antd-mobile';

// 视频/音乐/TTS 共用的异步任务助手气泡：排队/进行中/失败/超时四态，
// 完成态由调用方 renderResult 渲染（video / audio 标签不同）。
const AsyncTaskBubble = ({ m, doneStatus, resultUrl, renderResult, onRetry, onRefetch }) => {
  if (m.status === doneStatus && resultUrl) {
    return renderResult(resultUrl);
  }
  if (m.status === 'failed' || m.status === 'canceled') {
    return (
      <div>
        <div style={{ color: 'var(--adm-color-danger)' }}>
          生成失败{m.error ? `：${m.error}` : ''}
        </div>
        {onRetry && (
          <Button size='mini' fill='outline' style={{ marginTop: 8 }} onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {typeof m.progress === 'number' && m.progress > 0 ? (
        <ProgressCircle percent={Math.round(m.progress)}>
          {Math.round(m.progress)}%
        </ProgressCircle>
      ) : (
        <SpinLoading style={{ '--size': '24px' }} />
      )}
      <div>
        <div>{m.status === 'queued' ? '排队中…' : '生成中…'}</div>
        {m.pollTimedOut && onRefetch && (
          <Button size='mini' fill='outline' style={{ marginTop: 6 }} onClick={onRefetch}>
            查询结果
          </Button>
        )}
      </div>
    </div>
  );
};

export default AsyncTaskBubble;
