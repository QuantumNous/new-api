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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, isAdmin, showError } from '../../helpers';

const RANGE_OPTIONS = [
  { key: 'today', label: '今天', days: 1 },
  { key: '7d', label: '最近7天', days: 7 },
  { key: '30d', label: '最近30天', days: 30 },
];

const SHANGHAI_OFFSET_SECONDS = 8 * 60 * 60;

function getShanghaiDayStartTimestamp(baseTimestamp) {
  const shifted = baseTimestamp + SHANGHAI_OFFSET_SECONDS;
  return shifted - (shifted % 86400) - SHANGHAI_OFFSET_SECONDS;
}

function getRangeByKey(key) {
  const now = Math.floor(Date.now() / 1000);
  if (key === 'today') {
    return {
      startTime: getShanghaiDayStartTimestamp(now),
      endTime: now,
    };
  }

  const option = RANGE_OPTIONS.find((item) => item.key === key) || RANGE_OPTIONS[1];
  return {
    startTime: getShanghaiDayStartTimestamp(now) - (option.days - 1) * 86400,
    endTime: now,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

function formatMetric(value, digits = 2) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function shortenText(text, limit = 96) {
  if (!text) return '--';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function parseQueryFilter(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    return { channel_id: '', model_name: '', username: '', localKeyword: '' };
  }
  if (query.startsWith('channel:')) {
    return {
      channel_id: query.replace('channel:', '').trim(),
      model_name: '',
      username: '',
      localKeyword: '',
    };
  }
  if (query.startsWith('user:')) {
    return {
      channel_id: '',
      model_name: '',
      username: query.replace('user:', '').trim(),
      localKeyword: '',
    };
  }
  if (query.startsWith('model:')) {
    return {
      channel_id: '',
      model_name: query.replace('model:', '').trim(),
      username: '',
      localKeyword: '',
    };
  }
  return {
    channel_id: '',
    model_name: '',
    username: '',
    localKeyword: query,
  };
}

function getMetricValue(item, metric) {
  if (metric === 'tokens') {
    return Number(item.total_prompt_tokens || 0) + Number(item.total_completion_tokens || 0);
  }
  return Number(item.total_requests || 0);
}

function buildTopItems(items, labelKey, metric) {
  return [...(items || [])]
    .map((item) => ({
      label: item[labelKey] || '未命名',
      value: getMetricValue(item, metric),
      requests: Number(item.total_requests || 0),
      tokens:
        Number(item.total_prompt_tokens || 0) +
        Number(item.total_completion_tokens || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

const cardBaseClass =
  'rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur';

const sectionTitleClass = 'text-base font-semibold text-slate-900';

function MetricCard({ title, value, description, accent }) {
  return (
    <div className={`${cardBaseClass} overflow-hidden relative`}>
      <div
        className='absolute inset-x-0 top-0 h-1'
        style={{ background: accent }}
      />
      <div className='flex flex-col gap-2'>
        <span className='text-sm font-medium text-slate-500'>{title}</span>
        <span className='text-3xl font-semibold tracking-tight text-slate-900'>
          {value}
        </span>
        <p className='text-sm leading-6 text-slate-500'>{description}</p>
      </div>
    </div>
  );
}

function ChartPanel({ title, metric, onMetricChange, items, emptyText }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const draw = () => {
      const width = canvas.clientWidth || 640;
      const height = 360;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (!items.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emptyText, width / 2, height / 2);
        return;
      }

      const left = 110;
      const right = 78;
      const top = 26;
      const rowHeight = 26;
      const gap = 8;
      const chartWidth = width - left - right;
      const maxValue = Math.max(...items.map((item) => item.value), 1);

      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'middle';

      items.forEach((item, index) => {
        const y = top + index * (rowHeight + gap);
        const barWidth = (item.value / maxValue) * chartWidth;
        const gradient = ctx.createLinearGradient(left, y, left + chartWidth, y);
        gradient.addColorStop(0, '#0f766e');
        gradient.addColorStop(1, '#14b8a6');

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(left, y, chartWidth, rowHeight);

        ctx.fillStyle = gradient;
        ctx.fillRect(left, y, barWidth, rowHeight);

        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'right';
        ctx.fillText(shortenText(item.label, 14), left - 12, y + rowHeight / 2);

        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText(formatNumber(item.value), left + barWidth + 10, y + rowHeight / 2);
      });
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [items, emptyText]);

  return (
    <section className={cardBaseClass}>
      <div className='mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className={sectionTitleClass}>{title}</h2>
          <p className='mt-1 text-sm text-slate-500'>仅展示当前时间窗口 Top 10</p>
        </div>
        <div className='inline-flex rounded-2xl bg-slate-100 p-1 text-sm'>
          <button
            className={`rounded-2xl px-3 py-1.5 transition ${metric === 'requests' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
            onClick={() => onMetricChange('requests')}
          >
            按请求数
          </button>
          <button
            className={`rounded-2xl px-3 py-1.5 transition ${metric === 'tokens' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
            onClick={() => onMetricChange('tokens')}
          >
            按 Tokens
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className='h-[360px] w-full' />
    </section>
  );
}

function PromptModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div className='fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4'>
      <div className='max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl'>
        <div className='flex items-center justify-between border-b border-slate-200 px-6 py-4'>
          <div>
            <h3 className='text-lg font-semibold text-slate-900'>Prompt 详情</h3>
            <p className='mt-1 text-sm text-slate-500'>
              {item.model_name} · {item.channel_name || '未分配渠道'} · {formatTimestamp(item.created_at)}
            </p>
          </div>
          <button
            className='rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900'
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className='max-h-[calc(80vh-96px)] overflow-auto px-6 py-5'>
          <pre className='whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-sm leading-7 text-slate-100'>
            {item.content || '--'}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function Monitor() {
  const adminMode = isAdmin();
  const [rangeKey, setRangeKey] = useState('7d');
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [modelMetric, setModelMetric] = useState('requests');
  const [channelMetric, setChannelMetric] = useState('requests');
  const [overview, setOverview] = useState(null);
  const [modelStats, setModelStats] = useState([]);
  const [channelStats, setChannelStats] = useState([]);
  const [promptPage, setPromptPage] = useState({ items: [], total: 0, start: 0, limit: 10 });
  const [activePrompt, setActivePrompt] = useState(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getRangeByKey(rangeKey), [rangeKey]);
  const parsedQuery = useMemo(() => parseQueryFilter(query), [query]);
  const currentPage = Math.floor(promptPage.start / promptPage.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(promptPage.total / promptPage.limit));

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const commonParams = {
          start_time: range.startTime,
          end_time: range.endTime,
        };
        const [overviewRes, modelRes, channelRes, promptRes] = await Promise.all([
          API.get('/dashboard/overview', { params: commonParams }),
          API.get('/dashboard/model/stats', { params: commonParams }),
          API.get('/dashboard/channel/stats', { params: commonParams }),
          API.get('/dashboard/logs/prompts', {
            params: {
              ...commonParams,
              start: promptPage.start,
              limit: promptPage.limit,
              channel_id: parsedQuery.channel_id || undefined,
              model_name: parsedQuery.model_name || undefined,
              username:
                adminMode && parsedQuery.username ? parsedQuery.username : undefined,
            },
          }),
        ]);

        const unwrap = (response) => {
          if (response.data.code !== 0) {
            throw new Error(response.data.message || '加载失败');
          }
          return response.data.data;
        };

        if (cancelled) return;
        setOverview(unwrap(overviewRes));
        setModelStats(unwrap(modelRes) || []);
        setChannelStats(unwrap(channelRes) || []);
        setPromptPage(unwrap(promptRes) || { items: [], total: 0, start: 0, limit: 10 });
      } catch (error) {
        if (!cancelled) {
          showError(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [range.startTime, range.endTime, promptPage.start, promptPage.limit, parsedQuery.channel_id, parsedQuery.model_name, parsedQuery.username, adminMode]);

  useEffect(() => {
    setPromptPage((prev) => ({ ...prev, start: 0 }));
  }, [rangeKey, query]);

  const modelTopItems = useMemo(
    () => buildTopItems(modelStats, 'model_name', modelMetric),
    [modelStats, modelMetric],
  );
  const channelTopItems = useMemo(
    () => buildTopItems(channelStats, 'channel_name', channelMetric),
    [channelStats, channelMetric],
  );

  const visiblePromptItems = useMemo(() => {
    if (!parsedQuery.localKeyword) return promptPage.items || [];
    const keyword = parsedQuery.localKeyword.toLowerCase();
    return (promptPage.items || []).filter((item) =>
      [
        item.username,
        item.model_name,
        item.channel_name,
        item.request_id,
        item.content,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [promptPage.items, parsedQuery.localKeyword]);

  return (
    <div className='mt-[60px] px-2 pb-8'>
      <PromptModal item={activePrompt} onClose={() => setActivePrompt(null)} />

      <div className='mx-auto max-w-[1600px]'>
        <div className='relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_35%),linear-gradient(135deg,_rgba(248,250,252,0.97),_rgba(255,255,255,0.92))] p-6 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.6)]'>
          <div className='flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between'>
            <div className='space-y-3'>
              <span className='inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700'>
                Monitor Center
              </span>
              <div>
                <h1 className='text-3xl font-semibold tracking-tight text-slate-950'>
                  监控中心
                </h1>
                <p className='mt-2 max-w-3xl text-sm leading-7 text-slate-600'>
                  使用 Asia/Shanghai 时间窗口查看请求、Tokens、渠道分布和 Prompt 明细。
                  {adminMode ? ' 当前为管理员全局视角。' : ' 当前仅展示你的个人调用数据。'}
                </p>
              </div>
            </div>

            <div className='flex w-full flex-col gap-3 xl:max-w-2xl'>
              <div className='flex flex-wrap gap-2'>
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      rangeKey === option.key
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setRangeKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className='flex flex-col gap-3 md:flex-row'>
                <input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setQuery(draftQuery);
                    }
                  }}
                  className='w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'
                  placeholder='API 查询：支持 model:xxx / user:xxx / channel:123，或直接输入关键字'
                />
                <button
                  className='rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700'
                  onClick={() => setQuery(draftQuery)}
                >
                  查询
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-2'>
          <MetricCard
            title='请求数'
            value={loading && !overview ? '...' : formatNumber(overview?.total_requests)}
            description={`成功 ${formatNumber(overview?.success_count)} · 失败 ${formatNumber(overview?.failed_count)} · 成功率 ${formatMetric(overview?.success_rate)}%`}
            accent='linear-gradient(90deg, #0f766e, #14b8a6)'
          />
          <MetricCard
            title='Tokens'
            value={loading && !overview ? '...' : formatNumber((overview?.total_prompt_tokens || 0) + (overview?.total_completion_tokens || 0))}
            description={`输入 ${formatNumber(overview?.total_prompt_tokens)} · 输出 ${formatNumber(overview?.total_completion_tokens)} · 配额 ${formatNumber(overview?.total_quota)}`}
            accent='linear-gradient(90deg, #0369a1, #38bdf8)'
          />
        </div>

        <div className='mt-4 grid gap-4 lg:grid-cols-3'>
          <MetricCard
            title='平均 TPM'
            value={loading && !overview ? '...' : formatMetric(overview?.avg_tpm)}
            description='按当前时间窗口折算的平均 Tokens Per Minute'
            accent='linear-gradient(90deg, #7c3aed, #c084fc)'
          />
          <MetricCard
            title='平均 RPM'
            value={loading && !overview ? '...' : formatMetric(overview?.avg_rpm)}
            description='按当前时间窗口折算的平均 Requests Per Minute'
            accent='linear-gradient(90deg, #ca8a04, #facc15)'
          />
          <MetricCard
            title='日均 RPD'
            value={loading && !overview ? '...' : formatMetric(overview?.daily_rpd)}
            description='按当前时间窗口折算的平均 Requests Per Day'
            accent='linear-gradient(90deg, #be123c, #fb7185)'
          />
        </div>

        <div className='mt-6 grid gap-6 xl:grid-cols-2'>
          <ChartPanel
            title='模型用量分布'
            metric={modelMetric}
            onMetricChange={setModelMetric}
            items={modelTopItems}
            emptyText='当前时间窗口暂无模型数据'
          />
          <ChartPanel
            title='渠道用量分布'
            metric={channelMetric}
            onMetricChange={setChannelMetric}
            items={channelTopItems}
            emptyText='当前时间窗口暂无渠道数据'
          />
        </div>

        <section className={`${cardBaseClass} mt-6`}>
          <div className='mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
            <div>
              <h2 className={sectionTitleClass}>Prompt 日志</h2>
              <p className='mt-1 text-sm text-slate-500'>
                仅展示消费成功日志；查询框默认会在当前页内继续匹配模型、渠道、请求号和 Prompt 内容。
              </p>
            </div>
            <div className='text-sm text-slate-500'>
              第 {currentPage} / {totalPages} 页，共 {formatNumber(promptPage.total)} 条
            </div>
          </div>

          <div className='overflow-hidden rounded-3xl border border-slate-200'>
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>时间</th>
                    <th className='px-4 py-3 font-medium'>用户</th>
                    <th className='px-4 py-3 font-medium'>模型</th>
                    <th className='px-4 py-3 font-medium'>渠道</th>
                    <th className='px-4 py-3 font-medium'>Tokens</th>
                    <th className='px-4 py-3 font-medium'>Quota</th>
                    <th className='px-4 py-3 font-medium'>Request ID</th>
                    <th className='px-4 py-3 font-medium'>Prompt</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white text-slate-700'>
                  {visiblePromptItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className='px-4 py-10 text-center text-slate-500'>
                        {loading ? '正在加载监控数据...' : '当前筛选条件下没有 Prompt 日志'}
                      </td>
                    </tr>
                  )}
                  {visiblePromptItems.map((item) => (
                    <tr key={item.id} className='align-top transition hover:bg-slate-50/80'>
                      <td className='px-4 py-4 whitespace-nowrap'>{formatTimestamp(item.created_at)}</td>
                      <td className='px-4 py-4 whitespace-nowrap'>{item.username || '--'}</td>
                      <td className='px-4 py-4 whitespace-nowrap'>{item.model_name || '--'}</td>
                      <td className='px-4 py-4 whitespace-nowrap'>{item.channel_name || '--'}</td>
                      <td className='px-4 py-4 whitespace-nowrap'>
                        {formatNumber(item.prompt_tokens + item.completion_tokens)}
                        <div className='mt-1 text-xs text-slate-400'>
                          In {formatNumber(item.prompt_tokens)} / Out {formatNumber(item.completion_tokens)}
                        </div>
                      </td>
                      <td className='px-4 py-4 whitespace-nowrap'>{formatNumber(item.quota)}</td>
                      <td className='px-4 py-4 font-mono text-xs text-slate-500'>
                        {shortenText(item.request_id, 20)}
                      </td>
                      <td className='px-4 py-4'>
                        <div className='max-w-[460px] whitespace-pre-wrap break-words text-slate-600'>
                          {shortenText(item.content, 140)}
                        </div>
                        <button
                          className='mt-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900'
                          onClick={() => setActivePrompt(item)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className='mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-sm text-slate-500'>
              当前窗口：{formatTimestamp(range.startTime)} 至 {formatTimestamp(range.endTime)}
            </div>
            <div className='flex items-center gap-2'>
              <button
                className='rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40'
                disabled={promptPage.start <= 0 || loading}
                onClick={() =>
                  setPromptPage((prev) => ({
                    ...prev,
                    start: Math.max(0, prev.start - prev.limit),
                  }))
                }
              >
                上一页
              </button>
              <button
                className='rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40'
                disabled={promptPage.start + promptPage.limit >= promptPage.total || loading}
                onClick={() =>
                  setPromptPage((prev) => ({
                    ...prev,
                    start: prev.start + prev.limit,
                  }))
                }
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
