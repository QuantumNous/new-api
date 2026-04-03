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
import { Avatar, Progress, Space, Tag, Typography } from '@douyinfe/semi-ui';
import {
  CheckCircle,
  Clock,
  HelpCircle,
  List,
  Loader,
  Pause,
  Play,
  XCircle,
} from 'lucide-react';
import {
  TASK_ACTION_FIRST_TAIL_GENERATE,
  TASK_ACTION_GENERATE,
  TASK_ACTION_IMAGE_EDIT,
  TASK_ACTION_IMAGE_GENERATE,
  TASK_ACTION_REFERENCE_GENERATE,
  TASK_ACTION_REMIX_GENERATE,
  TASK_ACTION_TEXT_GENERATE,
} from '../../../constants/common.constant';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';
import { stringToColor } from '../../../helpers/render';

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

const renderTimestamp = (timestampInSeconds) => {
  const date = new Date(Number(timestampInSeconds) * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const normalizeUnixTimestamp = (timestamp) => {
  const numericValue = Number(timestamp || 0);
  if (!numericValue || Number.isNaN(numericValue)) {
    return 0;
  }
  return numericValue > 1000000000000
    ? Math.floor(numericValue / 1000)
    : Math.floor(numericValue);
};

const normalizeTaskStatus = (status) =>
  String(status || '')
    .trim()
    .toUpperCase();

const isFinishedStatus = (status) => {
  const normalizedStatus = normalizeTaskStatus(status);
  return [
    'SUCCESS',
    'FAILURE',
    'FAILED',
    'CANCELED',
    'CANCELLED',
    'ERROR',
    'COMPLETED',
    'SUCCEEDED',
    'DONE',
  ].includes(normalizedStatus);
};

const renderDuration = (submitTime, finishTime, record) => {
  const submitTimestamp = normalizeUnixTimestamp(submitTime);
  const fallbackFinishTimestamp =
    isFinishedStatus(record?.status) && !finishTime
      ? record?.updated_at
      : 0;
  const finishTimestamp = normalizeUnixTimestamp(
    finishTime || fallbackFinishTimestamp,
  );
  const startTimestamp = normalizeUnixTimestamp(record?.start_time || 0);

  let durationSec = 0;
  if (startTimestamp > 0 && finishTimestamp > 0) {
    durationSec = finishTimestamp - startTimestamp;
  } else if (submitTimestamp > 0 && finishTimestamp > 0) {
    durationSec = finishTimestamp - submitTimestamp;
  } else {
    return '-';
  }

  if (durationSec < 0) {
    return '-';
  }

  const color = durationSec >= 60 ? 'red' : 'green';
  let durationLabel = '0s';
  if (durationSec >= 3600) {
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);
    durationLabel = `${hours}h ${minutes}m`;
  } else if (durationSec >= 60) {
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    durationLabel = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  } else if (durationSec > 0) {
    durationLabel = `${durationSec}s`;
  }

  return (
    <Tag color={color} shape='circle'>
      {durationLabel}
    </Tag>
  );
};

const renderPlatform = (platform, t) => {
  const option = CHANNEL_OPTIONS.find(
    (item) => String(item.value) === String(platform),
  );
  if (option) {
    return (
      <Tag color={option.color} shape='circle'>
        {option.label}
      </Tag>
    );
  }

  if (platform === 'suno') {
    return (
      <Tag color='green' shape='circle'>
        Suno
      </Tag>
    );
  }

  return (
    <Tag color='white' shape='circle'>
      {t('未知')}
    </Tag>
  );
};

const normalizeTaskData = (data) => {
  if (!data) {
    return null;
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data === 'object') {
    return data;
  }
  return null;
};

const extractTextFromMessageContent = (content) => {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      if (typeof item.text === 'string' && item.text.trim()) {
        return item.text.trim();
      }
      if (typeof item.content === 'string' && item.content.trim()) {
        return item.content.trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
};

const extractTaskPrompt = (record) => {
  const properties = record?.properties;
  if (properties && typeof properties === 'object') {
    const inputPrompt = String(properties.input || '').trim();
    if (inputPrompt) {
      return inputPrompt;
    }
  }

  const data = normalizeTaskData(record?.data);
  if (!data) {
    return '';
  }

  const directPrompt = String(
    data.prompt || data.input || data.description || '',
  ).trim();
  if (directPrompt) {
    return directPrompt;
  }

  const requestPrompt = String(
    data?.request?.prompt ||
      data?.request?.input ||
      data?.task_result?.prompt ||
      '',
  ).trim();
  if (requestPrompt) {
    return requestPrompt;
  }

  if (Array.isArray(data?.messages)) {
    const prompt = data.messages
      .map((message) => extractTextFromMessageContent(message?.content))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (prompt) {
      return prompt;
    }
  }

  const choicePrompt = extractTextFromMessageContent(
    data?.choices?.[0]?.message?.content,
  );
  if (choicePrompt) {
    return choicePrompt;
  }

  return '';
};

const extractModelName = (record) => {
  const properties = record?.properties;
  if (properties && typeof properties === 'object') {
    if (properties.origin_model_name) {
      return properties.origin_model_name;
    }
    if (properties.upstream_model_name) {
      return properties.upstream_model_name;
    }
  }

  const data = normalizeTaskData(record?.data);
  if (!data) {
    return '';
  }

  return data.model || data.request?.model || data.task_result?.model || '';
};

const renderModel = (record, t) => {
  const modelName = extractModelName(record);
  if (!modelName) {
    return (
      <Tag color='white' shape='circle'>
        {t('未知模型')}
      </Tag>
    );
  }

  return (
    <Tag color='blue' shape='circle'>
      {modelName}
    </Tag>
  );
};

const renderStatus = (status, t) => {
  switch (status) {
    case 'SUCCESS':
      return (
        <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>
          {t('成功')}
        </Tag>
      );
    case 'NOT_START':
      return (
        <Tag color='grey' shape='circle' prefixIcon={<Pause size={14} />}>
          {t('未启动')}
        </Tag>
      );
    case 'SUBMITTED':
      return (
        <Tag color='yellow' shape='circle' prefixIcon={<Clock size={14} />}>
          {t('队列中')}
        </Tag>
      );
    case 'IN_PROGRESS':
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Play size={14} />}>
          {t('执行中')}
        </Tag>
      );
    case 'FAILURE':
      return (
        <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
          {t('失败')}
        </Tag>
      );
    case 'QUEUED':
      return (
        <Tag color='orange' shape='circle' prefixIcon={<List size={14} />}>
          {t('排队中')}
        </Tag>
      );
    case 'UNKNOWN':
      return (
        <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
          {t('未知')}
        </Tag>
      );
    case '':
      return (
        <Tag color='grey' shape='circle' prefixIcon={<Loader size={14} />}>
          {t('正在提交')}
        </Tag>
      );
    default:
      return (
        <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
          {t('未知')}
        </Tag>
      );
  }
};

export const getTaskLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  openContentModal,
  isAdminUser,
  openVideoModal,
  openImageModal,
  openAudioModal,
}) => {
  return [
    {
      key: COLUMN_KEYS.SUBMIT_TIME,
      title: t('提交时间'),
      dataIndex: 'submit_time',
      render: (text) => <div>{text ? renderTimestamp(text) : '-'}</div>,
    },
    {
      key: COLUMN_KEYS.FINISH_TIME,
      title: t('结束时间'),
      dataIndex: 'finish_time',
      render: (text) => <div>{text ? renderTimestamp(text) : '-'}</div>,
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => (
        <>{renderDuration(record.submit_time, finish, record)}</>
      ),
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel_id',
      render: (text) => {
        return isAdminUser ? (
          <div>
            <Tag
              color={colors[parseInt(text, 10) % colors.length]}
              size='large'
              shape='circle'
              onClick={() => {
                copyText(text);
              }}
            >
              {text}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (userId, record) => {
        if (!isAdminUser) {
          return <></>;
        }
        const displayText = String(record.username || userId || '?');
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
      key: COLUMN_KEYS.PLATFORM,
      title: t('模型'),
      dataIndex: 'platform',
      render: (text, record) => <div>{renderModel(record, t)}</div>,
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('提示词'),
      dataIndex: 'action',
      render: (text, record) => {
        const prompt = extractTaskPrompt(record);
        if (!prompt) {
          return t('无');
        }

        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 220, display: 'inline-block' }}
            onClick={() => {
              openContentModal(prompt);
            }}
          >
            {prompt}
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.TASK_ID,
      title: t('任务ID'),
      dataIndex: 'task_id',
      render: (text, record) => {
        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            onClick={() => {
              openContentModal(JSON.stringify(record, null, 2));
            }}
          >
            <div>{text}</div>
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.TASK_STATUS,
      title: t('任务状态'),
      dataIndex: 'status',
      render: (text) => <div>{renderStatus(text, t)}</div>,
    },
    {
      key: COLUMN_KEYS.PROGRESS,
      title: t('进度'),
      dataIndex: 'progress',
      render: (text, record) => {
        return (
          <div>
            {isNaN(text?.replace('%', '')) ? (
              text || '-'
            ) : (
              <Progress
                stroke={record.status === 'FAILURE' ? 'var(--semi-color-warning)' : null}
                percent={text ? parseInt(text.replace('%', ''), 10) : 0}
                showInfo={true}
                aria-label='task progress'
                style={{ minWidth: '160px' }}
              />
            )}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.FAIL_REASON,
      title: t('详情'),
      dataIndex: 'fail_reason',
      fixed: 'right',
      render: (text, record) => {
        const isSunoSuccess =
          record.platform === 'suno' &&
          record.status === 'SUCCESS' &&
          Array.isArray(record.data) &&
          record.data.some((clip) => clip.audio_url);
        if (isSunoSuccess) {
          return (
            <a
              href='#'
              onClick={(e) => {
                e.preventDefault();
                openAudioModal(record.data);
              }}
            >
              {t('点击预览音乐')}
            </a>
          );
        }

        const isVideoTask =
          record.action === TASK_ACTION_GENERATE ||
          record.action === TASK_ACTION_TEXT_GENERATE ||
          record.action === TASK_ACTION_FIRST_TAIL_GENERATE ||
          record.action === TASK_ACTION_REFERENCE_GENERATE ||
          record.action === TASK_ACTION_REMIX_GENERATE;
        const isImageTask =
          record.action === TASK_ACTION_IMAGE_GENERATE ||
          record.action === TASK_ACTION_IMAGE_EDIT;
        const isSuccess = record.status === 'SUCCESS';
        const resultUrl = record.result_url;
        const hasResultUrl =
          typeof resultUrl === 'string' && /^(https?:\/\/|data:)/.test(resultUrl);

        if (isSuccess && isVideoTask && hasResultUrl) {
          return (
            <a
              href='#'
              onClick={(e) => {
                e.preventDefault();
                openVideoModal(resultUrl);
              }}
            >
              {t('点击预览视频')}
            </a>
          );
        }

        if (isSuccess && isImageTask && hasResultUrl) {
          return (
            <a
              href='#'
              onClick={(e) => {
                e.preventDefault();
                openImageModal?.(resultUrl);
              }}
            >
              {t('点击预览图片')}
            </a>
          );
        }

        if (!text) {
          return t('无');
        }

        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 100 }}
            onClick={() => {
              openContentModal(text);
            }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
  ];
};
