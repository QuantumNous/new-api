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
import { Card, Spin, Table, Typography, Tag, Button } from '@douyinfe/semi-ui';
import { API, showError, timestamp2string } from '../../helpers';

function formatRate(rate) {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
}

function hourLabel(tsSec) {
  // 显示到小时即可
  const full = timestamp2string(tsSec);
  return full.slice(0, 13) + ':00';
}

function getRateColor(rate) {
  const v = Number(rate) || 0;
  if (v >= 0.99) return 'green';
  if (v >= 0.95) return 'lime';
  if (v >= 0.8) return 'orange';
  if (v >= 0.5) return 'amber';
  return 'red';
}

export default function ModelHealthPublicPage() {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [payload, setPayload] = useState(null);

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

  const { columns, dataSource } = useMemo(() => {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];

    // rows: [{ model_name, hour_start_ts, success_slices, total_slices, success_rate }]
    const byModel = new Map();
    for (const r of rows) {
      const name = r?.model_name || '';
      if (!name) continue;
      if (!byModel.has(name)) byModel.set(name, new Map());
      byModel.get(name).set(Number(r.hour_start_ts), r);
    }

    const models = Array.from(byModel.keys()).sort((a, b) => a.localeCompare(b));

    const baseColumns = [
      {
        title: 'model',
        dataIndex: 'model_name',
        key: 'model_name',
        fixed: 'left',
        width: 220,
        render: (v) => (
          <Typography.Text strong style={{ wordBreak: 'break-all' }}>
            {v}
          </Typography.Text>
        ),
      },
      {
        title: 'avg(24h)',
        dataIndex: 'avg_rate',
        key: 'avg_rate',
        width: 110,
        fixed: 'left',
        render: (v) => <Tag color={getRateColor(v)}>{formatRate(Number(v) || 0)}</Tag>,
      },
    ];

    const hourColumns = hourStarts.map((ts) => ({
      title: hourLabel(ts),
      dataIndex: `h_${ts}`,
      key: `h_${ts}`,
      width: 110,
      render: (cell) => {
        const rate = Number(cell?.success_rate) || 0;
        const total = Number(cell?.total_slices) || 0;
        const success = Number(cell?.success_slices) || 0;

        return (
          <div className='flex flex-col gap-1'>
            <Tag color={getRateColor(rate)}>{formatRate(rate)}</Tag>
            <Typography.Text type='tertiary' size='small'>
              {success}/{total}
            </Typography.Text>
          </div>
        );
      },
    }));

    const allColumns = [...baseColumns, ...hourColumns];

    const dataSource = models.map((modelName) => {
      const hourMap = byModel.get(modelName);
      let sumRate = 0;
      let count = 0;

      const row = {
        key: modelName,
        model_name: modelName,
      };

      for (const ts of hourStarts) {
        const stat = hourMap?.get(ts) || {
          hour_start_ts: ts,
          model_name: modelName,
          success_slices: 0,
          total_slices: 0,
          success_rate: 0,
        };
        row[`h_${ts}`] = stat;
        sumRate += Number(stat.success_rate) || 0;
        count += 1;
      }

      row.avg_rate = count > 0 ? sumRate / count : 0;
      return row;
    });

    return { columns: allColumns, dataSource };
  }, [payload?.rows, hourStarts]);

  return (
    <div className='mt-[60px] px-2'>
      <Card
        className='!rounded-2xl'
        title='模型健康度（最近 24 小时，每小时）'
        headerExtraContent={
          <Button type='tertiary' onClick={load} loading={loading}>
            刷新
          </Button>
        }
      >
        {errorText && (
          <div className='mb-2'>
            <Typography.Text type='danger'>{errorText}</Typography.Text>
          </div>
        )}

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size='small'
            bordered
            scroll={{ x: Math.max(900, 220 + 110 + hourStarts.length * 110) }}
          />
          {!loading && dataSource.length === 0 && (
            <div className='px-4 py-3'>
              <Typography.Text type='tertiary'>暂无数据</Typography.Text>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
}