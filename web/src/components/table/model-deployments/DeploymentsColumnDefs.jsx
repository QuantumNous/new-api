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
  Space,
  SplitButtonGroup,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
  Input,
} from '@douyinfe/semi-ui';
import {
  timestamp2string,
  showSuccess,
  showError,
} from '../../../helpers';
import { IconTreeTriangleDown, IconMore } from '@douyinfe/semi-icons';
import { 
  FaPlay, 
  FaStop, 
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
  FaInfoCircle
} from 'react-icons/fa';

// Status color mapping with enhanced styling and icons
const getStatusConfig = (status) => {
  const statusConfig = {
    'running': { 
      color: 'green', 
      bgColor: 'bg-green-50', 
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      label: '运行中',
      icon: <FaCheckCircle className="text-green-500" />
    },
    'completed': { 
      color: 'green', 
      bgColor: 'bg-green-50', 
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      label: '已完成',
      icon: <FaCheckCircle className="text-green-600" />
    },
    'deployment requested': {
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200', 
      label: '部署请求中',
      icon: <FaSpinner className="text-blue-500 animate-spin" />
    },
    'termination requested': {
      color: 'orange',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
      label: '终止请求中', 
      icon: <FaClock className="text-orange-500" />
    },
    'destroyed': { 
      color: 'red', 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      label: '已销毁',
      icon: <FaBan className="text-red-500" />
    },
    'failed': { 
      color: 'red', 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      label: '失败',
      icon: <FaExclamationCircle className="text-red-500" />
    }
  };
  return statusConfig[status] || {
    color: 'grey',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    label: status,
    icon: <FaClock className="text-gray-500" />
  };
};

// Render deployment status with enhanced styling
const renderStatus = (status, t) => {
  const config = getStatusConfig(status);
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.borderColor}`}>
      <span className="flex items-center justify-center">{config.icon}</span>
      <span className={`text-xs font-medium ${config.textColor}`}>
        {t(config.label)}
      </span>
    </div>
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
  const { status } = record;
  let countColor = 'grey';
  
  if (status === 'running') countColor = 'green';
  else if (status === 'deployment requested') countColor = 'blue';
  else if (status === 'failed') countColor = 'red';
  
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
  stopDeployment,
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
      title: t('类型'),
      dataIndex: 'type',
      key: COLUMN_KEYS.type,
      width: 100,
      render: (text) => (
        <Typography.Text className="text-sm">{text || 'Container'}</Typography.Text>
      ),
    },
    {
      title: t('剩余时间'),
      dataIndex: 'time_remaining',
      key: COLUMN_KEYS.time_remaining,
      width: 130,
      render: (text, record) => (
        <div className="flex flex-col">
          <Typography.Text className="text-sm font-medium">{text}</Typography.Text>
          <Typography.Text type="secondary" size="small" className="text-xs">
            {record.completed_percent}% 完成
          </Typography.Text>
        </div>
      ),
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

        const handleDelete = () => {
          // Use enhanced confirmation dialog
          onUpdateConfig?.(record, 'delete');
        };

        // Get primary action based on status
        const getPrimaryAction = () => {
          switch (status) {
            case 'failed':
              return {
                icon: <FaPlay className="text-xs" />,
                text: t('重试'),
                onClick: () => startDeployment(id),
                type: 'primary',
                theme: 'solid'
              };
            case 'running':
              return {
                icon: <FaStop className="text-xs" />,
                text: t('停止'),
                onClick: () => stopDeployment(id),
                type: 'warning',
                theme: 'solid'
              };
            case 'deployment requested':
              return {
                icon: <FaClock className="text-xs" />,
                text: t('部署中'),
                onClick: () => {},
                type: 'secondary',
                theme: 'outline',
                disabled: true
              };
            case 'termination requested':
              return {
                icon: <FaClock className="text-xs" />,
                text: t('终止中'),
                onClick: () => {},
                type: 'secondary', 
                theme: 'outline',
                disabled: true
              };
            case 'completed':
            case 'destroyed':
            default:
              return {
                icon: <FaRedo className="text-xs" />,
                text: t('重启'),
                onClick: () => restartDeployment(id),
                type: 'secondary',
                theme: 'outline'
              };
          }
        };

        const primaryAction = getPrimaryAction();
        
        // All actions dropdown with enhanced operations
        const allActions = (
          <Dropdown.Menu>
            {/* View Actions */}
            <Dropdown.Item onClick={() => onViewDetails?.(record)} icon={<FaInfoCircle />}>
              {t('查看详情')}
            </Dropdown.Item>
            <Dropdown.Item onClick={() => onViewLogs?.(record)} icon={<FaTerminal />}>
              {t('查看日志')}
            </Dropdown.Item>
            
            <Dropdown.Divider />
            
            {/* Management Actions */}
            {(status === 'running' || status === 'failed' || status === 'completed') && (
              <Dropdown.Item onClick={() => restartDeployment(id)} icon={<FaRedo />}>
                {t('重启')}
              </Dropdown.Item>
            )}
            {status === 'failed' && (
              <Dropdown.Item onClick={() => startDeployment(id)} icon={<FaPlay />}>
                {t('重试')}
              </Dropdown.Item>
            )}
            {status === 'running' && (
              <Dropdown.Item onClick={() => stopDeployment(id)} icon={<FaStop />}>
                {t('停止')}
              </Dropdown.Item>
            )}
            
            <Dropdown.Divider />
            
            {/* Configuration Actions */}
            {(status === 'running' || status === 'deployment requested') && (
              <Dropdown.Item onClick={() => onExtendDuration?.(record)} icon={<FaPlus />}>
                {t('延长时长')}
              </Dropdown.Item>
            )}
            {status === 'running' && (
              <Dropdown.Item onClick={() => onUpdateConfig?.(record)} icon={<FaCog />}>
                {t('更新配置')}
              </Dropdown.Item>
            )}
            
            <Dropdown.Divider />
            
            {/* Dangerous Actions */}
            <Dropdown.Item
              type="danger"
              onClick={handleDelete}
              icon={<FaTrash />}
            >
              {t('销毁容器')}
            </Dropdown.Item>
          </Dropdown.Menu>
        );

        return (
          <div className="flex items-center gap-1">
            <Button
              size="small"
              theme={primaryAction.theme}
              type={primaryAction.type}
              icon={primaryAction.icon}
              onClick={primaryAction.onClick}
              className="px-2 text-xs"
              disabled={primaryAction.disabled}
            >
              {primaryAction.text}
            </Button>
            
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={allActions}
            >
              <Button
                size="small"
                theme="outline"
                type="secondary"
                icon={<IconMore />}
                className="px-1"
              />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return columns;
};