import React from 'react';
import { Button, Modal, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';
import {
  PREPARATION_STATUS,
  PREPARATION_STATUS_LABELS,
} from '../../../hooks/channels/useChannelPreparationsData';

const statusColor = {
  [PREPARATION_STATUS.PENDING]: 'blue',
  [PREPARATION_STATUS.PROMOTED]: 'green',
  [PREPARATION_STATUS.ARCHIVED]: 'grey',
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getChannelLabel = (type) => {
  return CHANNEL_OPTIONS.find((item) => item.value === type)?.label || type;
};

const getModelsPreview = (models) => {
  if (!models) return '-';
  const list = String(models)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) return '-';
  if (list.length <= 2) return list.join(', ');
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`;
};

export const getPreparationColumns = ({
  t,
  openEdit,
  promotePreparation,
  archivePreparation,
}) => [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
    fixed: true,
  },
  {
    title: t('名称'),
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (text) => (
      <Typography.Text ellipsis={{ showTooltip: true }}>{text}</Typography.Text>
    ),
  },
  {
    title: t('渠道类型'),
    dataIndex: 'type',
    key: 'type',
    width: 160,
    render: (value) => getChannelLabel(value),
  },
  {
    title: t('状态'),
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (value) => (
      <Tag color={statusColor[value] || 'grey'}>
        {t(PREPARATION_STATUS_LABELS[value] || '未知')}
      </Tag>
    ),
  },
  {
    title: t('分组'),
    dataIndex: 'group',
    key: 'group',
    width: 140,
  },
  {
    title: 'Key',
    dataIndex: 'key_preview',
    key: 'key_preview',
    width: 160,
    render: (value) => value || '-',
  },
  {
    title: t('模型'),
    dataIndex: 'models',
    key: 'models',
    width: 220,
    render: getModelsPreview,
  },
  {
    title: t('余额'),
    dataIndex: 'balance',
    key: 'balance',
    width: 100,
    render: (value) => value ?? 0,
  },
  {
    title: t('优先级'),
    dataIndex: 'priority',
    key: 'priority',
    width: 90,
    render: (value) => value ?? 0,
  },
  {
    title: t('权重'),
    dataIndex: 'weight',
    key: 'weight',
    width: 90,
    render: (value) => value ?? 0,
  },
  {
    title: t('晋升渠道'),
    dataIndex: 'promoted_channel_id',
    key: 'promoted_channel_id',
    width: 110,
    render: (value) => value || '-',
  },
  {
    title: t('创建时间'),
    dataIndex: 'created_time',
    key: 'created_time',
    width: 180,
    render: formatTime,
  },
  {
    title: t('操作'),
    key: 'operate',
    fixed: 'right',
    width: 210,
    render: (_, record) => {
      const pending = record.status === PREPARATION_STATUS.PENDING;
      return (
        <Space>
          <Button
            size='small'
            theme='outline'
            type='primary'
            disabled={!pending}
            onClick={() => {
              Modal.confirm({
                title: t('确认晋升？'),
                content: t('该候选渠道会被创建为正式渠道。'),
                onOk: () => promotePreparation(record),
              });
            }}
          >
            {t('晋升')}
          </Button>
          <Button
            size='small'
            type='tertiary'
            disabled={!pending}
            onClick={() => openEdit(record)}
          >
            {t('编辑')}
          </Button>
          <Button
            size='small'
            type='tertiary'
            disabled={!pending}
            onClick={() => {
              Modal.confirm({
                title: t('确认归档？'),
                content: t('归档后候选渠道不会被晋升。'),
                onOk: () => archivePreparation(record),
              });
            }}
          >
            {t('归档')}
          </Button>
        </Space>
      );
    },
  },
];
