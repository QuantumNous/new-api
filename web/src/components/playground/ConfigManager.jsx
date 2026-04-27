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
import { Button } from '@heroui/react';
import { Download, Upload, RotateCcw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { showError, showSuccess } from '../../helpers';
import {
  exportConfig,
  importConfig,
  clearConfig,
  hasStoredConfig,
  getConfigTimestamp,
} from './configStorage';

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
      // Persist the current config before exporting so the file is up to date.
      const configWithTimestamp = {
        ...currentConfig,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(
        'playground_config',
        JSON.stringify(configWithTimestamp),
      );

      exportConfig(currentConfig, messages);
      showSuccess(t('配置已导出到下载文件夹'));
    } catch (error) {
      showError(t('导出配置失败: ') + error.message);
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

      const shouldImport = window.confirm(t('导入的配置将覆盖当前设置，是否继续？'));
      if (shouldImport) {
        onConfigImport(importedConfig);
        showSuccess(t('配置导入成功'));
      }
    } catch (error) {
      showError(t('导入配置失败: ') + error.message);
    } finally {
      // Reset file input so the same file can be selected again.
      event.target.value = '';
    }
  };

  const handleReset = () => {
    const shouldReset = window.confirm(
      t('将清除所有保存的配置并恢复默认设置，此操作不可撤销。是否继续？'),
    );
    if (!shouldReset) return;
    // "OK" means reset messages too, "Cancel" keeps messages.
    const resetMessages = window.confirm(
      t(
        '是否同时重置对话消息？选择"确定"将清空所有对话记录并恢复默认示例；选择"取消"将保留当前对话记录。',
      ),
    );
    clearConfig();
    onConfigReset({ resetMessages });
    showSuccess(
      resetMessages
        ? t('配置和消息已全部重置')
        : t('配置已重置，对话消息已保留'),
    );
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

  if (styleState.isMobile) {
    // Mobile uses compact icon actions.
    return (
      <>
        <div className='flex items-center gap-1'>
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            className='rounded-lg text-muted hover:text-primary'
            onPress={handleExport}
            aria-label={t('导出配置')}
          >
            <Download size={14} />
          </Button>
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            className='rounded-lg text-muted hover:text-primary'
            onPress={handleImportClick}
            aria-label={t('导入配置')}
          >
            <Upload size={14} />
          </Button>
          <Button
            isIconOnly
            variant='danger-soft'
            size='sm'
            className='rounded-lg'
            onPress={handleReset}
            aria-label={t('重置配置')}
          >
            <Settings2 size={14} />
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          accept='.json'
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </>
    );
  }

  // Desktop shows a compact action group.
  return (
    <div className='space-y-3'>
      {/* Config status and reset action */}
      <div className='flex items-center justify-between'>
        <span className='text-xs text-muted'>
          {getConfigStatus()}
        </span>
        <Button
          isIconOnly
          size='sm'
          variant='danger-soft'
          onPress={handleReset}
          className='h-6 min-w-6 rounded-full px-2 text-xs'
          aria-label={t('重置配置')}
        >
          <RotateCcw size={12} />
        </Button>
      </div>

      {/* Export and import actions */}
      <div className='flex gap-2'>
        <Button
          size='sm'
          variant='primary'
          onPress={handleExport}
          className='h-7 flex-1 rounded-lg text-xs'
        >
          <Download size={12} />
          {t('导出')}
        </Button>

        <Button
          size='sm'
          variant='outline'
          onPress={handleImportClick}
          className='h-7 flex-1 rounded-lg text-xs'
        >
          <Upload size={12} />
          {t('导入')}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ConfigManager;
