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
  Dropdown,
  Modal,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
  Input,
  Space
} from '@douyinfe/semi-ui';
import {
  timestamp2string,
  showSuccess,
  showError,
} from '../../../helpers';
import { IconTreeTriangleDown, IconMore } from '@douyinfe/semi-icons';
import {
  FaPlay,
  FaRedo,
  FaEdit,
  FaTrash,
  FaServer,
  FaMemory,
  FaMicrochip,
  FaCopy,
  FaCheckCircle,
  FaSpinner,
  FaClock,
  FaExclamationCircle,
  FaBan,
  FaEye,
  FaTerminal,
  FaPlus,
  FaCog,
  FaInfoCircle,
  FaLink, FaStop,
} from 'react-icons/fa';

const normalizeStatus = (status) =>
  typeof status === 'string' ? status.trim().toLowerCase() : '';

const STATUS_TAG_CONFIG = {
  running: {
    color: 'green',
    label: '运行中',
    icon: <FaPlay size={12} className='text-green-600' />,
  },
  deploying: {
    color: 'blue',
    label: '部署中',
    icon: <FaSpinner size={12} className='text-blue-600' />,
  },
  pending: {
    color: 'orange',
    label: '待部署',
    icon: <FaClock size={12} className='text-orange-600' />,
  },
  stopped: {
    color: 'grey',
    label: '已停止',
    icon: <FaStop size={12} className='text-gray-500' />,
  },
  error: {
    color: 'red',
    label: '错误',
    icon: <FaExclamationCircle size={12} className='text-red-500' />,
  },
  failed: {
    color: 'red',
    label: '失败',
    icon: <FaExclamationCircle size={12} className='text-red-500' />,
  },
  destroyed: {
    color: 'red',
    label: '已销毁',
    icon: <FaBan size={12} className='text-red-500' />,
  },
  completed: {
    color: 'green',
    label: '已完成',
    icon: <FaCheckCircle size={12} className='text-green-600' />,
  },
  'deployment requested': {
    color: 'blue',
    label: '部署请求中',
    icon: <FaSpinner size={12} className='text-blue-600' />,
  },
  'termination requested': {
    color: 'orange',
    label: '终止请求中',
    icon: <FaClock size={12} className='text-orange-600' />,
  },
};

const DEFAULT_STATUS_CONFIG = {
  color: 'grey',
  label: null,
  icon: <FaInfoCircle size={12} className='text-gray-500' />,
};

const renderStatus = (status, t) => {
  const normalizedStatus = normalizeStatus(status);
  const config = STATUS_TAG_CONFIG[normalizedStatus] || DEFAULT_STATUS_CONFIG;
  const statusText = typeof status === 'string' ? status : '';
  const labelText = config.label ? t(config.label) : statusText || t('未知状态');

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
const ContainerNameCell = ({ text, record, updateDeploymentName, t }) => {
  const [showRenameModal, setShowRenameModal] = React.useState(false);
  const [newName, setNewName] = React.useState(text);
  const [isRenaming, setIsRenaming] = React.useState(false);

  React.useEffect(() => {
    if (showRenameModal) {
      setNewName(text);
    }
  }, [showRenameModal, text]);

  const handleRename = async () => {
    if (newName.trim() === text || !newName.trim()) {
      setShowRenameModal(false);
      return;
    }
    
    setIsRenaming(true);
    const success = await updateDeploymentName(record.id, newName.trim());
    setIsRenaming(false);
    
    if (success) {
      setShowRenameModal(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(record.id);
    showSuccess(t('ID已复制到剪贴板'));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Typography.Text strong className="text-base">
          {text}
        </Typography.Text>
        <Button
          size="small"
          theme="borderless"
          icon={<FaEdit />}
          className="opacity-70 hover:opacity-100 transition-opacity"
          onClick={() => setShowRenameModal(true)}
          style={{ padding: '2px 4px', minWidth: 'auto' }}
        />
      </div>
      <div className="flex items-center">
        <Typography.Text 
          type="secondary" 
          size="small" 
          className="text-xs cursor-pointer hover:text-blue-600 transition-colors select-all"
          onClick={handleCopyId}
          title={t('点击复制ID')}
        >
          ID: {record.id}
        </Typography.Text>
      </div>
      
      <Modal
        title={t('重命名容器')}
        visible={showRenameModal}
        onOk={handleRename}
        onCancel={() => setShowRenameModal(false)}
        okText={t('确定')}
        cancelText={t('取消')}
        confirmLoading={isRenaming}
        width={400}
      >
        <div className="py-2">
          <Typography.Text type="secondary" size="small" className="block mb-2">
            {t('当前名称')}: {text}
          </Typography.Text>
          <Input
            value={newName}
            onChange={(value) => setNewName(value)}
            placeholder={t('请输入新的容器名称')}
            autoFocus
            onEnterPress={handleRename}
            className="w-full"
          />
        </div>
      </Modal>
    </div>
  );
};

// Render resource configuration
const renderResourceConfig = (resource, t) => {
  if (!resource) return '-';
  
  const { cpu, memory, gpu } = resource;
  
  return (
    <div className="flex flex-col gap-1">
      {cpu && (
        <div className="flex items-center gap-1 text-xs">
          <FaMicrochip className="text-blue-500" />
          <span>CPU: {cpu}</span>
        </div>
      )}
      {memory && (
        <div className="flex items-center gap-1 text-xs">
          <FaMemory className="text-green-500" />
          <span>内存: {memory}</span>
        </div>
      )}
      {gpu && (
        <div className="flex items-center gap-1 text-xs">
          <FaServer className="text-purple-500" />
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
    <Tag color={countColor} size="small" shape='circle'>
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
  updateDeploymentName,
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
        <ContainerNameCell 
          text={text} 
          record={record} 
          updateDeploymentName={updateDeploymentName}
          t={t}
        />
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: COLUMN_KEYS.status,
      width: 140,
      render: (status) => renderStatus(status, t),
    },
    {
      title: t('剩余时间'),
      dataIndex: 'time_remaining',
      key: COLUMN_KEYS.time_remaining,
      minWidth: 180,
      render: (text, record) => {
        const rawValue = record?.completed_percent;
        const parsed = typeof rawValue === 'string'
          ? parseFloat(rawValue.replace(/[^0-9.+-]/g, ''))
          : Number(rawValue ?? 0);
        const percentUsed = Number.isFinite(parsed)
          ? Math.min(100, Math.max(0, Math.round(parsed)))
          : null;
        const timeDisplay = text && String(text).trim() !== '' ? text : t('计算中');

        return (
          <div className="flex flex-col gap-1">
            <Typography.Text className="text-sm font-medium">
              {timeDisplay}
            </Typography.Text>
            <div className="flex flex-wrap items-center gap-1.5">
              {percentUsed !== null && (
                <Tag
                  size="small"
                  color={percentUsed > 80 ? 'red' : percentUsed > 50 ? 'orange' : 'green'}
                  className="text-xs"
                  style={{ padding: '2px 6px', lineHeight: '16px' }}
                >
                  {t('已用')} {percentUsed}%
                </Tag>
              )}
              {record.compute_minutes_remaining !== undefined && (
                <Tag
                  size="small"
                  type="light"
                  className="text-xs"
                  style={{ padding: '2px 6px', lineHeight: '16px' }}
                >
                  {t('剩余')} {record.compute_minutes_remaining} {t('分钟')}
                </Tag>
              )}
            </div>
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-md">
            <FaServer className="text-green-600 text-xs" />
            <span className="text-xs font-medium text-green-700">
              {record.hardware_name}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium">x{record.hardware_quantity}</span>
        </div>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      key: COLUMN_KEYS.created_at,
      width: 150,
      render: (text) => (
        <span className="text-sm text-gray-600">{timestamp2string(text)}</span>
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
        const isEnded = normalizedStatus === 'completed' || normalizedStatus === 'destroyed';

        const handleDelete = () => {
          // Use enhanced confirmation dialog
          onUpdateConfig?.(record, 'delete');
        };

        // Get primary action based on status
        const getPrimaryAction = () => {
          switch (normalizedStatus) {
            case 'running':
              return {
                icon: <FaRedo className="text-xs" />,
                text: t('重启'),
                onClick: () => restartDeployment(id),
                type: 'primary',
                theme: 'solid',
              };
            case 'failed':
            case 'error':
              return {
                icon: <FaPlay className="text-xs" />,
                text: t('重试'),
                onClick: () => startDeployment(id),
                type: 'primary',
                theme: 'solid',
              };
            case 'stopped':
              return {
                icon: <FaPlay className="text-xs" />,
                text: t('启动'),
                onClick: () => startDeployment(id),
                type: 'primary',
                theme: 'solid',
              };
            case 'deployment requested':
            case 'deploying':
              return {
                icon: <FaClock className="text-xs" />,
                text: t('部署中'),
                onClick: () => {},
                type: 'secondary',
                theme: 'light',
                disabled: true,
              };
            case 'pending':
              return {
                icon: <FaClock className="text-xs" />,
                text: t('待部署'),
                onClick: () => {},
                type: 'secondary',
                theme: 'light',
                disabled: true,
              };
            case 'termination requested':
              return {
                icon: <FaClock className="text-xs" />,
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
                icon: <FaInfoCircle className="text-xs" />,
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

        // All actions dropdown with enhanced operations
        const dropdownItems = [
          <Dropdown.Item key="details" onClick={() => onViewDetails?.(record)} icon={<FaInfoCircle />}>
            {t('查看详情')}
          </Dropdown.Item>,
        ];

        if (!isEnded) {
          dropdownItems.push(
            <Dropdown.Item key="logs" onClick={() => onViewLogs?.(record)} icon={<FaTerminal />}>
              {t('查看日志')}
            </Dropdown.Item>,
          );
        }

        const managementItems = [];
        if (normalizedStatus === 'running') {
          managementItems.push(
            <Dropdown.Item key="restart" onClick={() => restartDeployment(id)} icon={<FaRedo />}>
              {t('重启')}
            </Dropdown.Item>,
          );
          if (onSyncToChannel) {
            managementItems.push(
              <Dropdown.Item key="sync-channel" onClick={() => onSyncToChannel(record)} icon={<FaLink />}>
                {t('同步到渠道')}
              </Dropdown.Item>,
            );
          }
        }
        if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
          managementItems.push(
            <Dropdown.Item key="retry" onClick={() => startDeployment(id)} icon={<FaPlay />}>
              {t('重试')}
            </Dropdown.Item>,
          );
        }
        if (normalizedStatus === 'stopped') {
          managementItems.push(
            <Dropdown.Item key="start" onClick={() => startDeployment(id)} icon={<FaPlay />}>
              {t('启动')}
            </Dropdown.Item>,
          );
        }

        if (managementItems.length > 0) {
          dropdownItems.push(<Dropdown.Divider key="management-divider" />);
          dropdownItems.push(...managementItems);
        }

        const configItems = [];
        if (!isEnded && (normalizedStatus === 'running' || normalizedStatus === 'deployment requested')) {
          configItems.push(
            <Dropdown.Item key="extend" onClick={() => onExtendDuration?.(record)} icon={<FaPlus />}>
              {t('延长时长')}
            </Dropdown.Item>,
          );
        }
        if (!isEnded && normalizedStatus === 'running') {
          configItems.push(
            <Dropdown.Item key="update-config" onClick={() => onUpdateConfig?.(record)} icon={<FaCog />}>
              {t('更新配置')}
            </Dropdown.Item>,
          );
        }

        if (configItems.length > 0) {
          dropdownItems.push(<Dropdown.Divider key="config-divider" />);
          dropdownItems.push(...configItems);
        }
        if (!isEnded) {
          dropdownItems.push(<Dropdown.Divider key="danger-divider" />);
          dropdownItems.push(
            <Dropdown.Item key="delete" type="danger" onClick={handleDelete} icon={<FaTrash />}>
              {t('销毁容器')}
            </Dropdown.Item>,
          );
        }

        const allActions = <Dropdown.Menu>{dropdownItems}</Dropdown.Menu>;
        const hasDropdown = dropdownItems.length > 0;

        return (
          <div className="flex items-center gap-1">
            <Button
              size="small"
              theme={primaryTheme}
              type={primaryType}
              icon={primaryAction.icon}
              onClick={primaryAction.onClick}
              className="px-2 text-xs"
              disabled={primaryAction.disabled}
            >
              {primaryAction.text}
            </Button>
            
            {hasDropdown && (
              <Dropdown
                trigger="click"
                position="bottomRight"
                render={allActions}
              >
                <Button
                  size="small"
                  theme="light"
                  type="tertiary"
                  icon={<IconMore />}
                  className="px-1"
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
