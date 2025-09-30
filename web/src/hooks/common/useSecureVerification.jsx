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

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SecureVerificationService } from '../../services/secureVerification';
import { showError, showSuccess } from '../../helpers';
import { isVerificationRequiredError } from '../../helpers/secureApiCall';

/**
 * 通用安全验证 Hook
 * @param {Object} options - 配置选项
 * @param {Function} options.onSuccess - 验证成功回调
 * @param {Function} options.onError - 验证失败回调
 * @param {string} options.successMessage - 成功提示消息
 * @param {boolean} options.autoReset - 验证完成后是否自动重置状态，默认为 true
 */
export const useSecureVerification = ({ 
  onSuccess, 
  onError, 
  successMessage,
  autoReset = true 
} = {}) => {
  const { t } = useTranslation();

  // 验证方式可用性状态
  const [verificationMethods, setVerificationMethods] = useState({
    has2FA: false,
    hasPasskey: false,
    passkeySupported: false
  });

  // 模态框状态
  const [isModalVisible, setIsModalVisible] = useState(false);

  // 当前验证状态
  const [verificationState, setVerificationState] = useState({
    method: null, // '2fa' | 'passkey'
    loading: false,
    code: '',
    apiCall: null
  });

  // 检查可用的验证方式
  const checkVerificationMethods = useCallback(async () => {
    const methods = await SecureVerificationService.checkAvailableVerificationMethods();
    setVerificationMethods(methods);
    return methods;
  }, []);

  // 初始化时检查验证方式
  useEffect(() => {
    checkVerificationMethods();
  }, [checkVerificationMethods]);

  // 重置状态
  const resetState = useCallback(() => {
    setVerificationState({
      method: null,
      loading: false,
      code: '',
      apiCall: null
    });
    setIsModalVisible(false);
  }, []);

  // 开始验证流程
  const startVerification = useCallback(async (apiCall, options = {}) => {
    const { preferredMethod, title, description } = options;

    // 检查验证方式
    const methods = await checkVerificationMethods();

    if (!methods.has2FA && !methods.hasPasskey) {
      const errorMessage = t('您需要先启用两步验证或 Passkey 才能执行此操作');
      showError(errorMessage);
      onError?.(new Error(errorMessage));
      return false;
    }

    // 设置默认验证方式
    let defaultMethod = preferredMethod;
    if (!defaultMethod) {
      if (methods.hasPasskey && methods.passkeySupported) {
        defaultMethod = 'passkey';
      } else if (methods.has2FA) {
        defaultMethod = '2fa';
      }
    }

    setVerificationState(prev => ({
      ...prev,
      method: defaultMethod,
      apiCall,
      title,
      description
    }));
    setIsModalVisible(true);

    return true;
  }, [checkVerificationMethods, onError, t]);

  // 执行验证
  const executeVerification = useCallback(async (method, code = '') => {
    if (!verificationState.apiCall) {
      showError(t('验证配置错误'));
      return;
    }

    setVerificationState(prev => ({ ...prev, loading: true }));

    try {
      // 先调用验证 API，成功后后端会设置 session
      await SecureVerificationService.verify(method, code);

      // 验证成功，调用业务 API（此时中间件会通过）
      const result = await verificationState.apiCall();

      // 显示成功消息
      if (successMessage) {
        showSuccess(successMessage);
      }

      // 调用成功回调
      onSuccess?.(result, method);

      // 自动重置状态
      if (autoReset) {
        resetState();
      }

      return result;
    } catch (error) {
      showError(error.message || t('验证失败，请重试'));
      onError?.(error);
      throw error;
    } finally {
      setVerificationState(prev => ({ ...prev, loading: false }));
    }
  }, [verificationState.apiCall, successMessage, onSuccess, onError, autoReset, resetState, t]);

  // 设置验证码
  const setVerificationCode = useCallback((code) => {
    setVerificationState(prev => ({ ...prev, code }));
  }, []);

  // 切换验证方式
  const switchVerificationMethod = useCallback((method) => {
    setVerificationState(prev => ({ ...prev, method, code: '' }));
  }, []);

  // 取消验证
  const cancelVerification = useCallback(() => {
    resetState();
  }, [resetState]);

  // 检查是否可以使用某种验证方式
  const canUseMethod = useCallback((method) => {
    switch (method) {
      case '2fa':
        return verificationMethods.has2FA;
      case 'passkey':
        return verificationMethods.hasPasskey && verificationMethods.passkeySupported;
      default:
        return false;
    }
  }, [verificationMethods]);

  // 获取推荐的验证方式
  const getRecommendedMethod = useCallback(() => {
    if (verificationMethods.hasPasskey && verificationMethods.passkeySupported) {
      return 'passkey';
    }
    if (verificationMethods.has2FA) {
      return '2fa';
    }
    return null;
  }, [verificationMethods]);

  /**
   * 包装 API 调用，自动处理验证错误
   * 当 API 返回需要验证的错误时，自动弹出验证模态框
   * @param {Function} apiCall - API 调用函数
   * @param {Object} options - 验证选项（同 startVerification）
   * @returns {Promise<any>}
   */
  const withVerification = useCallback(async (apiCall, options = {}) => {
    try {
      // 直接尝试调用 API
      return await apiCall();
    } catch (error) {
      // 检查是否是需要验证的错误
      if (isVerificationRequiredError(error)) {
        // 自动触发验证流程
        await startVerification(apiCall, options);
        // 不抛出错误，让验证模态框处理
        return null;
      }
      // 其他错误继续抛出
      throw error;
    }
  }, [startVerification]);

  return {
    // 状态
    isModalVisible,
    verificationMethods,
    verificationState,

    // 方法
    startVerification,
    executeVerification,
    cancelVerification,
    resetState,
    setVerificationCode,
    switchVerificationMethod,
    checkVerificationMethods,

    // 辅助方法
    canUseMethod,
    getRecommendedMethod,
    withVerification, // 新增：自动处理验证的包装函数

    // 便捷属性
    hasAnyVerificationMethod: verificationMethods.has2FA || verificationMethods.hasPasskey,
    isLoading: verificationState.loading,
    currentMethod: verificationState.method,
    code: verificationState.code
  };
};