/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
*/

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, timestamp2string } from '../../helpers';
import { Input, Button, Space } from '@douyinfe/semi-ui';

// 审计日志检索页（T8：仅超管可见，后端 GET /api/audit 已落地）。
// 过滤维度：操作人 / 动作(action) / 关键词(详情) / 时间区间(unix 秒)。
const AuditLogPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [actorName, setActorName] = useState('');
  const [action, setAction] = useState('');
  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // 关键：p 传「页码」(1-based)，由后端 common.GetPageQuery 内部换算 offset。
      // 与既有页面(/api/log、/api/user)保持一致，切勿传 (page-1)*pageSize 的 offset，
      // 否则第 2 页起会二次偏移导致取错数据。
      params.set('p', String(page));
      params.set('page_size', String(pageSize));
      if (actorName) params.set('actor_name', actorName);
      if (action) params.set('action', action);
      if (keyword) params.set('keyword', keyword);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await API.get(`/api/audit?${params.toString()}`);
      // 后端 common.ApiSuccess 包裹为 { success, message, data:{ page, page_size, total, items } }
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('加载审计日志失败'));
        return;
      }
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      showError(e.message || t('加载审计日志失败'));
    }
  }, [page, pageSize, actorName, action, keyword, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className='mt-[60px] px-2'>
      <h2 className='mb-3'>{t('审计日志')}</h2>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('操作人')}
          value={actorName}
          onChange={(v) => setActorName(v)}
          showClear
        />
        <Input
          placeholder={t('动作 (action)')}
          value={action}
          onChange={(v) => setAction(v)}
          showClear
        />
        <Input
          placeholder={t('关键词(详情)')}
          value={keyword}
          onChange={(v) => setKeyword(v)}
          showClear
        />
        <Input
          placeholder={t('起始时间戳(秒)')}
          value={from}
          onChange={(v) => setFrom(v)}
        />
        <Input
          placeholder={t('结束时间戳(秒)')}
          value={to}
          onChange={(v) => setTo(v)}
        />
        <Button
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          {t('查询')}
        </Button>
      </Space>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '6px 8px' }}>{t('时间')}</th>
            <th style={{ padding: '6px 8px' }}>{t('操作人')}</th>
            <th style={{ padding: '6px 8px' }}>{t('动作')}</th>
            <th style={{ padding: '6px 8px' }}>{t('目标类型')}</th>
            <th style={{ padding: '6px 8px' }}>{t('目标ID')}</th>
            <th style={{ padding: '6px 8px' }}>{t('详情')}</th>
            <th style={{ padding: '6px 8px' }}>{t('IP')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => (
            <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>
                {timestamp2string(log.ts)}
              </td>
              <td style={{ padding: '6px 8px' }}>{log.actor_name}</td>
              <td style={{ padding: '6px 8px' }}>{log.action}</td>
              <td style={{ padding: '6px 8px' }}>{log.target_type}</td>
              <td style={{ padding: '6px 8px' }}>{log.target_id}</td>
              <td style={{ padding: '6px 8px' }}>{log.detail}</td>
              <td style={{ padding: '6px 8px' }}>{log.ip}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 16, textAlign: 'center' }}>
                {t('暂无数据')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {t('共')} {total} {t('条')}
        </span>
        <Space>
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('上一页')}
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('下一页')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AuditLogPage;
