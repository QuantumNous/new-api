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
import { Button, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import {
  Music,
  FileText,
  HelpCircle,
  CheckCircle,
  Pause,
  Clock,
  Play,
  XCircle,
  Loader,
  List,
  Hash,
  Video,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  TASK_ACTION_FIRST_TAIL_GENERATE,
  TASK_ACTION_GENERATE,
  TASK_ACTION_REFERENCE_GENERATE,
  TASK_ACTION_TEXT_GENERATE,
  TASK_ACTION_REMIX_GENERATE,
} from '../../../constants/common.constant';
import { CHANNEL_OPTIONS } from '../../../constants/channel.constants';
import { stringToColor } from '../../../helpers/render';
import { Avatar, Space } from '@douyinfe/semi-ui';

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

const parseJsonLike = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const pickHttpUrl = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      return value;
    }
  }
  return '';
};

const extractVideoUrlFromPayload = (payload) => {
  const taskData = parseJsonLike(payload);
  if (!taskData || typeof taskData !== 'object') {
    return '';
  }

  const directUrl = pickHttpUrl(
    taskData.video_url,
    taskData.videoUrl,
    taskData.result_url,
    taskData.resultUrl,
    taskData.url,
    taskData?.content?.video_url,
    taskData?.content?.videoUrl,
    taskData?.content?.result_url,
    taskData?.content?.resultUrl,
  );
  if (directUrl) {
    return directUrl;
  }

  return (
    extractVideoUrlFromPayload(taskData.response) ||
    extractVideoUrlFromPayload(taskData.data) ||
    ''
  );
};

const extractVideoPreviewUrl = (record) => {
  const upstreamVideoUrl = extractVideoUrlFromPayload(record?.data);
  if (upstreamVideoUrl) {
    return upstreamVideoUrl;
  }

  const resultUrl = record?.result_url;
  if (typeof resultUrl === 'string' && /^https?:\/\//.test(resultUrl)) {
    return resultUrl;
  }

  const legacyFailReasonUrl =
    extractVideoUrlFromPayload(record?.fail_reason) ||
    pickHttpUrl(record?.fail_reason);
  if (legacyFailReasonUrl) {
    return legacyFailReasonUrl;
  }

  return '';
};

const parseSignedUrlTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const matched = value
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!matched) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = matched;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
};

const parseExpiryTimestamp = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return trimmed.length > 10 ? numeric : numeric * 1000;
};

const getQueryParamIgnoreCase = (params, key) => {
  if (!params || typeof key !== 'string' || key === '') {
    return null;
  }

  const directValue = params.get(key);
  if (directValue !== null) {
    return directValue;
  }

  const lowerKey = key.toLowerCase();
  for (const [entryKey, entryValue] of params.entries()) {
    if (entryKey.toLowerCase() === lowerKey) {
      return entryValue;
    }
  }

  return null;
};

const extractUrlExpiryTime = (url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const signedDatePairs = [
      ['X-Amz-Date', 'X-Amz-Expires'],
      ['X-Goog-Date', 'X-Goog-Expires'],
      ['X-Tos-Date', 'X-Tos-Expires'],
    ];
    for (const [dateKey, expiresKey] of signedDatePairs) {
      const signedStart = parseSignedUrlTime(
        getQueryParamIgnoreCase(params, dateKey),
      );
      const signedExpires = Number(
        getQueryParamIgnoreCase(params, expiresKey),
      );
      if (
        Number.isFinite(signedStart) &&
        Number.isFinite(signedExpires) &&
        signedExpires > 0
      ) {
        return signedStart + signedExpires * 1000;
      }
    }

    const timestampFields = [
      'Expires',
      'expires',
      'expire',
      'expiration',
      'e',
    ];
    for (const field of timestampFields) {
      const expiryTime = parseExpiryTimestamp(
        getQueryParamIgnoreCase(params, field),
      );
      if (expiryTime !== null) {
        return expiryTime;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const isResultLinkExpired = (url) => {
  const expiryTime = extractUrlExpiryTime(url);
  return expiryTime !== null && expiryTime <= Date.now();
};

const stringifyDetail = (value) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const extractProgressItems = (record) => {
  const candidates = [
    record?.progress,
    record?.progresses,
    record?.progress_array,
    record?.progressArray,
  ];
  const parsedData = parseJsonLike(record?.data);
  if (parsedData && typeof parsedData === 'object') {
    candidates.push(
      parsedData.progress,
      parsedData.progresses,
      parsedData.progress_array,
      parsedData.progressArray,
      parsedData.data?.progress,
      parsedData.data?.progresses,
    );
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = parseJsonLike(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  }

  return [];
};

const getProgressText = (item) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }
  const value =
    item.progress ??
    item.percent ??
    item.percentage ??
    item.status ??
    item.message ??
    item.desc;
  return value === undefined || value === null
    ? stringifyDetail(item)
    : String(value);
};

const parseProgressPercent = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value));
  }
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) {
    return null;
  }

  const percent = Number(match[1]);
  if (!Number.isFinite(percent)) {
    return null;
  }
  return Math.max(0, Math.min(100, percent));
};

const resolveProgressDisplay = (text, record) => {
  const items = extractProgressItems(record);
  const progressTextList = items
    .map(getProgressText)
    .filter((item) => item !== '');
  const sourceText =
    progressTextList.length > 0
      ? progressTextList[progressTextList.length - 1]
      : text;
  const percent = parseProgressPercent(sourceText);

  return {
    percent,
    label: sourceText || '-',
    tooltip:
      progressTextList.length > 0
        ? progressTextList.join('\n')
        : stringifyDetail(sourceText),
  };
};

const renderDetailIcon = ({
  icon,
  tooltip,
  ariaLabel,
  type = 'tertiary',
  onClick,
}) => (
  <Tooltip content={tooltip} position='top' showArrow>
    <Button
      theme='borderless'
      type={type}
      size='default'
      className='task-action-icon-button'
      icon={icon}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    />
  </Tooltip>
);

const renderInlineProgress = (progress, record) => {
  const percent = Math.round(progress.percent);
  return (
    <Tooltip
      content={progress.tooltip || progress.label}
      position='top'
      showArrow
    >
      <div
        className={`task-inline-progress ${record.status === 'FAILURE' ? 'is-failure' : ''}`}
        role='progressbar'
        aria-label='task progress'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className='task-inline-progress-fill'
          style={{ width: `${percent}%` }}
        />
        <span className='task-inline-progress-label'>{percent}%</span>
      </div>
    </Tooltip>
  );
};

const renderExpiredLinkTag = ({ t, tooltip }) => (
  <Tooltip content={tooltip} position='top' showArrow>
    <Tag className='task-detail-expired' shape='circle' prefixIcon={<Clock size={14} />}>
      {t('链接过期')}
    </Tag>
  </Tooltip>
);

// Render functions
const renderTimestamp = (timestampInSeconds) => {
  const date = new Date(timestampInSeconds * 1000); // 从秒转换为毫秒

  const year = date.getFullYear(); // 获取年份
  const month = ('0' + (date.getMonth() + 1)).slice(-2); // 获取月份，从0开始需要+1，并保证两位数
  const day = ('0' + date.getDate()).slice(-2); // 获取日期，并保证两位数
  const hours = ('0' + date.getHours()).slice(-2); // 获取小时，并保证两位数
  const minutes = ('0' + date.getMinutes()).slice(-2); // 获取分钟，并保证两位数
  const seconds = ('0' + date.getSeconds()).slice(-2); // 获取秒钟，并保证两位数

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // 格式化输出
};

function renderDuration(submit_time, finishTime) {
  if (!submit_time || !finishTime) return 'N/A';
  const durationSec = finishTime - submit_time;
  const color = durationSec > 60 ? 'red' : 'green';

  // 返回带有样式的颜色标签
  return (
    <Tag color={color} shape='circle'>
      {durationSec} s
    </Tag>
  );
}

const renderType = (type, t) => {
  switch (type) {
    case 'MUSIC':
      return (
        <Tag color='grey' shape='circle' prefixIcon={<Music size={14} />}>
          {t('生成音乐')}
        </Tag>
      );
    case 'LYRICS':
      return (
        <Tag color='pink' shape='circle' prefixIcon={<FileText size={14} />}>
          {t('生成歌词')}
        </Tag>
      );
    case TASK_ACTION_GENERATE:
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
          {t('图生视频')}
        </Tag>
      );
    case TASK_ACTION_TEXT_GENERATE:
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
          {t('文生视频')}
        </Tag>
      );
    case TASK_ACTION_FIRST_TAIL_GENERATE:
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
          {t('首尾生视频')}
        </Tag>
      );
    case TASK_ACTION_REFERENCE_GENERATE:
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
          {t('参照生视频')}
        </Tag>
      );
    case TASK_ACTION_REMIX_GENERATE:
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
          {t('视频Remix')}
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

const renderPlatform = (platform, t) => {
  let option = CHANNEL_OPTIONS.find(
    (opt) => String(opt.value) === String(platform),
  );
  if (option) {
    return (
      <Tag color={option.color} shape='circle'>
        {option.label}
      </Tag>
    );
  }
  switch (platform) {
    case 'suno':
      return (
        <Tag color='green' shape='circle'>
          Suno
        </Tag>
      );
    default:
      return (
        <Tag color='white' shape='circle'>
          {t('未知')}
        </Tag>
      );
  }
};

const renderStatus = (type, t) => {
  switch (type) {
    case 'SUCCESS':
      return (
        <Tag
          color='green'
          shape='circle'
          prefixIcon={<CheckCircle size={14} />}
        >
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
  openAudioModal,
}) => {
  return [
    {
      key: COLUMN_KEYS.SUBMIT_TIME,
      title: t('提交时间'),
      dataIndex: 'submit_time',
      render: (text, record, index) => {
        return <div>{text ? renderTimestamp(text) : '-'}</div>;
      },
    },
    {
      key: COLUMN_KEYS.FINISH_TIME,
      title: t('结束时间'),
      dataIndex: 'finish_time',
      render: (text, record, index) => {
        return <div>{text ? renderTimestamp(text) : '-'}</div>;
      },
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => {
        return <>{finish ? renderDuration(record.submit_time, finish) : '-'}</>;
      },
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel_id',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Tag
              color={colors[parseInt(text) % colors.length]}
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
      render: (userId, record, index) => {
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
      title: t('平台'),
      dataIndex: 'platform',
      render: (text, record, index) => {
        return <div>{renderPlatform(text, t)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'action',
      render: (text, record, index) => {
        return <div>{renderType(text, t)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.TASK_ID,
      title: t('任务ID'),
      dataIndex: 'task_id',
      render: (text, record, index) => {
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
      render: (text, record, index) => {
        return <div>{renderStatus(text, t)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.PROGRESS,
      title: t('进度'),
      dataIndex: 'progress',
      render: (text, record, index) => {
        const progress = resolveProgressDisplay(text, record);
        return (
          <div className='task-progress-cell'>
            {progress.percent === null ? (
              <Tooltip
                content={progress.tooltip || progress.label}
                position='top'
                showArrow
              >
                <Tag className='task-progress-text' shape='circle'>
                  {progress.label}
                </Tag>
              </Tooltip>
            ) : (
              renderInlineProgress(progress, record)
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
      render: (text, record, index) => {
        // Suno audio preview
        const isSunoSuccess =
          record.platform === 'suno' &&
          record.status === 'SUCCESS' &&
          Array.isArray(record.data) &&
          record.data.some((c) => c.audio_url);
        if (isSunoSuccess) {
          return renderDetailIcon({
            icon: <Music size={15} />,
            tooltip: t('点击预览音乐'),
            ariaLabel: t('点击预览音乐'),
            type: 'primary',
            onClick: () => openAudioModal(record.data),
          });
        }

        // 视频预览：优先使用 result_url，兼容旧数据 fail_reason 中的 URL
        const isVideoTask =
          record.action === TASK_ACTION_GENERATE ||
          record.action === TASK_ACTION_TEXT_GENERATE ||
          record.action === TASK_ACTION_FIRST_TAIL_GENERATE ||
          record.action === TASK_ACTION_REFERENCE_GENERATE ||
          record.action === TASK_ACTION_REMIX_GENERATE;
        const isSuccess = record.status === 'SUCCESS';
        const resultUrl = extractVideoPreviewUrl(record);
        const hasResultUrl =
          typeof resultUrl === 'string' && /^https?:\/\//.test(resultUrl);
        const isExpiredResultUrl = hasResultUrl && isResultLinkExpired(resultUrl);
        if (isSuccess && isVideoTask && isExpiredResultUrl) {
          return renderExpiredLinkTag({
            t,
            tooltip: t('任务结果链接已过期'),
          });
        }
        if (isSuccess && isVideoTask && hasResultUrl) {
          return renderDetailIcon({
            icon: <Video size={15} />,
            tooltip: t('点击预览视频'),
            ariaLabel: t('点击预览视频'),
            type: 'primary',
            onClick: () => openVideoModal(resultUrl),
          });
        }
        if (!text) {
          return (
            <Tag className='task-detail-empty' shape='circle'>
              {t('无')}
            </Tag>
          );
        }
        return renderDetailIcon({
          icon: <Info size={15} />,
          tooltip: text,
          ariaLabel: t('查看详情'),
          onClick: () => openContentModal(text),
        });
      },
    },
  ];
};
