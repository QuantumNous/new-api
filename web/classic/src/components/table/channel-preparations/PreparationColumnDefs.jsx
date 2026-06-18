import React from 'react';
import {
  Button,
  Modal,
  SplitButtonGroup,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconTreeTriangleDown } from '@douyinfe/semi-icons';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';
import {
  DEFAULT_BATCH_TEST_MODEL,
  PREPARATION_STATUS,
  PREPARATION_STATUS_LABELS,
  PREPARATION_TEST_STATUS,
} from '../../../hooks/channels/useChannelPreparationsData';
import { renderResponseTime } from '../channels/ChannelsColumnDefs';

const statusColor = {
  [PREPARATION_STATUS.PENDING]: 'blue',
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getChannelLabel = (type) => {
  return CHANNEL_OPTIONS.find((item) => item.value === type)?.label || type;
};

const renderTestStatus = (record, testingPreparationIds, t) => {
  if (testingPreparationIds?.has(record.id)) {
    return <Tag color='blue'>{t('测试中')}</Tag>;
  }
  if (record.test_status === PREPARATION_TEST_STATUS.SUCCESS) {
    return <Tag color='green'>{t('成功')}</Tag>;
  }
  if (record.test_status === PREPARATION_TEST_STATUS.FAILED) {
    const failedTag = <Tag color='red'>{t('失败')}</Tag>;
    return record.test_message ? (
      <Tooltip content={record.test_message}>{failedTag}</Tooltip>
    ) : (
      failedTag
    );
  }
  if (record.test_time) {
    return <Tag color='green'>{t('已测试')}</Tag>;
  }
  return <Tag color='grey'>{t('未测试')}</Tag>;
};

export const getPreparationColumns = ({
  t,
  openEdit,
  promotePreparation,
  deletePreparation,
  testPreparation,
  setCurrentTestChannel,
  setShowModelTestModal,
  testingPreparationIds,
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
    title: t('测试状态'),
    dataIndex: 'test_status',
    key: 'test_status',
    width: 110,
    render: (_, record) => renderTestStatus(record, testingPreparationIds, t),
  },
  {
    title: t('响应时间'),
    dataIndex: 'response_time',
    key: 'response_time',
    width: 110,
    render: (value) => renderResponseTime(value ?? 0, t),
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
    width: 320,
    render: (_, record) => {
      const pending = record.status === PREPARATION_STATUS.PENDING;
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <SplitButtonGroup
            className='overflow-hidden'
            aria-label={t('测试候选渠道操作项目组')}
            style={{ display: 'inline-flex', flexShrink: 0 }}
          >
            <Button
              size='small'
              type='tertiary'
              onClick={() => testPreparation(record, DEFAULT_BATCH_TEST_MODEL)}
            >
              {t('测试')}
            </Button>
            <Button
              size='small'
              type='tertiary'
              icon={<IconTreeTriangleDown />}
              onClick={() => {
                setCurrentTestChannel({ ...record, models: record.models || '' });
                setShowModelTestModal(true);
              }}
            />
          </SplitButtonGroup>
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
                title: t('确认删除？'),
                content: t('删除后候选渠道会从备货池移除。'),
                onOk: () => deletePreparation(record),
              });
            }}
          >
            {t('删除')}
          </Button>
        </div>
      );
    },
  },
];
