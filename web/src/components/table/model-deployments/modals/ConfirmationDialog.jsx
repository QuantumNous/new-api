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

import React, { useState, useRef } from 'react';
import {
  Modal,
  Typography,
  Input,
  Banner,
  Checkbox,
  Space,
  Divider,
  Card,
} from '@douyinfe/semi-ui';
import { 
  FaExclamationTriangle,
  FaTrash,
  FaStop,
  FaSkull
} from 'react-icons/fa';

const { Text, Title } = Typography;

const ConfirmationDialog = ({
  visible,
  onCancel,
  onConfirm,
  title,
  type = 'danger', // 'danger', 'warning'
  deployment,
  operation,
  t,
  loading = false
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [doubleConfirmed, setDoubleConfirmed] = useState(false);
  
  const requiredText = deployment?.container_name || deployment?.id || '';
  const isConfirmed = confirmText === requiredText && acknowledged && (type !== 'danger' || doubleConfirmed);

  const handleCancel = () => {
    setConfirmText('');
    setAcknowledged(false);
    setDoubleConfirmed(false);
    onCancel();
  };

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
      handleCancel();
    }
  };

  const getOperationConfig = () => {
    const configs = {
      delete: {
        icon: <FaTrash className="text-red-500" />,
        title: t('删除容器'),
        description: t('此操作将永久删除容器及其所有数据，无法恢复。'),
        consequences: [
          t('容器将被立即终止'),
          t('所有容器数据将被永久删除'),
          t('无法恢复已删除的容器'),
          t('相关费用将按实际使用时间结算')
        ],
        dangerText: t('我明确了解删除操作的严重后果')
      },
      stop: {
        icon: <FaStop className="text-orange-500" />,
        title: t('停止容器'),
        description: t('此操作将停止正在运行的容器。'),
        consequences: [
          t('容器将被立即停止'),
          t('正在进行的任务可能会中断'),
          t('可以稍后重新启动容器'),
          t('费用计算将暂停')
        ],
        dangerText: t('我确认要停止此容器')
      },
      destroy: {
        icon: <FaSkull className="text-red-600" />,
        title: t('销毁容器'),
        description: t('此操作将永久销毁容器，这是一个不可逆的操作！'),
        consequences: [
          t('容器及其所有资源将被永久销毁'),
          t('所有数据将被不可逆地删除'),
          t('运行中的任务将被强制终止'),
          t('剩余时间费用将按政策处理')
        ],
        dangerText: t('我完全理解销毁操作的不可逆性')
      }
    };

    return configs[operation] || configs.delete;
  };

  const config = getOperationConfig();

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          {config.icon}
          <span>{config.title}</span>
        </div>
      }
      visible={visible}
      onCancel={handleCancel}
      onOk={handleConfirm}
      okText={t('确认执行')}
      cancelText={t('取消')}
      okButtonProps={{
        disabled: !isConfirmed,
        type: type === 'danger' ? 'danger' : 'warning',
        loading: loading
      }}
      width={600}
      className="confirmation-dialog"
    >
      <div className="space-y-4">
        {/* Container Info */}
        <Card className="border-0 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <Text strong className="text-base">
                {deployment?.container_name}
              </Text>
              <div className="mt-1">
                <Text type="secondary" size="small">
                  ID: {deployment?.id}
                </Text>
              </div>
            </div>
            <div className="text-right">
              <Text size="small" type="secondary">
                {t('状态')}: {deployment?.status}
              </Text>
              <div className="mt-1">
                <Text size="small" type="secondary">
                  {t('剩余时间')}: {deployment?.time_remaining}
                </Text>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Warning */}
        <Banner
          type={type}
          icon={<FaExclamationTriangle />}
          title={t('危险操作警告')}
          description={config.description}
        />

        {/* Consequences List */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <Text strong className="block mb-3 text-red-800">
            {t('此操作将导致以下后果')}:
          </Text>
          <ul className="space-y-2">
            {config.consequences.map((consequence, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{consequence}</span>
              </li>
            ))}
          </ul>
        </div>

        <Divider />

        {/* Confirmation Steps */}
        <div className="space-y-4">
          <div>
            <Text strong className="block mb-2">
              {t('步骤 1: 输入容器名称确认')}
            </Text>
            <Text size="small" type="secondary" className="block mb-2">
              {t('请输入容器名称')} <Text code>{requiredText}</Text> {t('来确认操作')}:
            </Text>
            <Input
              value={confirmText}
              onChange={setConfirmText}
              placeholder={t('输入容器名称确认')}
              style={{ 
                borderColor: confirmText === requiredText ? '#52c41a' : undefined 
              }}
            />
            {confirmText && confirmText !== requiredText && (
              <Text type="danger" size="small" className="block mt-1">
                {t('名称不匹配，请重新输入')}
              </Text>
            )}
          </div>

          <div>
            <Text strong className="block mb-2">
              {t('步骤 2: 确认理解后果')}
            </Text>
            <Checkbox
              checked={acknowledged}
              onChange={setAcknowledged}
            >
              <Text size="small">
                {t('我已阅读并理解上述操作后果')}
              </Text>
            </Checkbox>
          </div>

          {type === 'danger' && (
            <div>
              <Text strong className="block mb-2">
                {t('步骤 3: 最终确认 (危险操作)')}
              </Text>
              <Checkbox
                checked={doubleConfirmed}
                onChange={setDoubleConfirmed}
                disabled={!acknowledged}
              >
                <Text size="small" className="text-red-700">
                  {config.dangerText}
                </Text>
              </Checkbox>
            </div>
          )}
        </div>

        {/* Final Warning */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <FaExclamationTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <Text strong className="text-yellow-800 block">
                {t('最后提醒')}
              </Text>
              <Text size="small" className="text-yellow-700">
                {operation === 'delete' || operation === 'destroy' 
                  ? t('此操作执行后无法撤销，请三思而后行。如有疑问，请联系技术支持。')
                  : t('请确保当前没有重要任务正在运行，避免数据丢失。')
                }
              </Text>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-2 pt-2">
          <div className={`w-3 h-3 rounded-full ${
            confirmText === requiredText ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <div className={`w-3 h-3 rounded-full ${
            acknowledged ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          {type === 'danger' && (
            <div className={`w-3 h-3 rounded-full ${
              doubleConfirmed ? 'bg-green-500' : 'bg-gray-300'
            }`} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationDialog;