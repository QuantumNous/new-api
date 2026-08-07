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

import React from 'react';
import { Tag, Typography, Avatar, Space } from '@douyinfe/semi-ui';
import { getLogOther, renderGroup, stringToColor } from '../../../helpers';

const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

const CATEGORY_TAG_CONFIG = {
  auth: { color: 'orange', labelKey: '鉴权失败' },
  rate_limit: { color: 'amber', labelKey: '限流' },
  channel: { color: 'violet', labelKey: '渠道' },
  validation: { color: 'blue', labelKey: '校验' },
  quota: { color: 'yellow', labelKey: '额度' },
  upstream: { color: 'red', labelKey: '上游错误' },
  other: { color: 'grey', labelKey: '其他' },
};

function renderCategory(category, t) {
  const config = CATEGORY_TAG_CONFIG[category] || CATEGORY_TAG_CONFIG.other;
  return (
    <Tag color={config.color} shape='circle'>
      {t(config.labelKey)}
    </Tag>
  );
}

function renderUseTime(useTime, t) {
  if (!useTime) {
    return '-';
  }
  const time = Number(useTime);
  if (Number.isNaN(time)) {
    return '-';
  }
  let color = 'green';
  if (time >= 10) {
    color = 'red';
  } else if (time >= 3) {
    color = 'orange';
  }
  return (
    <Tag color={color} shape='circle'>
      {time} s
    </Tag>
  );
}

export const getErrorLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  openContentModal,
}) => {
  return [
    {
      key: COLUMN_KEYS.TIME,
      title: t('时间'),
      dataIndex: 'timestamp2string',
      render: (text) => <div>{text || '-'}</div>,
    },
    {
      key: COLUMN_KEYS.REQUEST_ID,
      title: t('Request ID'),
      dataIndex: 'request_id',
      render: (text) => {
        if (!text) {
          return '-';
        }
        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ maxWidth: 140 }}
            onClick={() => copyText(text)}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (text) => {
        const displayText = String(text || '-');
        if (!text) {
          return '-';
        }
        return (
          <Space>
            <Avatar size='extra-small' color={stringToColor(displayText)}>
              {displayText.slice(0, 1)}
            </Avatar>
            <Typography.Text>{displayText}</Typography.Text>
          </Space>
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text) => {
        if (!text) {
          return '-';
        }
        return (
          <Tag
            color='grey'
            shape='circle'
            onClick={() => {
              copyText(text);
            }}
          >
            {text}
          </Tag>
        );
      },
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text) => {
        if (!text) {
          return '-';
        }
        return (
          <Tag
            color={stringToColor(text)}
            shape='circle'
            onClick={() => {
              copyText(text);
            }}
          >
            {text}
          </Tag>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record) => {
        if (text) {
          return <>{renderGroup(text)}</>;
        }
        const other = record._other || getLogOther(record.other) || {};
        if (other.group) {
          return <>{renderGroup(other.group)}</>;
        }
        return '-';
      },
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel',
      render: (text, record) => {
        if (!text) {
          return '-';
        }
        const label = record.channel_name
          ? `${record.channel_name} #${text}`
          : String(text);
        return (
          <Tag
            color={colors[parseInt(text) % colors.length]}
            size='large'
            shape='circle'
            onClick={() => {
              copyText(String(text));
            }}
          >
            {label}
          </Tag>
        );
      },
    },
    {
      key: COLUMN_KEYS.CATEGORY,
      title: t('错误分类'),
      dataIndex: 'other',
      render: (text, record) => {
        const other = record._other || getLogOther(record.other) || {};
        return renderCategory(other.error_category, t);
      },
    },
    {
      key: COLUMN_KEYS.STATUS_CODE,
      title: t('状态码'),
      dataIndex: 'other',
      render: (text, record) => {
        const other = record._other || getLogOther(record.other) || {};
        const statusCode = other.status_code;
        const errorCode = other.error_code;
        if (statusCode == null && (errorCode == null || errorCode === '')) {
          return '-';
        }
        return (
          <div className='flex flex-col gap-0.5'>
            {statusCode != null && (
              <Typography.Text>{statusCode}</Typography.Text>
            )}
            {errorCode != null && errorCode !== '' && (
              <Typography.Text
                type='tertiary'
                size='small'
                ellipsis={{ showTooltip: true }}
                style={{ maxWidth: 120 }}
              >
                {String(errorCode)}
              </Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.CONTENT,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      render: (text) => {
        if (!text) {
          return '-';
        }
        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 160, cursor: 'pointer' }}
            onClick={() => {
              openContentModal(text);
            }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时'),
      dataIndex: 'use_time',
      render: (text) => renderUseTime(text, t),
    },
    {
      key: COLUMN_KEYS.IS_STREAM,
      title: t('流式'),
      dataIndex: 'is_stream',
      render: (text) => (text ? t('是') : t('否')),
    },
    {
      key: COLUMN_KEYS.REQUEST_PATH,
      title: t('请求路径'),
      dataIndex: 'other',
      render: (text, record) => {
        const other = record._other || getLogOther(record.other) || {};
        const path = other.request_path;
        if (!path) {
          return '-';
        }
        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ maxWidth: 180 }}
          >
            {path}
          </Typography.Text>
        );
      },
    },
  ];
};
