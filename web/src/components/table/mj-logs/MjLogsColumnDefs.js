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
import {
  Button,
  Progress,
  Tag,
  Typography
} from '@douyinfe/semi-ui';
import {
  Palette,
  ZoomIn,
  Shuffle,
  Move,
  FileText,
  Blend,
  Upload,
  Minimize2,
  RotateCcw,
  PaintBucket,
  Focus,
  Move3D,
  Monitor,
  UserCheck,
  HelpCircle,
  CheckCircle,
  Clock,
  Copy,
  FileX,
  Pause,
  XCircle,
  Loader,
  AlertCircle,
  Hash,
  Video
} from 'lucide-react';

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

// Render functions
function renderType(type, t) {
  switch (type) {
    case 'IMAGINE':
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Palette size={14} />}>
          {t('绘图')}
        </Tag>
      );
    case 'UPSCALE':
      return (
        <Tag color='orange' shape='circle' prefixIcon={<ZoomIn size={14} />}>
          {t('放大')}
        </Tag>
      );
    case 'VIDEO':
      return (
        <Tag color='orange' shape='circle' prefixIcon={<Video size={14} />}>
          {t('视频')}
        </Tag>
      );
    case 'EDITS':
      return (
        <Tag color='orange' shape='circle' prefixIcon={<Video size={14} />}>
          {t('编辑')}
        </Tag>
      );
    case 'VARIATION':
      return (
        <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
          {t('变换')}
        </Tag>
      );
    case 'HIGH_VARIATION':
      return (
        <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
          {t('强变换')}
        </Tag>
      );
    case 'LOW_VARIATION':
      return (
        <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
          {t('弱变换')}
        </Tag>
      );
    case 'PAN':
      return (
        <Tag color='cyan' shape='circle' prefixIcon={<Move size={14} />}>
          {t('平移')}
        </Tag>
      );
    case 'DESCRIBE':
      return (
        <Tag color='yellow' shape='circle' prefixIcon={<FileText size={14} />}>
          {t('图生文')}
        </Tag>
      );
    case 'BLEND':
      return (
        <Tag color='lime' shape='circle' prefixIcon={<Blend size={14} />}>
          {t('图混合')}
        </Tag>
      );
    case 'UPLOAD':
      return (
        <Tag color='blue' shape='circle' prefixIcon={<Upload size={14} />}>
          上传文件
        </Tag>
      );
    case 'SHORTEN':
      return (
        <Tag color='pink' shape='circle' prefixIcon={<Minimize2 size={14} />}>
          {t('缩词')}
        </Tag>
      );
    case 'REROLL':
      return (
        <Tag color='indigo' shape='circle' prefixIcon={<RotateCcw size={14} />}>
          {t('重绘')}
        </Tag>
      );
    case 'INPAINT':
      return (
        <Tag color='violet' shape='circle' prefixIcon={<PaintBucket size={14} />}>
          {t('局部重绘-提交')}
        </Tag>
      );
    case 'ZOOM':
      return (
        <Tag color='teal' shape='circle' prefixIcon={<Focus size={14} />}>
          {t('变焦')}
        </Tag>
      );
    case 'CUSTOM_ZOOM':
      return (
        <Tag color='teal' shape='circle' prefixIcon={<Move3D size={14} />}>
          {t('自定义变焦-提交')}
        </Tag>
      );
    case 'MODAL':
      return (
        <Tag color='green' shape='circle' prefixIcon={<Monitor size={14} />}>
          {t('窗口处理')}
        </Tag>
      );
    case 'SWAP_FACE':
      return (
        <Tag color='light-green' shape='circle' prefixIcon={<UserCheck size={14} />}>
          {t('换脸')}
        </Tag>
      );
    default:
      return (
        <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
          {t('未知')}
        </Tag>
      );
  }
}

function renderCode(code, t) {
  switch (code) {
    case 1:
      return (
        <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>
          {t('已提交')}
        </Tag>
      );
    case 21:
      return (
        <Tag color='lime' shape='circle' prefixIcon={<Clock size={14} />}>
          {t('等待中')}
        </Tag>
      );
    case 22:
      return (
        <Tag color='orange' shape='circle' prefixIcon={<Copy size={14} />}>
          {t('重复提交')}
        </Tag>
      );
    case 0:
      return (
        <Tag color='yellow' shape='circle' prefixIcon={<FileX size={14} />}>
          {t('未提交')}
        </Tag>
      );
    default:
      return (
        <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
          {t('未知')}
        </Tag>
      );
  }
}

function renderStatus(type, t) {
  switch (type) {
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
        <Tag color='blue' shape='circle' prefixIcon={<Loader size={14} />}>
          {t('执行中')}
        </Tag>
      );
    case 'FAILURE':
      return (
        <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
          {t('失败')}
        </Tag>
      );
    case 'MODAL':
      return (
        <Tag color='yellow' shape='circle' prefixIcon={<AlertCircle size={14} />}>
          {t('窗口等待')}
        </Tag>
      );
    default:
      return (
        <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
          {t('未知')}
        </Tag>
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
    <Tag color={color} shape='circle' prefixIcon={<Clock size={14} />}>
      {durationSec} {t('秒')}
    </Tag>
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
      render: (text, record, index) => {
        return <div>{renderTimestamp(text / 1000)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => {
        return renderDuration(record.submit_time, finish, t);
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
              shape='circle'
              prefixIcon={<Hash size={14} />}
              onClick={() => {
                copyText(text);
              }}
            >
              {' '}
              {text}{' '}
            </Tag>
          </div>
        ) : (
          <></>
        );
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
      dataIndex: 'mj_id',
      render: (text, record, index) => {
        return <div>{text}</div>;
      },
    },
    {
      key: COLUMN_KEYS.SUBMIT_RESULT,
      title: t('提交结果'),
      dataIndex: 'code',
      render: (text, record, index) => {
        return isAdminUser ? <div>{renderCode(text, t)}</div> : <></>;
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
        return (
          <div>
            {
              <Progress
                stroke={
                  record.status === 'FAILURE'
                    ? 'var(--semi-color-warning)'
                    : null
                }
                percent={text ? parseInt(text.replace('%', '')) : 0}
                showInfo={true}
                aria-label='drawing progress'
                style={{ minWidth: '160px' }}
              />
            }
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.IMAGE,
      title: t('结果图片'),
      dataIndex: 'image_url',
      render: (text, record, index) => {
        if (!text) {
          return t('无');
        }
        return (
          <Button
            size="small"
            onClick={() => {
              openImageModal(text);
            }}
          >
            {t('查看图片')}
          </Button>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: 'Prompt',
      dataIndex: 'prompt',
      render: (text, record, index) => {
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
    {
      key: COLUMN_KEYS.PROMPT_EN,
      title: 'PromptEn',
      dataIndex: 'prompt_en',
      render: (text, record, index) => {
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
    {
      key: COLUMN_KEYS.FAIL_REASON,
      title: t('失败原因'),
      dataIndex: 'fail_reason',
      fixed: 'right',
      render: (text, record, index) => {
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