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

import React, { useState } from 'react';
import { Tag, Space, Skeleton, Button } from '@douyinfe/semi-ui';
import { IconDownload } from '@douyinfe/semi-icons';
import { renderQuota, showError, showSuccess, getUserIdFromLocalStorage } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  compactMode,
  setCompactMode,
  getFormValues,
  isAdminUser,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loadingStat);
  const needSkeleton = !showStat || showSkeleton;
  const [exporting, setExporting] = useState(false);

  // 导出日志为CSV
  const handleExport = async () => {
    if (!isAdminUser) {
      showError(t('仅管理员可导出日志'));
      return;
    }

    setExporting(true);
    try {
      const formValues = getFormValues ? getFormValues() : {};
      let startTimestamp = 0;
      let endTimestamp = 0;

      // 处理时间戳：可能是Date对象、字符串或时间戳
      const parseTimestamp = (value) => {
        if (!value) return 0;
        if (value instanceof Date) {
          return Math.floor(value.getTime() / 1000);
        }
        if (typeof value === 'number') {
          return value;
        }
        // 字符串格式
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
      };

      startTimestamp = parseTimestamp(formValues.start_timestamp);
      endTimestamp = parseTimestamp(formValues.end_timestamp);

      // 构建导出URL
      const params = new URLSearchParams({
        type: formValues.logType || '0',
        username: formValues.username || '',
        token_name: formValues.token_name || '',
        model_name: formValues.model_name || '',
        start_timestamp: startTimestamp.toString(),
        end_timestamp: endTimestamp.toString(),
        channel: formValues.channel || '',
        group: formValues.group || '',
      });

      const exportUrl = `/api/log/export?${params.toString()}`;

      // 使用fetch获取文件，携带认证cookies和用户标识头
      const response = await fetch(exportUrl, {
        credentials: 'include',
        headers: {
          'New-Api-User': getUserIdFromLocalStorage(),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 从响应头获取文件名，或使用默认文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `logs_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      // 创建Blob并下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(t('导出成功'));
    } catch (error) {
      showError(t('导出失败') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const placeholder = (
    <Space>
      <Skeleton.Title style={{ width: 108, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 65, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 64, height: 21, borderRadius: 6 }} />
    </Space>
  );

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      <Skeleton loading={needSkeleton} active placeholder={placeholder}>
        <Space>
          <Tag
            color='blue'
            style={{
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              padding: 13,
            }}
            className='!rounded-lg'
          >
            {t('消耗额度')}: {renderQuota(stat.quota)}
          </Tag>
          <Tag
            color='pink'
            style={{
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              padding: 13,
            }}
            className='!rounded-lg'
          >
            RPM: {stat.rpm}
          </Tag>
          <Tag
            color='white'
            style={{
              border: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              fontWeight: 500,
              padding: 13,
            }}
            className='!rounded-lg'
          >
            TPM: {stat.tpm}
          </Tag>
        </Space>
      </Skeleton>

      <Space>
        {isAdminUser && (
          <Button
            icon={<IconDownload />}
            loading={exporting}
            onClick={handleExport}
            style={{
              fontWeight: 500,
              borderRadius: 8,
            }}
          >
            {t('导出')}
          </Button>
        )}
        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </Space>
    </div>
  );
};

export default LogsActions;
