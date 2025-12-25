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

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spin, Typography, Button, Avatar, Tooltip, Input } from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch, IconTickCircle, IconAlertTriangle, IconClose } from '@douyinfe/semi-icons';
import { API, showError, timestamp2string } from '../../helpers';

function formatRate(rate) {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
}

function hourLabel(tsSec) {
  const full = timestamp2string(tsSec);
  return full.slice(11, 13) + ':00';
}

function getRateLevel(rate) {
  const v = Number(rate) || 0;
  if (v >= 0.99) return { level: 'excellent', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', text: '优秀' };
  if (v >= 0.95) return { level: 'good', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.15)', text: '良好' };
  if (v >= 0.8) return { level: 'warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '警告' };
  if (v >= 0.5) return { level: 'poor', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', text: '较差' };
  return { level: 'critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: '严重' };
}

function HealthCell({ cell, isLatest }) {
  const rate = Number(cell?.success_rate) || 0;
  const total = Number(cell?.total_slices) || 0;
  const success = Number(cell?.success_slices) || 0;
  const isFilled = cell?.is_filled;
  const { color, bg } = getRateLevel(rate);

  return (
    <Tooltip
      content={
        <div className='text-xs'>
          <div className='font-medium mb-1'>{hourLabel(cell?.hour_start_ts)}</div>
          <div>成功率: {isFilled ? `~${formatRate(rate)}` : formatRate(rate)}</div>
          {!isFilled && <div>成功/总计: {success}/{total}</div>}
          {isFilled && <div className='text-gray-400'>无数据，使用平均值</div>}
        </div>
      }
    >
      <div
        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg ${isLatest ? 'ring-2 ring-offset-1' : ''}`}
        style={{
          backgroundColor: isFilled ? `${bg}` : bg,
          borderColor: color,
          boxShadow: isFilled ? 'none' : `inset 0 0 0 2px ${color}`,
          opacity: isFilled ? 0.5 : 1,
          '--tw-ring-color': isLatest ? color : 'transparent',
        }}
      />
    </Tooltip>
  );
}


function StatCard({ icon, title, value, subtitle, color, bgGradient }) {
  return (
    <div
      className='relative overflow-hidden rounded-2xl p-4 sm:p-5'
      style={{
        background: bgGradient,
      }}
    >
      <div className='flex items-start justify-between'>
        <div>
          <div className='text-xs sm:text-sm opacity-80 mb-1'>{title}</div>
          <div className='text-2xl sm:text-3xl font-bold'>{value}</div>
          {subtitle && <div className='text-xs opacity-70 mt-1'>{subtitle}</div>}
        </div>
        <Avatar
          size='small'
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          {icon}
        </Avatar>
      </div>
      <div
        className='absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10'
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className='flex items-center gap-1.5'>
      <div
        className='w-3 h-3 rounded-sm'
        style={{ backgroundColor: color }}
      />
      <span className='text-xs text-gray-500'>{label}</span>
    </div>
  );
}

export default function ModelHealthPublicPage() {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [payload, setPayload] = useState(null);
  const [searchText, setSearchText] = useState('');

  async function load() {
    setLoading(true);
    setErrorText('');
    try {
      const res = await API.get('/api/public/model_health/hourly_last24h', {
        skipErrorHandler: true,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        const errMsg = message || '加载失败';
        setErrorText(errMsg);
        showError(errMsg);
        return;
      }

      if (!data || typeof data !== 'object') {
        const errMsg = '接口返回结构异常';
        setErrorText(errMsg);
        showError(errMsg);
        return;
      }

      setPayload(data);
    } catch (e) {
      setErrorText('加载失败');
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const hourStarts = useMemo(() => {
    const start = Number(payload?.start_hour);
    const end = Number(payload?.end_hour);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const hours = [];
    for (let ts = start; ts < end; ts += 3600) {
      hours.push(ts);
    }
    return hours;
  }, [payload?.start_hour, payload?.end_hour]);

  const { modelData, stats } = useMemo(() => {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];

    const byModel = new Map();
    for (const r of rows) {
      const name = r?.model_name || '';
      if (!name) continue;
      if (!byModel.has(name)) byModel.set(name, new Map());
      byModel.get(name).set(Number(r.hour_start_ts), r);
    }

    const models = Array.from(byModel.keys());
    let totalModels = models.length;
    let healthyModels = 0;
    let warningModels = 0;
    let criticalModels = 0;
    let totalSuccessSlices = 0;
    let totalSlices = 0;

    const modelData = models.map((modelName) => {
      const hourMap = byModel.get(modelName);
      let modelTotalSuccess = 0;
      let modelTotalSlices = 0;

      for (const ts of hourStarts) {
        const stat = hourMap?.get(ts);
        if (stat && Number(stat.total_slices) > 0) {
          modelTotalSuccess += Number(stat.success_slices) || 0;
          modelTotalSlices += Number(stat.total_slices) || 0;
        }
      }

      const avgRate = modelTotalSlices > 0 ? modelTotalSuccess / modelTotalSlices : 0;
      totalSuccessSlices += modelTotalSuccess;
      totalSlices += modelTotalSlices;

      const { level } = getRateLevel(avgRate);
      if (level === 'excellent' || level === 'good') healthyModels++;
      else if (level === 'warning') warningModels++;
      else criticalModels++;

      const hourlyData = hourStarts.map((ts) => {
        const stat = hourMap?.get(ts);
        if (stat && Number(stat.total_slices) > 0) {
          return stat;
        }
        return {
          hour_start_ts: ts,
          model_name: modelName,
          success_slices: 0,
          total_slices: 0,
          success_rate: avgRate,
          is_filled: true,
        };
      });

      return {
        model_name: modelName,
        avg_rate: avgRate,
        total_success: modelTotalSuccess,
        total_slices: modelTotalSlices,
        hourly: hourlyData.reverse(),
      };
    });

    modelData.sort((a, b) => b.total_success - a.total_success);

    const overallRate = totalSlices > 0 ? totalSuccessSlices / totalSlices : 0;

    return {
      modelData,
      stats: {
        totalModels,
        healthyModels,
        warningModels,
        criticalModels,
        overallRate,
        totalSuccessSlices,
        totalSlices,
      },
    };
  }, [payload?.rows, hourStarts]);

  const filteredModelData = useMemo(() => {
    if (!searchText.trim()) return modelData;
    const keyword = searchText.toLowerCase().trim();
    return modelData.filter((m) => m.model_name.toLowerCase().includes(keyword));
  }, [modelData, searchText]);

  const latestHour = hourStarts.length > 0 ? hourStarts[hourStarts.length - 1] : null;


  return (
    <div className='mt-[60px] px-2 sm:px-4 pb-8'>
      {/* Header */}
      <div className='mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent'>
              模型健康度监控
            </h1>
            <p className='text-sm text-gray-500 mt-1'>
              最近 24 小时各模型运行状态一览
            </p>
          </div>
          <Button
            icon={<IconRefresh />}
            onClick={load}
            loading={loading}
            theme='solid'
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            刷新数据
          </Button>
        </div>
      </div>

      {errorText && (
        <div className='mb-4 p-4 rounded-xl bg-red-50 border border-red-200'>
          <Typography.Text type='danger'>{errorText}</Typography.Text>
        </div>
      )}

      <Spin spinning={loading}>
        {/* Stats Cards */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6'>
          <StatCard
            icon={<IconCheckCircle className='text-white' />}
            title='监控模型数'
            value={stats.totalModels}
            subtitle={`${stats.healthyModels} 个健康`}
            color='#22c55e'
            bgGradient='linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
          />
          <StatCard
            icon={<IconCheckCircle className='text-white' />}
            title='整体成功率'
            value={formatRate(stats.overallRate)}
            subtitle={`${stats.totalSuccessSlices}/${stats.totalSlices} 时间片`}
            color='#3b82f6'
            bgGradient='linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
          />
          <StatCard
            icon={<IconAlertTriangle className='text-white' />}
            title='警告模型'
            value={stats.warningModels}
            subtitle='成功率 80-95%'
            color='#f59e0b'
            bgGradient='linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
          />
          <StatCard
            icon={<IconClose className='text-white' />}
            title='异常模型'
            value={stats.criticalModels}
            subtitle='成功率 < 80%'
            color='#ef4444'
            bgGradient='linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
          />
        </div>

        {/* Legend */}
        <Card className='!rounded-2xl mb-4' bodyStyle={{ padding: '12px 16px' }}>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-4'>
              <span className='text-sm font-medium text-gray-600'>状态图例:</span>
              <LegendItem color='#22c55e' label='优秀 (≥99%)' />
              <LegendItem color='#84cc16' label='良好 (95-99%)' />
              <LegendItem color='#f59e0b' label='警告 (80-95%)' />
              <LegendItem color='#f97316' label='较差 (50-80%)' />
              <LegendItem color='#ef4444' label='严重 (<50%)' />
            </div>
            <Input
              prefix={<IconSearch />}
              placeholder='搜索模型...'
              value={searchText}
              onChange={setSearchText}
              showClear
              style={{ width: 200 }}
            />
          </div>
        </Card>

        {/* Time Labels */}
        {hourStarts.length > 0 && (
          <div className='mb-2 pl-[180px] sm:pl-[240px] overflow-x-auto'>
            <div className='flex gap-0.5 min-w-max'>
              {[...hourStarts].reverse().map((ts, idx) => (
                <div
                  key={ts}
                  className='w-6 sm:w-7 text-center'
                >
                  {idx % 3 === 0 && (
                    <div className='text-[10px] text-gray-400'>
                      {hourLabel(ts)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Health Grid */}
        <div className='space-y-2'>
          {filteredModelData.map((model) => {
            const { color } = getRateLevel(model.avg_rate);
            return (
              <Card
                key={model.model_name}
                className='!rounded-xl hover:shadow-md transition-shadow duration-200'
                bodyStyle={{ padding: '12px 16px' }}
              >
                <div className='flex items-center gap-3'>
                  {/* Model Info */}
                  <div className='w-[160px] sm:w-[220px] flex-shrink-0'>
                    <div className='flex items-center gap-2'>
                      <div
                        className='w-2 h-8 rounded-full flex-shrink-0'
                        style={{ backgroundColor: color }}
                      />
                      <div className='min-w-0 flex-1'>
                        <Tooltip content={model.model_name}>
                          <div className='font-medium text-sm truncate'>
                            {model.model_name}
                          </div>
                        </Tooltip>
                        <div className='flex items-center gap-2 text-xs text-gray-500'>
                          <span style={{ color }}>{formatRate(model.avg_rate)}</span>
                          <span className='opacity-50'>|</span>
                          <span>{model.total_success}/{model.total_slices}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Health Grid */}
                  <div className='flex-1 overflow-x-auto'>
                    <div className='flex gap-0.5 min-w-max'>
                      {model.hourly.map((cell) => (
                        <HealthCell
                          key={cell.hour_start_ts}
                          cell={cell}
                          isLatest={cell.hour_start_ts === latestHour}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {!loading && filteredModelData.length === 0 && (
          <Card className='!rounded-2xl'>
            <div className='text-center py-12'>
              <div className='text-6xl mb-4'>📊</div>
              <Typography.Title heading={5} type='tertiary'>
                {searchText ? '未找到匹配的模型' : '暂无数据'}
              </Typography.Title>
              <Typography.Text type='tertiary'>
                {searchText ? '请尝试其他搜索关键词' : '请稍后刷新重试'}
              </Typography.Text>
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
}
