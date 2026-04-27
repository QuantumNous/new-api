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
import { Button } from '@heroui/react';
import { MoreVertical } from 'lucide-react';
import { timestamp2string, showSuccess, showError } from '../../../helpers';
import ClickMenu from '../../common/ui/ClickMenu';
import {
  FaPlay,
  FaTrash,
  FaServer,
  FaMemory,
  FaMicrochip,
  FaCheckCircle,
  FaSpinner,
  FaClock,
  FaExclamationCircle,
  FaBan,
  FaTerminal,
  FaPlus,
  FaInfoCircle,
  FaLink,
  FaStop,
  FaHourglassHalf,
  FaGlobe,
} from 'react-icons/fa';

const normalizeStatus = (status) =>
  typeof status === 'string' ? status.trim().toLowerCase() : '';

// Tone palette mirrors the Semi `<Tag color>` palette we used to use for
// status chips. Maps to semantic surface tones so light/dark inherit from
// theme tokens.
const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  orange: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusChip({ tone = 'grey', icon, children }) {
  const cls = TAG_TONE[tone] || TAG_TONE.grey;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

const STATUS_TAG_CONFIG = {
  running: {
    color: 'green',
    labelKey: '运行中',
    icon: <FaPlay size={10} />,
  },
  deploying: {
    color: 'blue',
    labelKey: '部署中',
    icon: <FaSpinner size={10} />,
  },
  pending: {
    color: 'orange',
    labelKey: '待部署',
    icon: <FaClock size={10} />,
  },
  stopped: {
    color: 'grey',
    labelKey: '已停止',
    icon: <FaStop size={10} />,
  },
  error: {
    color: 'red',
    labelKey: '错误',
    icon: <FaExclamationCircle size={10} />,
  },
  failed: {
    color: 'red',
    labelKey: '失败',
    icon: <FaExclamationCircle size={10} />,
  },
  destroyed: {
    color: 'red',
    labelKey: '已销毁',
    icon: <FaBan size={10} />,
  },
  completed: {
    color: 'green',
    labelKey: '已完成',
    icon: <FaCheckCircle size={10} />,
  },
  'deployment requested': {
    color: 'blue',
    labelKey: '部署请求中',
    icon: <FaSpinner size={10} />,
  },
  'termination requested': {
    color: 'orange',
    labelKey: '终止请求中',
    icon: <FaClock size={10} />,
  },
};

const DEFAULT_STATUS_CONFIG = {
  color: 'grey',
  labelKey: null,
  icon: <FaInfoCircle size={10} />,
};

const parsePercentValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

const clampPercent = (value) => {
  if (value === null || value === undefined) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const formatRemainingMinutes = (minutes, t) => {
  if (minutes === null || minutes === undefined) return null;
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return null;
  const totalMinutes = Math.max(0, Math.round(numeric));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  const parts = [];

  if (days > 0) {
    parts.push(`${days}${t('天')}`);
  }
  if (hours > 0) {
    parts.push(`${hours}${t('小时')}`);
  }
  if (parts.length === 0 || mins > 0) {
    parts.push(`${mins}${t('分钟')}`);
  }

  return parts.join(' ');
};

// Returns CSS-variable colors keyed off the semantic palette so the
// "traffic light" remaining-time indicator stays theme-aware.
const getRemainingTheme = (percentRemaining) => {
  if (percentRemaining === null) {
    return {
      tone: 'blue',
      iconColor: 'var(--app-primary)',
      textColor: 'var(--app-muted)',
    };
  }

  if (percentRemaining <= 10) {
    return {
      tone: 'red',
      iconColor: 'var(--app-danger)',
      textColor: 'var(--app-danger)',
    };
  }

  if (percentRemaining <= 30) {
    return {
      tone: 'orange',
      iconColor: 'var(--app-warning)',
      textColor: 'var(--app-warning)',
    };
  }

  return {
    tone: 'green',
    iconColor: 'var(--app-success)',
    textColor: 'var(--app-success)',
  };
};

const renderStatus = (status, t) => {
  const normalizedStatus = normalizeStatus(status);
  const config = STATUS_TAG_CONFIG[normalizedStatus] || DEFAULT_STATUS_CONFIG;
  const statusText = typeof status === 'string' ? status : '';
  const labelText = config.labelKey
    ? t(config.labelKey)
    : statusText || t('未知状态');

  return (
    <StatusChip tone={config.color} icon={config.icon}>
      {labelText}
    </StatusChip>
  );
};

// Container Name Cell Component - kept as a component so the inline copy
// handler can use hooks if it ever needs to.
const ContainerNameCell = ({ text, record, t }) => {
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(record.id);
      showSuccess(t('已复制 ID 到剪贴板'));
    } catch (err) {
      showError(t('复制失败'));
    }
  };

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-base font-semibold text-foreground'>{text}</span>
      <button
        type='button'
        onClick={handleCopyId}
        title={t('点击复制ID')}
        className='select-all text-xs text-muted hover:text-primary transition-colors text-left cursor-pointer'
      >
        ID: {record.id}
      </button>
    </div>
  );
};

// Render resource configuration
const renderResourceConfig = (resource, t) => {
  if (!resource) return '-';

  const { cpu, memory, gpu } = resource;

  return (
    <div className='flex flex-col gap-1'>
      {cpu && (
        <div className='flex items-center gap-1 text-xs'>
          <FaMicrochip className='text-primary' />
          <span>CPU: {cpu}</span>
        </div>
      )}
      {memory && (
        <div className='flex items-center gap-1 text-xs'>
          <FaMemory className='text-success' />
          <span>{t('内存')}: {memory}</span>
        </div>
      )}
      {gpu && (
        <div className='flex items-center gap-1 text-xs'>
          <FaServer className='text-accent' />
          <span>GPU: {gpu}</span>
        </div>
      )}
    </div>
  );
};

// Main function to get all deployment columns
export const getDeploymentsColumns = ({
  t,
  COLUMN_KEYS,
  startDeployment,
  restartDeployment,
  deleteDeployment,
  setEditingDeployment,
  setShowEdit,
  refresh,
  activePage,
  deployments,
  // New handlers for enhanced operations
  onViewLogs,
  onExtendDuration,
  onViewDetails,
  onUpdateConfig,
  onSyncToChannel,
}) => {
  const columns = [
    {
      title: t('容器名称'),
      dataIndex: 'container_name',
      key: COLUMN_KEYS.container_name,
      width: 300,
      ellipsis: true,
      render: (text, record) => (
        <ContainerNameCell text={text} record={record} t={t} />
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: COLUMN_KEYS.status,
      width: 140,
      render: (status) => (
        <div className='flex items-center gap-2'>{renderStatus(status, t)}</div>
      ),
    },
    {
      title: t('服务商'),
      dataIndex: 'provider',
      key: COLUMN_KEYS.provider,
      width: 140,
      render: (provider) =>
        provider ? (
          <div className='inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary'>
            <FaGlobe className='text-[11px]' />
            <span>{provider}</span>
          </div>
        ) : (
          <span className='text-xs text-muted'>{t('暂无')}</span>
        ),
    },
    {
      title: t('剩余时间'),
      dataIndex: 'time_remaining',
      key: COLUMN_KEYS.time_remaining,
      width: 200,
      render: (text, record) => {
        const normalizedStatus = normalizeStatus(record?.status);
        const percentUsedRaw = parsePercentValue(record?.completed_percent);
        const percentUsed = clampPercent(percentUsedRaw);
        const percentRemaining =
          percentUsed === null ? null : clampPercent(100 - percentUsed);
        const theme = getRemainingTheme(percentRemaining);
        const statusDisplayMap = {
          completed: t('已完成'),
          destroyed: t('已销毁'),
          failed: t('失败'),
          error: t('失败'),
          stopped: t('已停止'),
          pending: t('待部署'),
          deploying: t('部署中'),
          'deployment requested': t('部署请求中'),
          'termination requested': t('终止中'),
        };
        const statusOverride = statusDisplayMap[normalizedStatus];
        const baseTimeDisplay =
          text && String(text).trim() !== '' ? text : t('计算中');
        const timeDisplay = baseTimeDisplay;
        const humanReadable = formatRemainingMinutes(
          record.compute_minutes_remaining,
          t,
        );
        const showProgress = !statusOverride && normalizedStatus === 'running';
        const showExtraInfo = Boolean(humanReadable || percentUsed !== null);
        const showRemainingMeta =
          record.compute_minutes_remaining !== undefined &&
          record.compute_minutes_remaining !== null &&
          percentRemaining !== null;

        return (
          <div className='flex flex-col gap-1 leading-tight text-xs'>
            <div className='flex items-center gap-1.5'>
              <FaHourglassHalf
                className='text-sm'
                style={{ color: theme.iconColor }}
              />
              <span className='text-sm font-medium text-foreground'>
                {timeDisplay}
              </span>
              {showProgress && percentRemaining !== null ? (
                <StatusChip tone={theme.tone}>{percentRemaining}%</StatusChip>
              ) : statusOverride ? (
                <StatusChip tone='grey'>{statusOverride}</StatusChip>
              ) : null}
            </div>
            {showExtraInfo && (
              <div className='flex items-center gap-3 text-muted'>
                {humanReadable && (
                  <span className='flex items-center gap-1'>
                    <FaClock className='text-[11px]' />
                    {t('约')} {humanReadable}
                  </span>
                )}
                {percentUsed !== null && (
                  <span className='flex items-center gap-1'>
                    <FaCheckCircle className='text-[11px]' />
                    {t('已用')} {percentUsed}%
                  </span>
                )}
              </div>
            )}
            {showProgress && showRemainingMeta && (
              <div className='text-[10px]' style={{ color: theme.textColor }}>
                {t('剩余')} {record.compute_minutes_remaining} {t('分钟')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('硬件配置'),
      dataIndex: 'hardware_info',
      key: COLUMN_KEYS.hardware_info,
      width: 220,
      ellipsis: true,
      render: (text, record) => (
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-1'>
            <FaServer className='text-success text-xs' />
            <span className='text-xs font-medium text-success'>
              {record.hardware_name}
            </span>
          </div>
          <span className='text-xs text-muted font-medium'>
            x{record.hardware_quantity}
          </span>
        </div>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      key: COLUMN_KEYS.created_at,
      width: 150,
      render: (text) => (
        <span className='text-sm text-muted tabular-nums'>
          {timestamp2string(text)}
        </span>
      ),
    },
    {
      title: t('操作'),
      key: COLUMN_KEYS.actions,
      fixed: 'right',
      width: 120,
      render: (_, record) => {
        const { status, id } = record;
        const normalizedStatus = normalizeStatus(status);
        const isEnded =
          normalizedStatus === 'completed' || normalizedStatus === 'destroyed';

        const handleDelete = () => {
          // Routes through the parent's confirm dialog (passed via
          // onUpdateConfig with the special 'delete' verb).
          onUpdateConfig?.(record, 'delete');
        };

        // Get primary action based on status — drives the leading button
        // before the "more" dropdown.
        const getPrimaryAction = () => {
          switch (normalizedStatus) {
            case 'running':
              return {
                icon: <FaInfoCircle className='text-xs' />,
                text: t('查看详情'),
                onPress: () => onViewDetails?.(record),
                variant: 'light',
              };
            case 'failed':
            case 'error':
              return {
                icon: <FaPlay className='text-xs' />,
                text: t('重试'),
                onPress: () => startDeployment(id),
                color: 'primary',
              };
            case 'stopped':
              return {
                icon: <FaPlay className='text-xs' />,
                text: t('启动'),
                onPress: () => startDeployment(id),
                color: 'primary',
              };
            case 'deployment requested':
            case 'deploying':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('部署中'),
                onPress: () => {},
                variant: 'flat',
                isDisabled: true,
              };
            case 'pending':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('待部署'),
                onPress: () => {},
                variant: 'flat',
                isDisabled: true,
              };
            case 'termination requested':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('终止中'),
                onPress: () => {},
                variant: 'flat',
                isDisabled: true,
              };
            case 'completed':
            case 'destroyed':
            default:
              return {
                icon: <FaInfoCircle className='text-xs' />,
                text: t('已结束'),
                onPress: () => {},
                variant: 'light',
                isDisabled: true,
              };
          }
        };

        const primaryAction = getPrimaryAction();

        if (isEnded) {
          return (
            <div className='flex w-full items-center justify-start gap-1 pr-2'>
              <Button
                size='sm'
                variant='tertiary'
                onPress={() => onViewDetails?.(record)}
                startContent={<FaInfoCircle className='text-xs' />}
              >
                {t('查看详情')}
              </Button>
            </div>
          );
        }

        // Build the dropdown items array. Mirrors the original Dropdown.Menu
        // ordering: details → logs (if active) → management actions →
        // config actions → destructive action, with dividers between groups.
        const items = [
          {
            label: t('查看详情'),
            icon: <FaInfoCircle />,
            onClick: () => onViewDetails?.(record),
          },
        ];

        if (!isEnded) {
          items.push({
            label: t('查看日志'),
            icon: <FaTerminal />,
            onClick: () => onViewLogs?.(record),
          });
        }

        const managementItems = [];
        if (normalizedStatus === 'running' && onSyncToChannel) {
          managementItems.push({
            label: t('同步到渠道'),
            icon: <FaLink />,
            onClick: () => onSyncToChannel(record),
          });
        }
        if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
          managementItems.push({
            label: t('重试'),
            icon: <FaPlay />,
            onClick: () => startDeployment(id),
          });
        }
        if (normalizedStatus === 'stopped') {
          managementItems.push({
            label: t('启动'),
            icon: <FaPlay />,
            onClick: () => startDeployment(id),
          });
        }
        if (managementItems.length > 0) {
          items.push({ divider: true });
          items.push(...managementItems);
        }

        const configItems = [];
        if (
          !isEnded &&
          (normalizedStatus === 'running' ||
            normalizedStatus === 'deployment requested')
        ) {
          configItems.push({
            label: t('延长时长'),
            icon: <FaPlus />,
            onClick: () => onExtendDuration?.(record),
          });
        }
        if (configItems.length > 0) {
          items.push({ divider: true });
          items.push(...configItems);
        }

        if (!isEnded) {
          items.push({ divider: true });
          items.push({
            label: t('销毁容器'),
            icon: <FaTrash />,
            danger: true,
            onClick: handleDelete,
          });
        }

        return (
          <div className='flex w-full items-center justify-start gap-1 pr-2'>
            <Button
              size='sm'
              variant={primaryAction.variant || 'solid'}
              color={primaryAction.color}
              startContent={primaryAction.icon}
              onPress={primaryAction.onPress}
              isDisabled={primaryAction.isDisabled}
              className='px-2 text-xs'
            >
              {primaryAction.text}
            </Button>

            {items.length > 0 && (
              <ClickMenu
                items={items}
                trigger={
                  <Button
                    isIconOnly
                    size='sm'
                    variant='tertiary'
                    aria-label={t('更多操作')}
                    className='px-1'
                  >
                    <MoreVertical size={14} />
                  </Button>
                }
              />
            )}
          </div>
        );
      },
    },
  ];

  return columns;
};
