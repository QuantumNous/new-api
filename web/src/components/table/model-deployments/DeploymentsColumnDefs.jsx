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
import { Button, Dropdown, Tag, Typography } from '@douyinfe/semi-ui';
import { timestamp2string, showSuccess, showError } from '../../../helpers';
import { IconMore } from '@douyinfe/semi-icons';
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
  FaCog,
  FaInfoCircle,
  FaLink,
  FaStop,
  FaHourglassHalf,
  FaGlobe,
} from 'react-icons/fa';

const normalizeStatus = (status) =>
  typeof status === 'string' ? status.trim().toLowerCase() : '';

const STATUS_TAG_CONFIG = {
  running: {
    color: 'green',
    labelKey: '运行中',
    icon: <FaPlay size={12} className='text-green-600' />,
  },
  deploying: {
    color: 'blue',
    labelKey: '部署中',
    icon: <FaSpinner size={12} className='text-blue-600' />,
  },
  pending: {
    color: 'orange',
    labelKey: '待部署',
    icon: <FaClock size={12} className='text-orange-600' />,
  },
  stopped: {
    color: 'grey',
    labelKey: '已停止',
    icon: <FaStop size={12} className='text-gray-500' />,
  },
  error: {
    color: 'red',
    labelKey: '错误',
    icon: <FaExclamationCircle size={12} className='text-red-500' />,
  },
  failed: {
    color: 'red',
    labelKey: '失败',
    icon: <FaExclamationCircle size={12} className='text-red-500' />,
  },
  destroyed: {
    color: 'red',
    labelKey: '已销毁',
    icon: <FaBan size={12} className='text-red-500' />,
  },
  completed: {
    color: 'green',
    labelKey: '已完成',
    icon: <FaCheckCircle size={12} className='text-green-600' />,
  },
  'deployment requested': {
    color: 'blue',
    labelKey: '部署请求中',
    icon: <FaSpinner size={12} className='text-blue-600' />,
  },
  'termination requested': {
    color: 'orange',
    labelKey: '终止请求中',
    icon: <FaClock size={12} className='text-orange-600' />,
  },
};

const DEFAULT_STATUS_CONFIG = {
  color: 'grey',
  labelKey: null,
  icon: <FaInfoCircle size={12} className='text-gray-500' />,
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

const getRemainingTheme = (percentRemaining) => {
  if (percentRemaining === null) {
    return {
      iconColor: 'var(--semi-color-primary)',
      tagColor: 'blue',
      textColor: 'var(--semi-color-text-2)',
    };
  }

  if (percentRemaining <= 10) {
    return {
      iconColor: '#ff5a5f',
      tagColor: 'red',
      textColor: '#ff5a5f',
    };
  }

  if (percentRemaining <= 30) {
    return {
      iconColor: '#ffb400',
      tagColor: 'orange',
      textColor: '#ffb400',
    };
  }

  return {
    iconColor: '#2ecc71',
    tagColor: 'green',
    textColor: '#2ecc71',
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
    <Tag
      color={config.color}
      shape='circle'
      size='small'
      prefixIcon={config.icon}
    >
      {labelText}
    </Tag>
  );
};

// Container Name Cell Component - to properly handle React hooks
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
      <Typography.Text strong className='text-base'>
        {text}
      </Typography.Text>
      <Typography.Text
        type='secondary'
        size='small'
        className='text-xs cursor-pointer hover:text-blue-600 transition-colors select-all'
        onClick={handleCopyId}
        title={t('点击复制ID')}
      >
        ID: {record.id}
      </Typography.Text>
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
          <FaMicrochip className='text-blue-500' />
          <span>CPU: {cpu}</span>
        </div>
      )}
      {memory && (
        <div className='flex items-center gap-1 text-xs'>
          <FaMemory className='text-green-500' />
          <span>内存: {memory}</span>
        </div>
      )}
      {gpu && (
        <div className='flex items-center gap-1 text-xs'>
          <FaServer className='text-purple-500' />
          <span>GPU: {gpu}</span>
        </div>
      )}
    </div>
  );
};

// Render instance count with status indicator
const renderInstanceCount = (count, record, t) => {
  const normalizedStatus = normalizeStatus(record?.status);
  const statusConfig = STATUS_TAG_CONFIG[normalizedStatus];
  const countColor = statusConfig?.color ?? 'grey';

  return (
    <Tag color={countColor} size='small' shape='circle'>
      {count || 0} {t('个实例')}
    </Tag>
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
          <div
            className='flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide'
            style={{
              borderColor: 'rgba(59, 130, 246, 0.4)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              color: '#2563eb',
            }}
          >
            <FaGlobe className='text-[11px]' />
            <span>{provider}</span>
          </div>
        ) : (
          <Typography.Text
            type='tertiary'
            size='small'
            className='text-xs text-gray-500'
          >
            {t('暂无')}
          </Typography.Text>
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
              <Typography.Text className='text-sm font-medium text-[var(--semi-color-text-0)]'>
                {timeDisplay}
              </Typography.Text>
              {showProgress && percentRemaining !== null ? (
                <Tag size='small' color={theme.tagColor}>
                  {percentRemaining}%
                </Tag>
              ) : statusOverride ? (
                <Tag size='small' color='grey'>
                  {statusOverride}
                </Tag>
              ) : null}
            </div>
            {showExtraInfo && (
              <div className='flex items-center gap-3 text-[var(--semi-color-text-2)]'>
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
          <div className='flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-md'>
            <FaServer className='text-green-600 text-xs' />
            <span className='text-xs font-medium text-green-700'>
              {record.hardware_name}
            </span>
          </div>
          <span className='text-xs text-gray-500 font-medium'>
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
        <span className='text-sm text-gray-600'>{timestamp2string(text)}</span>
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
          // Use enhanced confirmation dialog
          onUpdateConfig?.(record, 'delete');
        };

        // Get primary action based on status
        const getPrimaryAction = () => {
          switch (normalizedStatus) {
            case 'running':
              return {
                icon: <FaInfoCircle className='text-xs' />,
                text: t('查看详情'),
                onClick: () => onViewDetails?.(record),
                type: 'secondary',
                theme: 'borderless',
              };
            case 'failed':
            case 'error':
              return {
                icon: <FaPlay className='text-xs' />,
                text: t('重试'),
                onClick: () => startDeployment(id),
                type: 'primary',
                theme: 'solid',
              };
            case 'stopped':
              return {
                icon: <FaPlay className='text-xs' />,
                text: t('启动'),
                onClick: () => startDeployment(id),
                type: 'primary',
                theme: 'solid',
              };
            case 'deployment requested':
            case 'deploying':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('部署中'),
                onClick: () => {},
                type: 'secondary',
                theme: 'light',
                disabled: true,
              };
            case 'pending':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('待部署'),
                onClick: () => {},
                type: 'secondary',
                theme: 'light',
                disabled: true,
              };
            case 'termination requested':
              return {
                icon: <FaClock className='text-xs' />,
                text: t('终止中'),
                onClick: () => {},
                type: 'secondary',
                theme: 'light',
                disabled: true,
              };
            case 'completed':
            case 'destroyed':
            default:
              return {
                icon: <FaInfoCircle className='text-xs' />,
                text: t('已结束'),
                onClick: () => {},
                type: 'tertiary',
                theme: 'borderless',
                disabled: true,
              };
          }
        };

        const primaryAction = getPrimaryAction();
        const primaryTheme = primaryAction.theme || 'solid';
        const primaryType = primaryAction.type || 'primary';

        if (isEnded) {
          return (
            <div className='flex w-full items-center justify-start gap-1 pr-2'>
              <Button
                size='small'
                type='tertiary'
                theme='borderless'
                onClick={() => onViewDetails?.(record)}
                icon={<FaInfoCircle className='text-xs' />}
              >
                {t('查看详情')}
              </Button>
            </div>
          );
        }

        // All actions dropdown with enhanced operations
        const dropdownItems = [
          <Dropdown.Item
            key='details'
            onClick={() => onViewDetails?.(record)}
            icon={<FaInfoCircle />}
          >
            {t('查看详情')}
          </Dropdown.Item>,
        ];

        if (!isEnded) {
          dropdownItems.push(
            <Dropdown.Item
              key='logs'
              onClick={() => onViewLogs?.(record)}
              icon={<FaTerminal />}
            >
              {t('查看日志')}
            </Dropdown.Item>,
          );
        }

        const managementItems = [];
        if (normalizedStatus === 'running') {
          if (onSyncToChannel) {
            managementItems.push(
              <Dropdown.Item
                key='sync-channel'
                onClick={() => onSyncToChannel(record)}
                icon={<FaLink />}
              >
                {t('同步到渠道')}
              </Dropdown.Item>,
            );
          }
        }
        if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
          managementItems.push(
            <Dropdown.Item
              key='retry'
              onClick={() => startDeployment(id)}
              icon={<FaPlay />}
            >
              {t('重试')}
            </Dropdown.Item>,
          );
        }
        if (normalizedStatus === 'stopped') {
          managementItems.push(
            <Dropdown.Item
              key='start'
              onClick={() => startDeployment(id)}
              icon={<FaPlay />}
            >
              {t('启动')}
            </Dropdown.Item>,
          );
        }

        if (managementItems.length > 0) {
          dropdownItems.push(<Dropdown.Divider key='management-divider' />);
          dropdownItems.push(...managementItems);
        }

        const configItems = [];
        if (
          !isEnded &&
          (normalizedStatus === 'running' ||
            normalizedStatus === 'deployment requested')
        ) {
          configItems.push(
            <Dropdown.Item
              key='extend'
              onClick={() => onExtendDuration?.(record)}
              icon={<FaPlus />}
            >
              {t('延长时长')}
            </Dropdown.Item>,
          );
        }
        // if (!isEnded && normalizedStatus === 'running') {
        //   configItems.push(
        //     <Dropdown.Item key="update-config" onClick={() => onUpdateConfig?.(record)} icon={<FaCog />}>
        //       {t('更新配置')}
        //     </Dropdown.Item>,
        //   );
        // }

        if (configItems.length > 0) {
          dropdownItems.push(<Dropdown.Divider key='config-divider' />);
          dropdownItems.push(...configItems);
        }
        if (!isEnded) {
          dropdownItems.push(<Dropdown.Divider key='danger-divider' />);
          dropdownItems.push(
            <Dropdown.Item
              key='delete'
              type='danger'
              onClick={handleDelete}
              icon={<FaTrash />}
            >
              {t('销毁容器')}
            </Dropdown.Item>,
          );
        }

        const allActions = <Dropdown.Menu>{dropdownItems}</Dropdown.Menu>;
        const hasDropdown = dropdownItems.length > 0;

        return (
          <div className='flex w-full items-center justify-start gap-1 pr-2'>
            <Button
              size='small'
              theme={primaryTheme}
              type={primaryType}
              icon={primaryAction.icon}
              onClick={primaryAction.onClick}
              className='px-2 text-xs'
              disabled={primaryAction.disabled}
            >
              {primaryAction.text}
            </Button>

            {hasDropdown && (
              <Dropdown
                trigger='click'
                position='bottomRight'
                render={allActions}
              >
                <Button
                  size='small'
                  theme='light'
                  type='tertiary'
                  icon={<IconMore />}
                  className='px-1'
                />
              </Dropdown>
            )}
          </div>
        );
      },
    },
  ];

  return columns;
};
