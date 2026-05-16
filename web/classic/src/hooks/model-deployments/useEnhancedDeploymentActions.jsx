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

import { useState } from 'react';
import { API, showError, showSuccess } from '../../helpers';

export const useEnhancedDeploymentActions = (t) => {
  const [loading, setLoading] = useState({});

  // Set loading state for specific operation
  const setOperationLoading = (operation, deploymentId, isLoading) => {
    setLoading((prev) => ({
      ...prev,
      [`${operation}_${deploymentId}`]: isLoading,
    }));
  };

  // Get loading state for specific operation
  const isOperationLoading = (operation, deploymentId) => {
    return loading[`${operation}_${deploymentId}`] || false;
  };

  // Extend deployment duration
  const extendDeployment = async (deploymentId, durationHours) => {
    try {
      setOperationLoading('extend', deploymentId, true);

      const response = await API.post(
        `/api/deployments/${deploymentId}/extend`,
        {
          duration_hours: durationHours,
        },
      );

      if (response.data.success) {
        showSuccess(t('容器时长延长成功'));
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('延长时长失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('extend', deploymentId, false);
    }
  };

  // Get deployment details
  const getDeploymentDetails = async (deploymentId) => {
    try {
      setOperationLoading('details', deploymentId, true);

      const response = await API.get(`/api/deployments/${deploymentId}`);

      if (response.data.success) {
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('获取详情失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('details', deploymentId, false);
    }
  };

  // Get deployment logs
  const getDeploymentLogs = async (deploymentId, options = {}) => {
    try {
      setOperationLoading('logs', deploymentId, true);

      const params = new URLSearchParams();

      if (options.containerId)
        params.append('container_id', options.containerId);
      if (options.level) params.append('level', options.level);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.cursor) params.append('cursor', options.cursor);
      if (options.follow) params.append('follow', 'true');
      if (options.startTime) params.append('start_time', options.startTime);
      if (options.endTime) params.append('end_time', options.endTime);

      const response = await API.get(
        `/api/deployments/${deploymentId}/logs?${params}`,
      );

      if (response.data.success) {
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('获取日志失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('logs', deploymentId, false);
    }
  };

  // Update deployment configuration
  const updateDeploymentConfig = async (deploymentId, config) => {
    try {
      setOperationLoading('config', deploymentId, true);

      const response = await API.put(
        `/api/deployments/${deploymentId}`,
        config,
      );

      if (response.data.success) {
        showSuccess(t('容器配置更新成功'));
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('更新配置失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('config', deploymentId, false);
    }
  };

  // Delete (destroy) deployment
  const deleteDeployment = async (deploymentId) => {
    try {
      setOperationLoading('delete', deploymentId, true);

      const response = await API.delete(`/api/deployments/${deploymentId}`);

      if (response.data.success) {
        showSuccess(t('容器销毁请求已提交'));
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('销毁容器失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('delete', deploymentId, false);
    }
  };

  // Update deployment name
  const updateDeploymentName = async (deploymentId, newName) => {
    try {
      setOperationLoading('rename', deploymentId, true);

      const response = await API.put(`/api/deployments/${deploymentId}/name`, {
        name: newName,
      });

      if (response.data.success) {
        showSuccess(t('容器名称更新成功'));
        return response.data.data;
      }
    } catch (error) {
      showError(
        t('更新名称失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
      throw error;
    } finally {
      setOperationLoading('rename', deploymentId, false);
    }
  };

  // Batch operations
  const batchDelete = async (deploymentIds) => {
    try {
      setOperationLoading('batch_delete', 'all', true);

      const results = await Promise.allSettled(
        deploymentIds.map((id) => deleteDeployment(id)),
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (successful > 0) {
        showSuccess(
          t('批量操作完成: {{success}}个成功, {{failed}}个失败', {
            success: successful,
            failed: failed,
          }),
        );
      }

      return { successful, failed };
    } catch (error) {
      showError(t('批量操作失败') + ': ' + error.message);
      throw error;
    } finally {
      setOperationLoading('batch_delete', 'all', false);
    }
  };

  // Export logs
  const exportLogs = async (deploymentId, options = {}) => {
    try {
      setOperationLoading('export_logs', deploymentId, true);

      const logs = await getDeploymentLogs(deploymentId, {
        ...options,
        limit: 10000, // Get more logs for export
      });

      if (logs && logs.logs) {
        const logText = logs.logs
          .map(
            (log) =>
              `[${new Date(log.timestamp).toISOString()}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`,
          )
          .join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deployment-${deploymentId}-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showSuccess(t('日志导出成功'));
      }
    } catch (error) {
      showError(t('导出日志失败') + ': ' + error.message);
      throw error;
    } finally {
      setOperationLoading('export_logs', deploymentId, false);
    }
  };

  return {
    // Actions
    extendDeployment,
    getDeploymentDetails,
    getDeploymentLogs,
    updateDeploymentConfig,
    deleteDeployment,
    updateDeploymentName,
    batchDelete,
    exportLogs,

    // Loading states
    isOperationLoading,
    loading,

    // Utility
    setOperationLoading,
  };
};

export default useEnhancedDeploymentActions;
