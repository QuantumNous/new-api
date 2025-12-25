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
import { Button, Card, Form, Space, Table, Typography } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';

function floorToHour(tsSec) {
  return Math.floor(tsSec / 3600) * 3600;
}

function getDefaultHourRangeLast24h() {
  const nowSec = Math.floor(Date.now() / 1000);
  const endHour = floorToHour(nowSec) + 3600; // exclusive end, aligned
  const startHour = endHour - 24 * 3600;
  return { startHour, endHour };
}

function isAxiosError403(error) {
  return error?.name === 'AxiosError' && error?.response?.status === 403;
}

function displayName(userId, username) {
  const u = (username || '').trim();
  if (u) return u;
  return String(userId ?? '');
}

export default function UserHourlyCallsRankPage() {
  const navigate = useNavigate();

  const defaultRange = useMemo(() => getDefaultHourRangeLast24h(), []);
  const [inputs, setInputs] = useState({
    start_hour: defaultRange.startHour,
    end_hour: defaultRange.endHour,
    limit: 50,
  });

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [errorText, setErrorText] = useState('');

  const query = useCallback(async () => {
    const startHour = Number(inputs.start_hour);
    const endHour = Number(inputs.end_hour);
    const limit = Number(inputs.limit) || 50;

    if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
      showError('时间参数不合法');
      return;
    }
    if (startHour % 3600 !== 0 || endHour % 3600 !== 0 || endHour <= startHour) {
      showError('start_hour/end_hour 必须为整点 unix 秒，且 end_hour > start_hour');
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const res = await API.get('/api/user_rank/hourly_calls', {
        params: {
          start_hour: startHour,
          end_hour: endHour,
          limit,
        },
        skipErrorHandler: true,
      });

      const { success, message, data } = res.data || {};
      if (!success) {
        const msg = message || '查询失败';
        setErrorText(msg);
        showError(msg);
        return;
      }

      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (Number(b?.total_calls) || 0) - (Number(a?.total_calls) || 0));
      setRows(list);
    } catch (e) {
      if (isAxiosError403(e)) {
        navigate('/forbidden', { replace: true });
        return;
      }
      setErrorText(e?.message || '请求失败');
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [inputs.start_hour, inputs.end_hour, inputs.limit, navigate]);

  const columns = useMemo(
    () => [
      {
        title: 'rank',
        key: 'rank',
        width: 90,
        render: (_, __, idx) => <span>{idx + 1}</span>,
      },
      {
        title: 'user_id',
        dataIndex: 'user_id',
        key: 'user_id',
        width: 120,
        render: (v) => <span>{String(v)}</span>,
      },
      {
        title: 'username',
        key: 'username',
        render: (_, r) => <span>{displayName(r?.user_id, r?.username)}</span>,
      },
      {
        title: 'total_calls',
        dataIndex: 'total_calls',
        key: 'total_calls',
        width: 140,
        sorter: (a, b) => (Number(a?.total_calls) || 0) - (Number(b?.total_calls) || 0),
        defaultSortOrder: 'descend',
      },
    ],
    [],
  );

  return (
    <div className='mt-[60px] px-2'>
      <Card
        className='!rounded-2xl'
        title='用户小时调用排行'
        headerExtraContent={
          <Space>
            <Button
              type='tertiary'
              onClick={() => {
                const r = getDefaultHourRangeLast24h();
                setInputs((prev) => ({
                  ...prev,
                  start_hour: r.startHour,
                  end_hour: r.endHour,
                }));
              }}
            >
              最近 24 小时
            </Button>
            <Button type='tertiary' loading={loading} onClick={query}>
              刷新
            </Button>
          </Space>
        }
      >
        <Form layout='vertical'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <Form.InputNumber
              field='start_hour'
              label='start_hour（unix 秒，整点）'
              value={inputs.start_hour}
              onChange={(v) => setInputs((prev) => ({ ...prev, start_hour: Number(v) }))}
            />

            <Form.InputNumber
              field='end_hour'
              label='end_hour（unix 秒，整点，exclusive）'
              value={inputs.end_hour}
              onChange={(v) => setInputs((prev) => ({ ...prev, end_hour: Number(v) }))}
            />

            <Form.Select
              field='limit'
              label='limit'
              optionList={[
                { label: '20', value: 20 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
                { label: '200', value: 200 },
                { label: '500', value: 500 },
              ]}
              value={inputs.limit}
              onChange={(v) => setInputs((prev) => ({ ...prev, limit: Number(v) || 50 }))}
            />
          </div>

          <div className='flex gap-2 mt-2'>
            <Button type='primary' onClick={query} loading={loading}>
              查询
            </Button>
          </div>
        </Form>

        {errorText ? (
          <div className='mt-3'>
            <Typography.Text type='danger'>{errorText}</Typography.Text>
          </div>
        ) : null}

        <div className='mt-4'>
          <Table
            bordered
            size='small'
            loading={loading}
            columns={columns}
            dataSource={(rows || []).map((r, idx) => ({
              ...r,
              key: `${r?.user_id ?? 'u'}-${idx}`,
            }))}
            pagination={false}
          />
        </div>
      </Card>
    </div>
  );
}