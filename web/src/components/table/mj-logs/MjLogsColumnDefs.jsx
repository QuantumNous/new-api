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
import { Button, Tooltip } from '@heroui/react';
import {
  AlertCircle,
  Blend,
  CheckCircle,
  Clock,
  Copy,
  FileText,
  FileX,
  Focus,
  Hash,
  HelpCircle,
  Loader,
  Minimize2,
  Monitor,
  Move,
  Move3D,
  PaintBucket,
  Palette,
  Pause,
  RotateCcw,
  Shuffle,
  Upload,
  UserCheck,
  Video,
  XCircle,
  ZoomIn,
} from 'lucide-react';

const TONE_TO_HEX = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  grey: '#94a3b8',
  indigo: '#6366f1',
  'light-blue': '#0ea5e9',
  'light-green': '#4ade80',
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
  if (color === 'white') {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        {prefixIcon}
        {children}
      </span>
    );
  }
  const hex = TONE_TO_HEX[color] || TONE_TO_HEX.grey;
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

function renderType(type, t) {
  switch (type) {
    case 'IMAGINE':
      return (
        <ColorTag color='blue' prefixIcon={<Palette size={12} />}>
          {t('绘图')}
        </ColorTag>
      );
    case 'UPSCALE':
      return (
        <ColorTag color='orange' prefixIcon={<ZoomIn size={12} />}>
          {t('放大')}
        </ColorTag>
      );
    case 'VIDEO':
      return (
        <ColorTag color='orange' prefixIcon={<Video size={12} />}>
          {t('视频')}
        </ColorTag>
      );
    case 'EDITS':
      return (
        <ColorTag color='orange' prefixIcon={<Video size={12} />}>
          {t('编辑')}
        </ColorTag>
      );
    case 'VARIATION':
      return (
        <ColorTag color='purple' prefixIcon={<Shuffle size={12} />}>
          {t('变换')}
        </ColorTag>
      );
    case 'HIGH_VARIATION':
      return (
        <ColorTag color='purple' prefixIcon={<Shuffle size={12} />}>
          {t('强变换')}
        </ColorTag>
      );
    case 'LOW_VARIATION':
      return (
        <ColorTag color='purple' prefixIcon={<Shuffle size={12} />}>
          {t('弱变换')}
        </ColorTag>
      );
    case 'PAN':
      return (
        <ColorTag color='cyan' prefixIcon={<Move size={12} />}>
          {t('平移')}
        </ColorTag>
      );
    case 'DESCRIBE':
      return (
        <ColorTag color='yellow' prefixIcon={<FileText size={12} />}>
          {t('图生文')}
        </ColorTag>
      );
    case 'BLEND':
      return (
        <ColorTag color='lime' prefixIcon={<Blend size={12} />}>
          {t('图混合')}
        </ColorTag>
      );
    case 'UPLOAD':
      return (
        <ColorTag color='blue' prefixIcon={<Upload size={12} />}>
          上传文件
        </ColorTag>
      );
    case 'SHORTEN':
      return (
        <ColorTag color='pink' prefixIcon={<Minimize2 size={12} />}>
          {t('缩词')}
        </ColorTag>
      );
    case 'REROLL':
      return (
        <ColorTag color='indigo' prefixIcon={<RotateCcw size={12} />}>
          {t('重绘')}
        </ColorTag>
      );
    case 'INPAINT':
      return (
        <ColorTag color='violet' prefixIcon={<PaintBucket size={12} />}>
          {t('局部重绘-提交')}
        </ColorTag>
      );
    case 'ZOOM':
      return (
        <ColorTag color='teal' prefixIcon={<Focus size={12} />}>
          {t('变焦')}
        </ColorTag>
      );
    case 'CUSTOM_ZOOM':
      return (
        <ColorTag color='teal' prefixIcon={<Move3D size={12} />}>
          {t('自定义变焦-提交')}
        </ColorTag>
      );
    case 'MODAL':
      return (
        <ColorTag color='green' prefixIcon={<Monitor size={12} />}>
          {t('窗口处理')}
        </ColorTag>
      );
    case 'SWAP_FACE':
      return (
        <ColorTag color='light-green' prefixIcon={<UserCheck size={12} />}>
          {t('换脸')}
        </ColorTag>
      );
    default:
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
      );
  }
}

function renderCode(code, t) {
  switch (code) {
    case 1:
      return (
        <ColorTag color='green' prefixIcon={<CheckCircle size={12} />}>
          {t('已提交')}
        </ColorTag>
      );
    case 21:
      return (
        <ColorTag color='lime' prefixIcon={<Clock size={12} />}>
          {t('等待中')}
        </ColorTag>
      );
    case 22:
      return (
        <ColorTag color='orange' prefixIcon={<Copy size={12} />}>
          {t('重复提交')}
        </ColorTag>
      );
    case 0:
      return (
        <ColorTag color='yellow' prefixIcon={<FileX size={12} />}>
          {t('未提交')}
        </ColorTag>
      );
    default:
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
      );
  }
}

function renderStatus(type, t) {
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
        <ColorTag color='blue' prefixIcon={<Loader size={12} />}>
          {t('执行中')}
        </ColorTag>
      );
    case 'FAILURE':
      return (
        <ColorTag color='red' prefixIcon={<XCircle size={12} />}>
          {t('失败')}
        </ColorTag>
      );
    case 'MODAL':
      return (
        <ColorTag color='yellow' prefixIcon={<AlertCircle size={12} />}>
          {t('窗口等待')}
        </ColorTag>
      );
    default:
      return (
        <ColorTag color='white' prefixIcon={<HelpCircle size={12} />}>
          {t('未知')}
        </ColorTag>
      );
  }
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

function renderDuration(submit_time, finishTime, t) {
  if (!submit_time || !finishTime) return 'N/A';
  const start = new Date(submit_time);
  const finish = new Date(finishTime);
  const durationMs = finish - start;
  const durationSec = (durationMs / 1000).toFixed(1);
  const color = durationSec > 60 ? 'red' : 'green';
  return (
    <ColorTag color={color} prefixIcon={<Clock size={12} />}>
      {durationSec} {t('秒')}
    </ColorTag>
  );
}

export const getMjLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  openContentModal,
  openImageModal,
  isAdminUser,
}) => {
  return [
    {
      key: COLUMN_KEYS.SUBMIT_TIME,
      title: t('提交时间'),
      dataIndex: 'submit_time',
      render: (text) => <div>{renderTimestamp(text / 1000)}</div>,
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => renderDuration(record.submit_time, finish, t),
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
          <ColorTag
            color={tone}
            prefixIcon={<Hash size={12} />}
            onClick={() => copyText(text)}
          >
            {text}
          </ColorTag>
        );
      },
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
      dataIndex: 'mj_id',
      render: (text) => <div>{text}</div>,
    },
    {
      key: COLUMN_KEYS.SUBMIT_RESULT,
      title: t('提交结果'),
      dataIndex: 'code',
      render: (text) => (isAdminUser ? <div>{renderCode(text, t)}</div> : null),
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
      render: (text, record) => (
        <ProgressBar
          percent={text ? parseInt(text.replace('%', '')) : 0}
          errored={record.status === 'FAILURE'}
        />
      ),
    },
    {
      key: COLUMN_KEYS.IMAGE,
      title: t('结果图片'),
      dataIndex: 'image_url',
      render: (text) => {
        if (!text) return t('无');
        return (
          <Button size='sm' variant='tertiary' onPress={() => openImageModal(text)}>
            {t('查看图片')}
          </Button>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: 'Prompt',
      dataIndex: 'prompt',
      render: (text) => {
        if (!text) return t('无');
        return (
          <EllipsisText width={100} onClick={() => openContentModal(text)}>
            {text}
          </EllipsisText>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT_EN,
      title: 'PromptEn',
      dataIndex: 'prompt_en',
      render: (text) => {
        if (!text) return t('无');
        return (
          <EllipsisText width={100} onClick={() => openContentModal(text)}>
            {text}
          </EllipsisText>
        );
      },
    },
    {
      key: COLUMN_KEYS.FAIL_REASON,
      title: t('失败原因'),
      dataIndex: 'fail_reason',
      fixed: 'right',
      render: (text) => {
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
