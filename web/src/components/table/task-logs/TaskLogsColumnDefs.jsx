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
import { Tooltip } from '@heroui/react';
import {
  CheckCircle,
  Clock,
  FileText,
  Hash,
  HelpCircle,
  List,
  Loader,
  Music,
  Pause,
  Play,
  Sparkles,
  Video,
  XCircle,
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

const TONE_TO_HEX = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  grey: '#94a3b8',
  indigo: '#6366f1',
  'light-blue': '#0ea5e9',
  lime: '#84cc16',
  orange: '#f97316',
  pink: '#ec4899',
  purple: '#a855f7',
  red: '#ef4444',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  yellow: '#eab308',
  white: '#ffffff',
};

const TAG_PALETTE_KEYS = [
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

function ColorTag({ color, prefixIcon, children, onClick }) {
  const hex = TONE_TO_HEX[color] || TONE_TO_HEX.grey;
  if (color === 'white') {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-background px-2 py-0.5 text-xs font-medium text-foreground ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        {prefixIcon}
        {children}
      </span>
    );
  }
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{
        backgroundColor: `${hex}1A`,
        color: hex,
      }}
    >
      {prefixIcon}
      {children}
    </span>
  );
}

function ProgressBar({ percent, errored }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className='inline-flex min-w-[160px] items-center gap-2'>
      <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary'>
        <div
          className={`h-full rounded-full transition-all ${
            errored
              ? 'bg-amber-500'
              : clamped >= 100
                ? 'bg-emerald-500'
                : 'bg-primary'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className='shrink-0 text-xs text-muted'>{clamped}%</span>
    </div>
  );
}

function EllipsisText({ children, width = 100, onClick }) {
  return (
    <Tooltip content={children} placement='top'>
      <span
        onClick={onClick}
        className={`inline-block truncate align-middle text-sm text-foreground ${
          onClick ? 'cursor-pointer' : ''
        }`}
        style={{ maxWidth: width }}
      >
        {children}
      </span>
    </Tooltip>
  );
}

function UserChip({ name }) {
  const tone = stringToColor(name) || 'grey';
  const hex = TONE_TO_HEX[tone] || TONE_TO_HEX.grey;
  return (
    <span className='inline-flex items-center gap-2'>
      <span
        className='flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold'
        style={{
          background: `${hex}26`,
          color: hex,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className='text-sm text-foreground'>{name}</span>
    </span>
  );
}

const renderTimestamp = (timestampInSeconds) => {
  const date = new Date(timestampInSeconds * 1000);
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

function renderDuration(submit_time, finishTime) {
  if (!submit_time || !finishTime) return 'N/A';
  const durationSec = finishTime - submit_time;
  const color = durationSec > 60 ? 'red' : 'green';
  return <ColorTag color={color}>{durationSec} s</ColorTag>;
}

const renderType = (type, t) => {
  switch (type) {
    case 'MUSIC':
      return (
        <ColorTag color='grey' prefixIcon={<Music size={12} />}>
          {t('生成音乐')}
        </ColorTag>
      );
    case 'LYRICS':
      return (
        <ColorTag color='pink' prefixIcon={<FileText size={12} />}>
          {t('生成歌词')}
        </ColorTag>
      );
    case TASK_ACTION_GENERATE:
      return (
        <ColorTag color='blue' prefixIcon={<Sparkles size={12} />}>
          {t('图生视频')}
        </ColorTag>
      );
    case TASK_ACTION_TEXT_GENERATE:
      return (
        <ColorTag color='blue' prefixIcon={<Sparkles size={12} />}>
          {t('文生视频')}
        </ColorTag>
      );
    case TASK_ACTION_FIRST_TAIL_GENERATE:
      return (
        <ColorTag color='blue' prefixIcon={<Sparkles size={12} />}>
          {t('首尾生视频')}
        </ColorTag>
      );
    case TASK_ACTION_REFERENCE_GENERATE:
      return (
        <ColorTag color='blue' prefixIcon={<Sparkles size={12} />}>
          {t('参照生视频')}
        </ColorTag>
      );
    case TASK_ACTION_REMIX_GENERATE:
      return (
        <ColorTag color='blue' prefixIcon={<Sparkles size={12} />}>
          {t('视频Remix')}
        </ColorTag>
      );
    default:
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
      );
  }
};

const renderPlatform = (platform, t) => {
  const option = CHANNEL_OPTIONS.find(
    (opt) => String(opt.value) === String(platform),
  );
  if (option) {
    return <ColorTag color={option.color}>{option.label}</ColorTag>;
  }
  switch (platform) {
    case 'suno':
      return <ColorTag color='green'>Suno</ColorTag>;
    default:
      return <ColorTag color='white'>{t('未知')}</ColorTag>;
  }
};

const renderStatus = (type, t) => {
  switch (type) {
    case 'SUCCESS':
      return (
        <ColorTag color='green' prefixIcon={<CheckCircle size={12} />}>
          {t('成功')}
        </ColorTag>
      );
    case 'NOT_START':
      return (
        <ColorTag color='grey' prefixIcon={<Pause size={12} />}>
          {t('未启动')}
        </ColorTag>
      );
    case 'SUBMITTED':
      return (
        <ColorTag color='yellow' prefixIcon={<Clock size={12} />}>
          {t('队列中')}
        </ColorTag>
      );
    case 'IN_PROGRESS':
      return (
        <ColorTag color='blue' prefixIcon={<Play size={12} />}>
          {t('执行中')}
        </ColorTag>
      );
    case 'FAILURE':
      return (
        <ColorTag color='red' prefixIcon={<XCircle size={12} />}>
          {t('失败')}
        </ColorTag>
      );
    case 'QUEUED':
      return (
        <ColorTag color='orange' prefixIcon={<List size={12} />}>
          {t('排队中')}
        </ColorTag>
      );
    case 'UNKNOWN':
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
      );
    case '':
      return (
        <ColorTag color='grey' prefixIcon={<Loader size={12} />}>
          {t('正在提交')}
        </ColorTag>
      );
    default:
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
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
        <>{finish ? renderDuration(record.submit_time, finish) : '-'}</>
      ),
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel_id',
      render: (text) => {
        if (!isAdminUser) return null;
        const tone =
          TAG_PALETTE_KEYS[parseInt(text) % TAG_PALETTE_KEYS.length] || 'grey';
        return (
          <ColorTag color={tone} onClick={() => copyText(text)}>
            {text}
          </ColorTag>
        );
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (userId, record) => {
        if (!isAdminUser) return null;
        const displayText = String(record.username || userId || '?');
        return <UserChip name={displayText} />;
      },
    },
    {
      key: COLUMN_KEYS.PLATFORM,
      title: t('平台'),
      dataIndex: 'platform',
      render: (text) => <div>{renderPlatform(text, t)}</div>,
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'action',
      render: (text) => <div>{renderType(text, t)}</div>,
    },
    {
      key: COLUMN_KEYS.TASK_ID,
      title: t('任务ID'),
      dataIndex: 'task_id',
      render: (text, record) => (
        <EllipsisText
          width={120}
          onClick={() => openContentModal(JSON.stringify(record, null, 2))}
        >
          {text}
        </EllipsisText>
      ),
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
        if (text == null || text === '') {
          return text || '-';
        }
        const numeric = isNaN(text?.replace?.('%', ''))
          ? null
          : parseInt(text.replace('%', ''));
        if (numeric == null) return text || '-';
        return (
          <ProgressBar
            percent={numeric}
            errored={record.status === 'FAILURE'}
          />
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
          record.data.some((c) => c.audio_url);
        if (isSunoSuccess) {
          return (
            <a
              href='#'
              className='text-primary underline'
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
        const isSuccess = record.status === 'SUCCESS';
        const resultUrl = record.result_url;
        const hasResultUrl =
          typeof resultUrl === 'string' && /^https?:\/\//.test(resultUrl);
        if (isSuccess && isVideoTask && hasResultUrl) {
          return (
            <a
              href='#'
              className='text-primary underline'
              onClick={(e) => {
                e.preventDefault();
                openVideoModal(resultUrl);
              }}
            >
              {t('点击预览视频')}
            </a>
          );
        }
        if (!text) return t('无');
        return (
          <EllipsisText width={100} onClick={() => openContentModal(text)}>
            {text}
          </EllipsisText>
        );
      },
    },
  ];
};
