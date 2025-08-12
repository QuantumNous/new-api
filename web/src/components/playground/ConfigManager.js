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

import React, { useRef } from 'react';
import {
  Button,
  Typography,
  Toast,
  Modal,
  Dropdown,
} from '@douyinfe/semi-ui';
import {
  Download,
  Upload,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportConfig, importConfig, clearConfig, hasStoredConfig, getConfigTimestamp } from './configStorage';

const ConfigManager = ({
  currentConfig,
  onConfigImport,
  onConfigReset,
  styleState,
  messages,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleExport = () => {
    try {
      // 在导出前先保存当前配置，确保导出的是最新内容
      const configWithTimestamp = {
        ...currentConfig,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('playground_config', JSON.stringify(configWithTimestamp));

      exportConfig(currentConfig, messages);
      Toast.success({
        content: t('配置已导出到下载文件夹'),
        duration: 3,
      });
    } catch (error) {
      Toast.error({
        content: t('导出配置失败: ') + error.message,
        duration: 3,
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const importedConfig = await importConfig(file);

      Modal.confirm({
        title: t('确认导入配置'),
        content: t('导入的配置将覆盖当前设置，是否继续？'),
        okText: t('确定导入'),
        cancelText: t('取消'),
        onOk: () => {
          onConfigImport(importedConfig);
          Toast.success({
            content: t('配置导入成功'),
            duration: 3,
          });
        },
      });
    } catch (error) {
      Toast.error({
        content: t('导入配置失败: ') + error.message,
        duration: 3,
      });
    } finally {
      // 重置文件输入，允许重复选择同一文件
      event.target.value = '';
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: t('重置配置'),
      content: t('将清除所有保存的配置并恢复默认设置，此操作不可撤销。是否继续？'),
      okText: t('确定重置'),
      cancelText: t('取消'),
      okButtonProps: {
        type: 'danger',
      },
      onOk: () => {
        // 询问是否同时重置消息
        Modal.confirm({
          title: t('重置选项'),
          content: t('是否同时重置对话消息？选择"是"将清空所有对话记录并恢复默认示例；选择"否"将保留当前对话记录。'),
          okText: t('同时重置消息'),
          cancelText: t('仅重置配置'),
          okButtonProps: {
            type: 'danger',
          },
          onOk: () => {
            clearConfig();
            onConfigReset({ resetMessages: true });
            Toast.success({
              content: t('配置和消息已全部重置'),
              duration: 3,
            });
          },
          onCancel: () => {
            clearConfig();
            onConfigReset({ resetMessages: false });
            Toast.success({
              content: t('配置已重置，对话消息已保留'),
              duration: 3,
            });
          },
        });
      },
    });
  };

  const getConfigStatus = () => {
    if (hasStoredConfig()) {
      const timestamp = getConfigTimestamp();
      if (timestamp) {
        const date = new Date(timestamp);
        return t('上次保存: ') + date.toLocaleString();
      }
      return t('已有保存的配置');
    }
    return t('暂无保存的配置');
  };

  const dropdownItems = [
    {
      node: 'item',
      name: 'export',
      onClick: handleExport,
      children: (
        <div className="flex items-center gap-2">
          <Download size={14} />
          {t('导出配置')}
        </div>
      ),
    },
    {
      node: 'item',
      name: 'import',
      onClick: handleImportClick,
      children: (
        <div className="flex items-center gap-2">
          <Upload size={14} />
          {t('导入配置')}
        </div>
      ),
    },
    {
      node: 'divider',
    },
    {
      node: 'item',
      name: 'reset',
      onClick: handleReset,
      children: (
        <div className="flex items-center gap-2 text-red-600">
          <RotateCcw size={14} />
          {t('重置配置')}
        </div>
      ),
    },
  ];

  if (styleState.isMobile) {
    // 移动端显示简化的下拉菜单
    return (
      <>
        <Dropdown
          trigger="click"
          position="bottomLeft"
          showTick
          menu={dropdownItems}
        >
          <Button
            icon={<Settings2 size={14} />}
            theme="borderless"
            type="tertiary"
            size="small"
            className="!rounded-lg !text-gray-600 hover:!text-blue-600 hover:!bg-blue-50"
          />
        </Dropdown>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </>
    );
  }

  // 桌面端显示紧凑的按钮组
  return (
    <div className="space-y-3">
      {/* 配置状态信息和重置按钮 */}
      <div className="flex items-center justify-between">
        <Typography.Text className="text-xs text-gray-500">
          {getConfigStatus()}
        </Typography.Text>
        <Button
          icon={<RotateCcw size={12} />}
          size="small"
          theme="borderless"
          type="danger"
          onClick={handleReset}
          className="!rounded-full !text-xs !px-2"
        />
      </div>

      {/* 导出和导入按钮 */}
      <div className="flex gap-2">
        <Button
          icon={<Download size={12} />}
          size="small"
          theme="solid"
          type="primary"
          onClick={handleExport}
          className="!rounded-lg flex-1 !text-xs !h-7"
        >
          {t('导出')}
        </Button>

        <Button
          icon={<Upload size={12} />}
          size="small"
          theme="outline"
          type="primary"
          onClick={handleImportClick}
          className="!rounded-lg flex-1 !text-xs !h-7"
        >
          {t('导入')}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ConfigManager; 