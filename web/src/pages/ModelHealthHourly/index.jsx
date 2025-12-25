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
import { Card, Form, Button, Spin, Table, Typography, Select } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { API, selectFilter, showError, timestamp2string } from '../../helpers';

function floorToHour(tsSec) {
  return Math.floor(tsSec / 3600) * 3600;
}

function getDefaultHourRangeLast24h() {
  const nowSec = Math.floor(Date.now() / 1000);
  const endHour = floorToHour(nowSec) + 3600; // exclusive end, aligned
  const startHour = endHour - 24 * 3600;
  return { startHour, endHour };
}

function formatRate(rate) {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
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

  const chartSpec = useMemo(() => {
    const values = (rows || []).map((r) => ({
      ts: r.hour_start_ts,
      time: timestamp2string(r.hour_start_ts),
      rate: Number(r.success_rate) || 0,
    }));

    return {
      type: 'line',
      data: [{ id: 'health', values }],
      xField: 'time',
      yField: 'rate',
      axes: [
        {
          orient: 'left',
          label: {
            formatter: (v) => `${(Number(v) * 100).toFixed(0)}%`,
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
              key: 'success_rate',
              value: (d) => formatRate(Number(d?.rate) || 0),
            },
          ],
        },
      },
      line: {
        style: {
          lineWidth: 2,
        },
      },
      point: {
        visible: true,
        size: 2,
      },
    };
  }, [rows]);

  const tableColumns = useMemo(
    () => [
      {
        title: 'hour',
        dataIndex: 'hour_start_ts',
        key: 'hour',
        render: (v) => <span>{timestamp2string(v)}</span>,
      },
      {
        title: 'success_slices',
        dataIndex: 'success_slices',
        key: 'success_slices',
      },
      {
        title: 'total_slices',
        dataIndex: 'total_slices',
        key: 'total_slices',
      },
      {
        title: 'success_rate',
        dataIndex: 'success_rate',
        key: 'success_rate',
        render: (v) => (
          <Typography.Text>{formatRate(Number(v) || 0)}</Typography.Text>
        ),
      },
    ],
    [],
  );

  function normalizeModelList(data) {
    if (Array.isArray(data)) return data;

    // 兼容可能的返回结构：{ models: [...] } 或 { data: [...] }
    if (data && typeof data === 'object') {
      if (Array.isArray(data.models)) return data.models;
      if (Array.isArray(data.data)) return data.data;

      // 兼容对象映射结构：{ "1": [...], "37": null, ... }
      const flattened = Object.values(data)
        .filter(Array.isArray)
        .flat();

      const unique = Array.from(new Set(flattened)).filter((m) => typeof m === 'string' && m.trim());

      // 稳定可预期：去重后按字典序排序
      unique.sort((a, b) => a.localeCompare(b));

      return unique;
    }

    return [];
  }

  async function loadModels() {
    setModelsLoading(true);
    setModelsError('');
    try {
      // 工作台（管理员）更适合使用“系统当前启用的模型列表”，而不是 dashboard 的聚合列表。
      // /api/channel/models_enabled: AdminAuth, data: []string
      const res = await API.get('/api/channel/models_enabled', { skipErrorHandler: true });
      const { success, message, data } = res.data || {};
      if (!success) {
        const errMsg = message || '加载模型列表失败';
        setModelsError(errMsg);
        showError(errMsg);
        return;
      }

      const modelList = normalizeModelList(data);
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      if (data != null && dataType !== 'array' && dataType !== 'object' && modelList.length === 0) {
        const errMsg = '模型列表返回结构异常（期望数组或对象）';
        setModelsError(errMsg);
        showError(errMsg);
      }

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
      showError('model_name 不能为空');
      return;
    }

    const startHour = Number(inputs.start_hour);
    const endHour = Number(inputs.end_hour);

    if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
      showError('时间参数不合法');
      return;
    }
    if (startHour % 3600 !== 0 || endHour % 3600 !== 0 || endHour <= startHour) {
      showError('start_hour/end_hour 必须为整点 unix 秒，且 end_hour > start_hour');
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
        const errMsg = '接口返回结构异常（期望 data 为数组）';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inputs.model_name) {
      query().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.model_name]);

  return (
    <div className='mt-[60px] px-2'>
      <Card
        className='!rounded-2xl'
        title='模型健康度（按小时）'
        headerExtraContent={
          <Button
            onClick={() => {
              const r = getDefaultHourRangeLast24h();
              setInputs((prev) => ({ ...prev, start_hour: r.startHour, end_hour: r.endHour }));
            }}
            type='tertiary'
          >
            最近 24 小时
          </Button>
        }
      >
        <Form layout='vertical'>
          {(modelsError || rowsError) && (
            <div className='mb-2'>
              <Typography.Text type='danger'>
                {modelsError || rowsError}
              </Typography.Text>
            </div>
          )}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div>
              <label className='semi-form-field-label'>
                <span className='semi-form-field-label-text'>model_name</span>
              </label>
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
              />
            </div>

            <Form.InputNumber
              field='start_hour'
              label='start_hour（unix 秒，整点）'
              placeholder='例如：1700000000'
              value={inputs.start_hour}
              onChange={(v) => setInputs((prev) => ({ ...prev, start_hour: Number(v) }))}
            />

            <Form.InputNumber
              field='end_hour'
              label='end_hour（unix 秒，整点，exclusive）'
              placeholder='例如：1700003600'
              value={inputs.end_hour}
              onChange={(v) => setInputs((prev) => ({ ...prev, end_hour: Number(v) }))}
            />
          </div>

          <div className='flex gap-2 mt-2'>
            <Button type='primary' onClick={query} loading={loading}>
              查询
            </Button>
          </div>
        </Form>

        <div className='mt-4'>
          <Spin spinning={loading}>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              <Card className='!rounded-2xl' title='success_rate 趋势' bodyStyle={{ padding: 8 }}>
                <div className='h-80'>
                  <VChart spec={chartSpec} option={{ mode: 'desktop-browser' }} />
                </div>
              </Card>

              <Card className='!rounded-2xl' title='明细（每小时）' bodyStyle={{ padding: 0 }}>
                <Table
                  columns={tableColumns}
                  dataSource={(Array.isArray(rows) ? rows : []).map((r, idx) => ({
                    ...r,
                    key: `${r.hour_start_ts}-${idx}`,
                  }))}
                  pagination={false}
                  size='small'
                  bordered
                />
                {!loading && (!Array.isArray(rows) || rows.length === 0) && (
                  <div className='px-4 py-3'>
                    <Typography.Text type='tertiary'>
                      {rowsError ? '数据异常，已降级为空列表' : '暂无数据'}
                    </Typography.Text>
                  </div>
                )}
              </Card>
            </div>
          </Spin>
        </div>
      </Card>
    </div>
  );
}