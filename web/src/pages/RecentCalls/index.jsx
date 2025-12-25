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

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Collapse,
  Drawer,
  Form,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { showError, timestamp2string } from '../../helpers';
import CodeViewer from '../../components/playground/CodeViewer';
import SSEViewer from '../../components/playground/SSEViewer';
import { getRecentCallById, getRecentCalls } from '../../services/recentCalls';

function safeString(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString();
  }

  const n = Number(value);
  if (Number.isFinite(n)) {
    return timestamp2string(Math.floor(n));
  }
  return String(value);
}

function isAxiosError403(error) {
  return error?.name === 'AxiosError' && error?.response?.status === 403;
}

function bodySummary(bodyType, omitted, truncated) {
  const flags = [];
  if (omitted) flags.push('omitted');
  if (truncated) flags.push('truncated');
  const suffix = flags.length ? ` (${flags.join(', ')})` : '';
  return `${bodyType || 'unknown'}${suffix}`;
}

function guessLanguageByBodyType(bodyType) {
  if (bodyType === 'json') return 'json';
  return 'text';
}

function computeRecordTruncated(rec) {
  const req = rec?.request || {};
  const resp = rec?.response || {};
  const stream = rec?.stream || {};
  return !!(
    req.truncated ||
    resp.truncated ||
    stream.chunks_truncated ||
    stream.aggregated_truncated
  );
}

function RecentCallStreamViewer({ stream }) {
  const chunks = Array.isArray(stream?.chunks) ? stream.chunks : [];
  const aggregatedText = safeString(stream?.aggregated_text);
  const chunksTruncated = !!stream?.chunks_truncated;
  const aggregatedTruncated = !!stream?.aggregated_truncated;

  const sseLike = useMemo(() => {
    // best-effort: SSEViewer expects array of JSON payloads or "[DONE]".
    // Our backend stores raw "data:" payload lines; try to strip "data:".
    const normalized = [];
    for (const line of chunks) {
      const s = safeString(line);
      const trimmed = s.trim();
      if (!trimmed) continue;

      if (trimmed === '[DONE]' || trimmed.includes('[DONE]')) {
        normalized.push('[DONE]');
        continue;
      }

      if (trimmed.startsWith('data:')) {
        normalized.push(trimmed.slice('data:'.length).trim());
      } else {
        normalized.push(trimmed);
      }
    }
    return normalized;
  }, [chunks]);

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Typography.Text strong>流式回放</Typography.Text>
        <Badge count={chunks.length} type='primary' />
        {chunksTruncated && <Tag color='orange'>chunks_truncated</Tag>}
      </div>

      <div style={{ height: 360 }}>
        <SSEViewer sseData={sseLike} />
      </div>

      <Collapse>
        <Collapse.Panel
          header={
            <div className='flex items-center gap-2'>
              <Typography.Text strong>聚合文本</Typography.Text>
              {aggregatedTruncated && (
                <Tag color='orange'>aggregated_truncated</Tag>
              )}
            </div>
          }
          itemKey='agg'
        >
          <div style={{ height: 240 }}>
            <CodeViewer content={aggregatedText || ''} language='text' />
          </div>
        </Collapse.Panel>

        <Collapse.Panel header='原始 chunk（文本）' itemKey='raw'>
          <div style={{ height: 300 }}>
            <CodeViewer
              content={(chunks || []).join('\n')}
              language='text'
            />
          </div>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
}

function RecentCallDetailDrawer({ open, recordId, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const res = await getRecentCallById(recordId);
      const data = res?.data?.data;
      setRecord(data || null);
    } catch (e) {
      if (isAxiosError403(e)) {
        navigate('/forbidden', { replace: true });
        return;
      }
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [recordId, navigate]);

  React.useEffect(() => {
    if (open) {
      loadDetail().catch(console.error);
    }
  }, [open, loadDetail]);

  const req = record?.request || {};
  const resp = record?.response || {};
  const stream = record?.stream || null;
  const err = record?.error || null;

  const requestView = useMemo(() => {
    return {
      id: record?.id,
      created_at: record?.created_at,
      user_id: record?.user_id,
      channel_id: record?.channel_id,
      model_name: record?.model_name,
      method: record?.method,
      path: record?.path,
      headers: req?.headers || {},
      body_type: req?.body_type,
      body_truncated: !!req?.truncated,
      body_omitted: !!req?.omitted,
      omit_reason: req?.omit_reason,
    };
  }, [record, req]);

  const upstreamMetaView = useMemo(() => {
    if (!record?.response) return null;
    return {
      status_code: resp?.status_code,
      headers: resp?.headers || {},
      body_type: resp?.body_type,
      body_truncated: !!resp?.truncated,
      body_omitted: !!resp?.omitted,
      omit_reason: resp?.omit_reason,
    };
  }, [record, resp]);

  return (
    <Drawer
      title={
        <div className='flex items-center gap-2'>
          <Typography.Text strong>最近调用详情</Typography.Text>
          {record?.id && <Tag color='blue'>#{record.id}</Tag>}
          {record?.error && <Tag color='red'>error</Tag>}
          {record?.stream && <Tag color='cyan'>stream</Tag>}
        </div>
      }
      visible={open}
      onClose={onClose}
      width={900}
      maskClosable
      bodyStyle={{ padding: 16 }}
    >
      <Card
        className='!rounded-2xl'
        loading={loading}
        bordered={false}
        bodyStyle={{ padding: 0 }}
      >
        {!record ? (
          <Typography.Text type='tertiary'>暂无数据</Typography.Text>
        ) : (
          <div className='space-y-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Tag color='grey'>{formatTime(record.created_at)}</Tag>
              <Tag color='teal'>uid: {record.user_id}</Tag>
              {record.model_name && <Tag color='violet'>{record.model_name}</Tag>}
              <Tag color='blue'>{record.method}</Tag>
              <Tag color='grey'>{record.path}</Tag>
              {computeRecordTruncated(record) && <Tag color='orange'>truncated</Tag>}
            </div>

            <Collapse defaultActiveKey={['req']}>
              <Collapse.Panel
                itemKey='req'
                header={
                  <div className='flex items-center gap-2'>
                    <Typography.Text strong>客户端原始请求</Typography.Text>
                    <Tag color='grey'>
                      headers 脱敏
                    </Tag>
                    <Tag color='grey'>
                      body: {bodySummary(req?.body_type, req?.omitted, req?.truncated)}
                    </Tag>
                  </div>
                }
              >
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                  <div style={{ height: 360 }}>
                    <CodeViewer content={requestView} language='json' />
                  </div>
                  <div style={{ height: 360 }}>
                    <CodeViewer
                      content={safeString(req?.body)}
                      language={guessLanguageByBodyType(req?.body_type)}
                    />
                  </div>
                </div>
              </Collapse.Panel>

              <Collapse.Panel
                itemKey='resp'
                header={
                  <div className='flex items-center gap-2'>
                    <Typography.Text strong>上游响应</Typography.Text>
                    {record?.response ? (
                      <>
                        <Tag color='blue'>status: {resp.status_code}</Tag>
                        <Tag color='grey'>
                          body: {bodySummary(resp?.body_type, resp?.omitted, resp?.truncated)}
                        </Tag>
                      </>
                    ) : (
                      <Tag color='grey'>no response</Tag>
                    )}
                  </div>
                }
              >
                {!record?.response ? (
                  <Typography.Text type='tertiary'>无上游响应记录</Typography.Text>
                ) : (
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                    <div style={{ height: 360 }}>
                      <CodeViewer content={upstreamMetaView} language='json' />
                    </div>
                    <div style={{ height: 360 }}>
                      <CodeViewer
                        content={safeString(resp?.body)}
                        language={guessLanguageByBodyType(resp?.body_type)}
                      />
                    </div>
                  </div>
                )}
              </Collapse.Panel>

              {stream && (
                <Collapse.Panel itemKey='stream' header='流式回放'>
                  <RecentCallStreamViewer stream={stream} />
                </Collapse.Panel>
              )}

              {err && (
                <Collapse.Panel
                  itemKey='err'
                  header={
                    <div className='flex items-center gap-2'>
                      <Typography.Text strong>错误信息</Typography.Text>
                      <Tag color='red'>status: {err?.status || '-'}</Tag>
                    </div>
                  }
                >
                  <div style={{ height: 260 }}>
                    <CodeViewer content={err} language='json' />
                  </div>
                </Collapse.Panel>
              )}
            </Collapse>
          </div>
        )}
      </Card>
    </Drawer>
  );
}

export default function RecentCallsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(100);
  const [beforeId, setBeforeId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const query = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecentCalls({
        limit,
        beforeId: beforeId || undefined,
      });
      const data = res?.data?.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isAxiosError403(e)) {
        navigate('/forbidden', { replace: true });
        return;
      }
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [limit, beforeId, navigate]);

  React.useEffect(() => {
    query().catch(console.error);
  }, [query]);

  const columns = useMemo(
    () => [
      {
        title: 'id',
        dataIndex: 'id',
        key: 'id',
        width: 90,
        render: (v, r) => (
          <Button
            type='tertiary'
            theme='borderless'
            onClick={() => {
              setActiveId(r.id);
              setDetailOpen(true);
            }}
          >
            #{v}
          </Button>
        ),
      },
      {
        title: 'created_at',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (v) => <span>{formatTime(v)}</span>,
      },
      {
        title: 'user_id',
        dataIndex: 'user_id',
        key: 'user_id',
        width: 90,
      },
      {
        title: 'model_name',
        dataIndex: 'model_name',
        key: 'model_name',
        width: 160,
        render: (v) => <span className='truncate' title={safeString(v)}>{safeString(v)}</span>,
      },
      {
        title: 'method',
        dataIndex: 'method',
        key: 'method',
        width: 90,
        render: (v) => <Tag color='blue'>{safeString(v)}</Tag>,
      },
      {
        title: 'path',
        dataIndex: 'path',
        key: 'path',
        render: (v) => (
          <span className='truncate' title={safeString(v)}>{safeString(v)}</span>
        ),
      },
      {
        title: 'stream',
        key: 'stream',
        width: 90,
        render: (_, r) => (r.stream ? <Tag color='cyan'>yes</Tag> : <Tag color='grey'>no</Tag>),
      },
      {
        title: 'truncated',
        key: 'truncated',
        width: 110,
        render: (_, r) =>
          computeRecordTruncated(r) ? (
            <Tag color='orange'>yes</Tag>
          ) : (
            <Tag color='grey'>no</Tag>
          ),
      },
      {
        title: 'error',
        key: 'error',
        width: 90,
        render: (_, r) => (r.error ? <Tag color='red'>yes</Tag> : <Tag color='grey'>no</Tag>),
      },
    ],
    [],
  );

  const nextBeforeId = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    let min = null;
    for (const r of rows) {
      const id = Number(r?.id);
      if (!Number.isFinite(id)) continue;
      if (min === null || id < min) min = id;
    }
    return min;
  }, [rows]);

  return (
    <div className='mt-[60px] px-2'>
      <Card
        className='!rounded-2xl'
        title='最近 100 次 API 调用'
        headerExtraContent={
          <Space>
            <Button
              onClick={() => {
                setBeforeId('');
                query().catch(console.error);
              }}
              type='tertiary'
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Form layout='vertical'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <Form.Select
              field='limit'
              label='limit'
              optionList={[
                { label: '20', value: 20 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
              ]}
              value={limit}
              onChange={(v) => setLimit(Number(v) || 100)}
            />

            <Form.Input
              field='before_id'
              label='before_id（上一页）'
              placeholder='留空表示最新'
              value={beforeId}
              onChange={(v) => setBeforeId(v)}
            />

            <div className='flex items-end gap-2'>
              <Button type='primary' onClick={query} loading={loading}>
                查询
              </Button>
              <Button
                type='tertiary'
                disabled={!nextBeforeId}
                onClick={() => {
                  if (nextBeforeId) {
                    setBeforeId(String(nextBeforeId));
                  }
                }}
              >
                上一页
              </Button>
            </div>
          </div>
        </Form>

        <div className='mt-4'>
          <Table
            bordered
            size='small'
            loading={loading}
            columns={columns}
            dataSource={(rows || []).map((r) => ({
              ...r,
              key: String(r.id),
            }))}
            pagination={false}
            onRow={(record) => ({
              onDoubleClick: () => {
                setActiveId(record.id);
                setDetailOpen(true);
              },
            })}
          />
          <div className='mt-3 text-xs' style={{ color: 'var(--semi-color-text-2)' }}>
            提示：点击 id 或双击行打开详情；“上一页”会把当前页最小 id 写入 before_id，再次点“查询”即可加载更早记录。
          </div>
        </div>
      </Card>

      <RecentCallDetailDrawer
        open={detailOpen}
        recordId={activeId}
        onClose={() => {
          setDetailOpen(false);
          setActiveId(null);
        }}
      />
    </div>
  );
}