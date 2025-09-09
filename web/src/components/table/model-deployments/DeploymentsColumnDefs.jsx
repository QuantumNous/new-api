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
  FaMicrochip 
} from 'react-icons/fa';

// Status color mapping
const getStatusColor = (status) => {
  const statusColors = {
    'running': 'green',
    'deploying': 'blue',
    'stopped': 'grey',
    'error': 'red',
    'pending': 'orange',
  };
  return statusColors[status] || 'grey';
};

// Render deployment status
const renderStatus = (status, t) => {
  const statusLabels = {
    'running': t('运行中'),
    'deploying': t('部署中'),
    'stopped': t('已停止'),
    'error': t('错误'),
    'pending': t('待部署'),
  };
  
  return (
    <Tag color={getStatusColor(status)} size="small">
      {statusLabels[status] || status}
    </Tag>
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
  else if (status === 'deploying') countColor = 'blue';
  else if (status === 'error') countColor = 'red';
  
  return (
    <Tag color={countColor} size="small">
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
  setEditingDeployment,
  setShowEdit,
  refresh,
  activePage,
  deployments,
}) => {
  const columns = [
    {
      title: t('部署名称'),
      dataIndex: 'deployment_name',
      key: COLUMN_KEYS.deployment_name,
      fixed: 'left',
      width: 180,
      render: (text, record) => (
        <div className="flex flex-col">
          <Typography.Text strong copyable={{ content: text }}>
            {text}
          </Typography.Text>
          <Typography.Text type="secondary" size="small">
            ID: {record.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      key: COLUMN_KEYS.model_name,
      width: 200,
      render: (text, record) => (
        <div className="flex flex-col">
          <Typography.Text strong>{text}</Typography.Text>
          {record.model_version && (
            <Typography.Text type="secondary" size="small">
              版本: {record.model_version}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: COLUMN_KEYS.status,
      width: 100,
      render: (status) => renderStatus(status, t),
    },
    {
      title: t('实例数量'),
      dataIndex: 'instance_count',
      key: COLUMN_KEYS.instance_count,
      width: 120,
      render: (count, record) => renderInstanceCount(count, record, t),
    },
    {
      title: t('资源配置'),
      dataIndex: 'resource_config',
      key: COLUMN_KEYS.resource_config,
      width: 160,
      render: (resource) => renderResourceConfig(resource, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      key: COLUMN_KEYS.created_at,
      width: 150,
      render: (text) => (
        <span>{timestamp2string(text)}</span>
      ),
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_at',
      key: COLUMN_KEYS.updated_at,
      width: 150,
      render: (text) => (
        <span>{timestamp2string(text)}</span>
      ),
    },
    {
      title: t('操作'),
      key: COLUMN_KEYS.actions,
      fixed: 'right',
      width: 200,
      render: (_, record) => {
        const { status, id } = record;
        
        // Handle deployment operations
        const handleStart = () => {
          startDeployment(id);
        };

        const handleStop = () => {
          stopDeployment(id);
        };

        const handleRestart = () => {
          restartDeployment(id);
        };

        const handleEdit = () => {
          setEditingDeployment(record);
          setShowEdit(true);
        };

        const handleDelete = () => {
          Modal.confirm({
            title: t('确认删除'),
            content: `${t('确定要删除部署')} "${record.deployment_name}" ${t('吗？此操作不可逆。')}`,
            okText: t('删除'),
            cancelText: t('取消'),
            okType: 'danger',
            onOk: () => {
              deleteDeployment(id);
            },
          });
        };

        // Action buttons based on status
        const getActionButtons = () => {
          const buttons = [];
          
          if (status === 'stopped' || status === 'error') {
            buttons.push(
              <Button
                key="start"
                theme="solid"
                type="primary"
                size="small"
                icon={<FaPlay />}
                onClick={handleStart}
              >
                {t('启动')}
              </Button>
            );
          }
          
          if (status === 'running' || status === 'deploying') {
            buttons.push(
              <Button
                key="stop"
                theme="solid"
                type="warning"
                size="small"
                icon={<FaStop />}
                onClick={handleStop}
              >
                {t('停止')}
              </Button>
            );
          }
          
          if (status === 'running' || status === 'error') {
            buttons.push(
              <Button
                key="restart"
                theme="outline"
                type="secondary"
                size="small"
                icon={<FaRedo />}
                onClick={handleRestart}
              >
                {t('重启')}
              </Button>
            );
          }
          
          return buttons;
        };

        const actionButtons = getActionButtons();
        
        // More actions dropdown
        const moreActions = (
          <Dropdown.Menu>
            <Dropdown.Item
              onClick={handleEdit}
              icon={<FaEdit />}
            >
              {t('编辑')}
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              type="danger"
              onClick={handleDelete}
              icon={<FaTrash />}
            >
              {t('删除')}
            </Dropdown.Item>
          </Dropdown.Menu>
        );

        return (
          <Space>
            {actionButtons.length > 0 && (
              <SplitButtonGroup>
                {actionButtons[0]}
                {actionButtons.length > 1 && (
                  <Dropdown
                    trigger="click"
                    position="bottomRight"
                    render={
                      <Dropdown.Menu>
                        {actionButtons.slice(1).map((button, idx) => (
                          <Dropdown.Item key={idx} onClick={button.props.onClick}>
                            {button.props.children}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    }
                  >
                    <Button
                      theme="solid"
                      type="primary"
                      icon={<IconTreeTriangleDown />}
                      size="small"
                    />
                  </Dropdown>
                )}
              </SplitButtonGroup>
            )}
            
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={moreActions}
            >
              <Button
                theme="outline"
                type="secondary"
                icon={<IconMore />}
                size="small"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return columns;
};