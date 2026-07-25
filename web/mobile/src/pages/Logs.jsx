import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InfiniteScroll, List, NavBar, PullToRefresh, Tag } from 'antd-mobile';
import dayjs from 'dayjs';

import { API } from '@classic/helpers/api';

import { showError } from '../shims/classic-utils';
import { renderQuota } from '../utils/quota';

const PAGE_SIZE = 20;

// 日志类型：与后端 model/log.go 对齐（1 充值 2 消费 3 管理 4 系统 5 错误 6 退款）
const typeTag = (type) => {
  switch (type) {
    case 1:
      return <Tag color='success'>充值</Tag>;
    case 2:
      return <Tag color='primary'>消费</Tag>;
    case 3:
      return <Tag color='default'>管理</Tag>;
    case 4:
      return <Tag color='default'>系统</Tag>;
    case 5:
      return <Tag color='danger'>错误</Tag>;
    case 6:
      return <Tag color='warning'>退款</Tag>;
    default:
      return <Tag color='default'>其他</Tag>;
  }
};

const Logs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const loadPage = useCallback(async (page) => {
    const res = await API.get(
      `/api/log/self?p=${page}&page_size=${PAGE_SIZE}&type=0`,
    );
    const { success, message, data } = res.data;
    if (!success) {
      showError(message);
      return [];
    }
    return data.items || [];
  }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await loadPage(1);
      pageRef.current = 1;
      setLogs(items);
      setHasMore(items.length >= PAGE_SIZE);
    } catch (e) {
      showError(e);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const items = await loadPage(next);
    pageRef.current = next;
    setLogs((prev) => [...prev, ...items]);
    setHasMore(items.length >= PAGE_SIZE);
  }, [loadPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>使用日志</NavBar>
      <PullToRefresh onRefresh={refresh}>
        <List>
          {logs.map((log, idx) => (
            <List.Item
              key={`${log.id || idx}`}
              title={
                <span>
                  {typeTag(log.type)} {log.model_name || log.token_name || ''}
                </span>
              }
              description={dayjs(log.created_at * 1000).format(
                'MM-DD HH:mm:ss',
              )}
              extra={
                log.type === 2 ? `-${renderQuota(log.quota || 0)}` : ''
              }
            >
              {log.type === 2 && (
                <span
                  style={{ fontSize: 12, color: 'var(--adm-color-weak)' }}
                >
                  提示 {log.prompt_tokens} / 补全 {log.completion_tokens}
                </span>
              )}
              {log.content && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--adm-color-weak)',
                    wordBreak: 'break-all',
                  }}
                >
                  {log.content}
                </div>
              )}
            </List.Item>
          ))}
        </List>
        <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
      </PullToRefresh>
    </div>
  );
};

export default Logs;
