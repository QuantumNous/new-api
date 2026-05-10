/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Tag } from '@douyinfe/semi-ui';
import { timestamp2string } from '../../../helpers';

// Maps reconcile_hourly.token_type to the Chinese label used in supplier bills.
const TOKEN_TYPE_LABEL = {
  input: '输入',
  cached_input: '缓存输入',
  cached_storage: '缓存存储',
  output: '输出',
  count: '次数',
  unknown: '未知',
};

// Each token_type renders with a distinguishing colour to make the table easier
// to scan for the admin during manual comparison.
const TOKEN_TYPE_COLOR = {
  input: 'blue',
  cached_input: 'cyan',
  cached_storage: 'lime',
  output: 'violet',
  count: 'amber',
};

const renderHourRange = (hourBucket, t) => {
  if (!hourBucket) return '-';
  const start = timestamp2string(hourBucket - 3600);
  const end = timestamp2string(hourBucket);
  return (
    <span className='whitespace-nowrap text-xs'>
      {start} ~ {end}
    </span>
  );
};

const renderTokenType = (tokenType, t) => {
  const color = TOKEN_TYPE_COLOR[tokenType] || 'grey';
  const label = TOKEN_TYPE_LABEL[tokenType] || tokenType;
  return (
    <Tag color={color} shape='circle' size='small'>
      {t(label)}
    </Tag>
  );
};

const renderNumber = (n) => (
  <span className='block text-right font-mono text-xs'>
    {n !== undefined && n !== null ? Number(n).toLocaleString() : '-'}
  </span>
);

const renderAmount = (n) => (
  <span className='block text-right font-mono text-xs'>
    {n !== undefined && n !== null ? `¥${Number(n).toFixed(6)}` : '-'}
  </span>
);

export const getReconcileColumns = (t) => [
  {
    title: t('时间范围'),
    dataIndex: 'hour_bucket',
    width: 280,
    fixed: 'left',
    render: (v) => renderHourRange(v, t),
  },
  {
    title: t('渠道'),
    dataIndex: 'channel_name',
    width: 160,
    render: (v, row) => {
      const display = v ? `${row.channel_id} - ${v}` : `#${row.channel_id}`;
      return (
        <span className='text-xs' title={display}>
          {display}
        </span>
      );
    },
  },
  {
    title: t('模型'),
    dataIndex: 'model_name',
    width: 160,
    render: (v) => (
      <span className='font-mono text-xs' title={v}>
        {v}
      </span>
    ),
  },
  {
    title: t('token 类型'),
    dataIndex: 'token_type',
    width: 110,
    render: (v) => renderTokenType(v, t),
  },
  {
    title: t('Tokens'),
    dataIndex: 'tokens',
    width: 110,
    align: 'right',
    render: renderNumber,
  },
  {
    title: t('金额(¥)'),
    dataIndex: 'amount_cny',
    width: 130,
    align: 'right',
    render: renderAmount,
  },
  {
    title: t('请求数'),
    dataIndex: 'request_count',
    width: 90,
    align: 'right',
    render: renderNumber,
  },
  {
    title: t('备注'),
    dataIndex: 'note',
    width: 180,
    render: (v) =>
      v ? (
        <span className='text-xs text-gray-500' title={v}>
          {v}
        </span>
      ) : null,
  },
];
