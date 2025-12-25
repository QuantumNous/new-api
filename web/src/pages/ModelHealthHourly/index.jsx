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
import { Card, Form, Button, Spin, Table, Typography, Select, Avatar, Tooltip, DatePicker } from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh, IconTickCircle, IconAlertTriangle, IconClock, IconActivity } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { API, selectFilter, showError, timestamp2string } from '../../helpers';

function floorToHour(tsSec) {
  return Math.floor(tsSec / 3600) * 3600;
}

function getDefaultHourRangeLast24h() {
  const nowSec = Math.floor(Date.now() / 1000);
  const endHour = floorToHour(nowSec) + 3600;
  const startHour = endHour - 24 * 3600;
  return { startHour, endHour };
}

function formatRate(rate) {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
}

function getRateLevel(rate) {
  const v = Number(rate) || 0;
  if (v >= 0.99) return { level: 'excellent', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', text: '优秀' };
  if (v >= 0.95) return { level: 'good', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)', text: '良好' };
  if (v >= 0.8) return { level: 'warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: '警告' };
  if (v >= 0.5) return { level: 'poor', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', text: '较差' };
  return { level: 'critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: '严重' };
}

function StatCard({ icon, title, value, color, bgGradient }) {
  return (
    <div
      className='relative overflow-hidden rounded-xl p-4'
      style={{ background: bgGradient }}
    >
      <div className='flex items-center gap-3'>
        <Avatar size='small' style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          {icon}
        </Avatar>
        <div>
          <div className='text-xs opacity-80'>{title}</div>
          <div className='text-xl font-bold'>{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function ModelHealthHourlyPage() {
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [modelOptions, setModelOptions] = useState([]);
  const [rows, setRows] = useState([]);

  const [modelsError, setModelsError] = useState('');
  const [rowsError, setRowsError] = useState('');

  const defaultRange = useMemo(() => getDefaultHourRangeLast24h(), []);
  const [inputs, setInputs] = useState({
    model_name: '',
    start_hour: defaultRange.startHour,
    end_hour: defaultRange.endHour,
  });

  // 计算统计数据
  const stats = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { avgRate: 0, totalSuccess: 0, totalSlices: 0, minRate: 0, maxRate: 0 };
    }
    let totalSuccess = 0;
    let totalSlices = 0;
    let minRate = 1;
    let maxRate = 0;

    for (const r of rows) {
      totalSuccess += Number(r.success_slices) || 0;
      totalSlices += Number(r.total_slices) || 0;
      const rate = Number(r.success_rate) || 0;
      if (rate < minRate) minRate = rate;
      if (rate > maxRate) maxRate = rate;
    }

    const avgRate = totalSlices > 0 ? totalSuccess / totalSlices : 0;
    return { avgRate, totalSuccess, totalSlices, minRate, maxRate };
  }, [rows]);


  const chartSpec = useMemo(() => {
    const values = (rows || []).map((r) => ({
      ts: r.hour_start_ts,
      time: timestamp2string(r.hour_start_ts),
      rate: Number(r.success_rate) || 0,
      success: Number(r.success_slices) || 0,
      total: Number(r.total_slices) || 0,
    }));

    return {
      type: 'area',
      data: [{ id: 'health', values }],
      xField: 'time',
      yField: 'rate',
      axes: [
        {
          orient: 'left',
          label: {
            formatter: (v) => `${(Number(v) * 100).toFixed(0)}%`,
          },
          grid: {
            style: {
              lineDash: [4, 4],
              stroke: 'rgba(0,0,0,0.1)',
            },
          },
        },
        {
          orient: 'bottom',
          label: { autoRotate: true },
        },
      ],
      tooltip: {
        mark: {
          title: (d) => d?.time || '',
          content: [
            {
              key: '成功率',
              value: (d) => formatRate(Number(d?.rate) || 0),
            },
            {
              key: '成功/总计',
              value: (d) => `${d?.success || 0}/${d?.total || 0}`,
            },
          ],
        },
      },
      area: {
        style: {
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 1,
            stops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.05)' },
            ],
          },
        },
      },
      line: {
        style: {
          stroke: '#667eea',
          lineWidth: 3,
          lineCap: 'round',
        },
      },
      point: {
        visible: true,
        style: {
          fill: '#667eea',
          stroke: '#fff',
          lineWidth: 2,
          size: 6,
        },
      },
      crosshair: {
        xField: { visible: true },
      },
    };
  }, [rows]);

  const tableColumns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'hour_start_ts',
        key: 'hour',
        width: 180,
        render: (v) => (
          <div className='flex items-center gap-2'>
            <IconClock className='text-gray-400' size='small' />
            <span>{timestamp2string(v)}</span>
          </div>
        ),
      },
      {
        title: '成功时间片',
        dataIndex: 'success_slices',
        key: 'success_slices',
        width: 120,
        render: (v) => (
          <span className='font-medium text-green-600'>{v}</span>
        ),
      },
      {
        title: '总时间片',
        dataIndex: 'total_slices',
        key: 'total_slices',
        width: 100,
        render: (v) => (
          <span className='font-medium'>{v}</span>
        ),
      },
      {
        title: '成功率',
        dataIndex: 'success_rate',
        key: 'success_rate',
        width: 150,
        render: (v) => {
          const rate = Number(v) || 0;
          const { color, bg, text } = getRateLevel(rate);
          return (
            <div className='flex items-center gap-2'>
              <div
                className='px-2 py-1 rounded-md text-sm font-medium'
                style={{ backgroundColor: bg, color }}
              >
                {formatRate(rate)}
              </div>
              <span className='text-xs text-gray-400'>{text}</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  function normalizeModelList(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      if (Array.isArray(data.models)) return data.models;
      if (Array.isArray(data.data)) return data.data;
      const flattened = Object.values(data).filter(Array.isArray).flat();
      const unique = Array.from(new Set(flattened)).filter((m) => typeof m === 'string' && m.trim());
      unique.sort((a, b) => a.localeCompare(b));
      return unique;
    }
    return [];
  }

  async function loadModels() {
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await API.get('/api/channel/models_enabled', { skipErrorHandler: true });
      const { success, message, data } = res.data || {};
      if (!success) {
        const errMsg = message || '加载模型列表失败';
        setModelsError(errMsg);
        showError(errMsg);
        return;
      }

      const modelList = normalizeModelList(data);
      const opts = modelList.map((m) => ({ label: m, value: m }));
      setModelOptions(opts);

      if (!inputs.model_name && opts.length > 0) {
        setInputs((prev) => ({ ...prev, model_name: opts[0].value }));
      }
    } catch (e) {
      setModelsError('加载模型列表失败');
      showError(e);
    } finally {
      setModelsLoading(false);
    }
  }

  async function query() {
    const modelName = (inputs.model_name || '').trim();
    if (!modelName) {
      showError('请选择模型');
      return;
    }

    const startHour = Number(inputs.start_hour);
    const endHour = Number(inputs.end_hour);

    if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
      showError('时间参数不合法');
      return;
    }
    if (startHour % 3600 !== 0 || endHour % 3600 !== 0 || endHour <= startHour) {
      showError('时间必须为整点，且结束时间需大于开始时间');
      return;
    }

    setLoading(true);
    setRowsError('');
    try {
      const res = await API.get('/api/model_health/hourly', {
        params: {
          model_name: modelName,
          start_hour: startHour,
          end_hour: endHour,
        },
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        const errMsg = message || '查询失败';
        setRowsError(errMsg);
        showError(errMsg);
        return;
      }

      if (!Array.isArray(data)) {
        const errMsg = '接口返回结构异常';
        setRowsError(errMsg);
        setRows([]);
        showError(errMsg);
        return;
      }

      setRows(data);
    } catch (e) {
      setRowsError('查询失败');
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModels().catch(console.error);
  }, []);

  useEffect(() => {
    if (inputs.model_name) {
      query().catch(console.error);
    }
  }, [inputs.model_name]);

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      const startTs = floorToHour(Math.floor(dates[0].getTime() / 1000));
      const endTs = floorToHour(Math.floor(dates[1].getTime() / 1000)) + 3600;
      setInputs((prev) => ({ ...prev, start_hour: startTs, end_hour: endTs }));
    }
  };


  return (
    <div className='mt-[60px] px-2 sm:px-4 pb-8'>
      {/* Header */}
      <div className='mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent'>
              模型健康度分析
            </h1>
            <p className='text-sm text-gray-500 mt-1'>
              按小时查看单个模型的健康度趋势
            </p>
          </div>
        </div>
      </div>

      {/* Query Form */}
      <Card className='!rounded-2xl mb-6' bodyStyle={{ padding: '20px 24px' }}>
        {(modelsError || rowsError) && (
          <div className='mb-4 p-3 rounded-lg bg-red-50 border border-red-200'>
            <Typography.Text type='danger'>{modelsError || rowsError}</Typography.Text>
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-4 gap-4 items-end'>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-2'>选择模型</label>
            <Select
              placeholder='选择或输入模型名称'
              optionList={modelOptions}
              filter={selectFilter}
              loading={modelsLoading}
              showClear
              allowCreate
              value={inputs.model_name}
              onChange={(v) => setInputs((prev) => ({ ...prev, model_name: v || '' }))}
              style={{ width: '100%' }}
              size='large'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-600 mb-2'>时间范围</label>
            <DatePicker
              type='dateTimeRange'
              value={[new Date(inputs.start_hour * 1000), new Date(inputs.end_hour * 1000)]}
              onChange={handleDateRangeChange}
              style={{ width: '100%' }}
              size='large'
            />
          </div>

          <div className='flex gap-2'>
            <Button
              icon={<IconSearch />}
              type='primary'
              onClick={query}
              loading={loading}
              size='large'
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              查询
            </Button>
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                const r = getDefaultHourRangeLast24h();
                setInputs((prev) => ({ ...prev, start_hour: r.startHour, end_hour: r.endHour }));
              }}
              size='large'
            >
              最近24h
            </Button>
          </div>
        </div>
      </Card>

      <Spin spinning={loading}>
        {/* Stats Cards */}
        {rows.length > 0 && (
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6'>
            <StatCard
              icon={<IconActivity className='text-white' />}
              title='平均成功率'
              value={formatRate(stats.avgRate)}
              color='#667eea'
              bgGradient='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            />
            <StatCard
              icon={<IconTickCircle className='text-white' />}
              title='成功时间片'
              value={stats.totalSuccess}
              color='#22c55e'
              bgGradient='linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            />
            <StatCard
              icon={<IconClock className='text-white' />}
              title='总时间片'
              value={stats.totalSlices}
              color='#3b82f6'
              bgGradient='linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            />
            <StatCard
              icon={<IconAlertTriangle className='text-white' />}
              title='最低成功率'
              value={formatRate(stats.minRate)}
              color='#f59e0b'
              bgGradient='linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            />
          </div>
        )}

        {/* Chart and Table */}
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
          {/* Chart */}
          <Card
            className='!rounded-2xl'
            title={
              <div className='flex items-center gap-2'>
                <div className='w-1 h-5 rounded-full bg-gradient-to-b from-purple-500 to-blue-500' />
                <span>成功率趋势</span>
              </div>
            }
            bodyStyle={{ padding: '16px' }}
          >
            <div className='h-80'>
              {rows.length > 0 ? (
                <VChart spec={chartSpec} option={{ mode: 'desktop-browser' }} />
              ) : (
                <div className='h-full flex items-center justify-center'>
                  <div className='text-center'>
                    <div className='text-4xl mb-2'>📈</div>
                    <Typography.Text type='tertiary'>暂无数据</Typography.Text>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Table */}
          <Card
            className='!rounded-2xl'
            title={
              <div className='flex items-center gap-2'>
                <div className='w-1 h-5 rounded-full bg-gradient-to-b from-green-500 to-teal-500' />
                <span>详细数据</span>
              </div>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={tableColumns}
              dataSource={(Array.isArray(rows) ? rows : []).map((r, idx) => ({
                ...r,
                key: `${r.hour_start_ts}-${idx}`,
              }))}
              pagination={false}
              size='small'
              scroll={{ y: 300 }}
              empty={
                <div className='py-8 text-center'>
                  <div className='text-4xl mb-2'>📊</div>
                  <Typography.Text type='tertiary'>
                    {rowsError ? '数据加载异常' : '暂无数据'}
                  </Typography.Text>
                </div>
              }
            />
          </Card>
        </div>
      </Spin>
    </div>
  );
}
