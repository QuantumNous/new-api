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

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Checkbox,
  Button,
  Space,
  Typography,
  Divider,
} from '@douyinfe/semi-ui';
import { Settings, Eye, EyeOff } from 'lucide-react';

const { Text, Title } = Typography;

const ColumnSelectorModal = ({
  visible,
  onCancel,
  visibleColumns,
  onVisibleColumnsChange,
  columnKeys,
  t,
}) => {
  const [tempVisibleColumns, setTempVisibleColumns] = useState({});

  // Column labels mapping
  const columnLabels = {
    [columnKeys.deployment_name]: t('部署名称'),
    [columnKeys.model_name]: t('模型名称'),
    [columnKeys.status]: t('状态'),
    [columnKeys.instance_count]: t('实例数量'),
    [columnKeys.resource_config]: t('资源配置'),
    [columnKeys.created_at]: t('创建时间'),
    [columnKeys.updated_at]: t('更新时间'),
    [columnKeys.actions]: t('操作'),
  };

  // Always visible columns (cannot be hidden)
  const alwaysVisible = [columnKeys.deployment_name, columnKeys.actions];

  // Initialize temp state when modal opens
  useEffect(() => {
    if (visible) {
      setTempVisibleColumns({ ...visibleColumns });
    }
  }, [visible, visibleColumns]);

  const handleColumnToggle = (columnKey, checked) => {
    setTempVisibleColumns(prev => ({
      ...prev,
      [columnKey]: checked,
    }));
  };

  const handleSelectAll = () => {
    const allVisible = {};
    Object.keys(columnKeys).forEach(key => {
      allVisible[columnKeys[key]] = true;
    });
    setTempVisibleColumns(allVisible);
  };

  const handleDeselectAll = () => {
    const minimalVisible = {};
    Object.keys(columnKeys).forEach(key => {
      minimalVisible[columnKeys[key]] = alwaysVisible.includes(columnKeys[key]);
    });
    setTempVisibleColumns(minimalVisible);
  };

  const handleReset = () => {
    // Reset to default visibility
    const defaultVisible = {
      [columnKeys.deployment_name]: true,
      [columnKeys.model_name]: true,
      [columnKeys.status]: true,
      [columnKeys.instance_count]: true,
      [columnKeys.resource_config]: true,
      [columnKeys.created_at]: true,
      [columnKeys.updated_at]: true,
      [columnKeys.actions]: true,
    };
    setTempVisibleColumns(defaultVisible);
  };

  const handleConfirm = () => {
    onVisibleColumnsChange(tempVisibleColumns);
    onCancel();
  };

  const handleCancel = () => {
    setTempVisibleColumns({ ...visibleColumns });
    onCancel();
  };

  const visibleCount = Object.values(tempVisibleColumns).filter(Boolean).length;
  const totalCount = Object.keys(columnKeys).length;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Settings size={20} />
          <span>{t('列显示设置')}</span>
        </div>
      }
      visible={visible}
      onCancel={handleCancel}
      footer={
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button size="small" onClick={handleSelectAll}>
              <Eye size={14} className="mr-1" />
              {t('全选')}
            </Button>
            <Button size="small" onClick={handleDeselectAll}>
              <EyeOff size={14} className="mr-1" />
              {t('全不选')}
            </Button>
            <Button size="small" onClick={handleReset}>
              {t('重置')}
            </Button>
          </div>
          <Space>
            <Button onClick={handleCancel}>
              {t('取消')}
            </Button>
            <Button theme="solid" type="primary" onClick={handleConfirm}>
              {t('确定')}
            </Button>
          </Space>
        </div>
      }
      width={400}
    >
      <div className="py-2">
        <div className="mb-4">
          <Text type="secondary">
            {t('已选择')} {visibleCount} / {totalCount} {t('列')}
          </Text>
        </div>
        
        <Divider margin="12px" />
        
        <div className="space-y-3">
          {Object.keys(columnKeys).map(key => {
            const columnKey = columnKeys[key];
            const isAlwaysVisible = alwaysVisible.includes(columnKey);
            const isChecked = tempVisibleColumns[columnKey];
            
            return (
              <div
                key={columnKey}
                className={`flex items-center justify-between p-2 rounded hover:bg-gray-50 ${
                  isAlwaysVisible ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isChecked}
                    disabled={isAlwaysVisible}
                    onChange={(checked) => handleColumnToggle(columnKey, checked)}
                  />
                  <Text>{columnLabels[columnKey] || key}</Text>
                </div>
                {isAlwaysVisible && (
                  <Text type="tertiary" size="small">
                    {t('必选')}
                  </Text>
                )}
              </div>
            );
          })}
        </div>

        <Divider margin="12px" />
        
        <Text type="secondary" size="small">
          {t('注意：部署名称和操作列为必选列，无法隐藏。')}
        </Text>
      </div>
    </Modal>
  );
};

export default ColumnSelectorModal;