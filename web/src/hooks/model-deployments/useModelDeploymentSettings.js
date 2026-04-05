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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';

export const useModelDeploymentSettings = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    'model_deployment.ionet.enabled': false,
  });
  const [connectionState, setConnectionState] = useState({
    loading: false,
    ok: null,
    error: null,
  });

  const getSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/deployments/settings');
      const { success, data } = res.data;

      if (success) {
        setSettings({
          'model_deployment.ionet.enabled': data?.enabled === true,
        });
      }
    } catch (error) {
      console.error('Failed to get model deployment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  const isIoNetEnabled = settings['model_deployment.ionet.enabled'];

  const buildConnectionError = useCallback(
    (rawMessage, fallbackMessage) => {
      const fallback = (fallbackMessage || t('连接失败')).trim();
      const message = (rawMessage || fallback).trim();
      const normalized = message.toLowerCase();
      if (normalized.includes('expired') || normalized.includes('expire')) {
        return { type: 'expired', message };
      }
      if (
        normalized.includes('invalid') ||
        normalized.includes('unauthorized') ||
        normalized.includes('api key')
      ) {
        return { type: 'invalid', message };
      }
      if (normalized.includes('network') || normalized.includes('timeout')) {
        return { type: 'network', message };
      }
      return { type: 'unknown', message };
    },
    [t],
  );

  const testConnection = useCallback(async () => {
    setConnectionState({ loading: true, ok: null, error: null });
    try {
      const response = await API.post(
        '/api/deployments/settings/test-connection',
        {},
        { skipErrorHandler: true },
      );

      if (response?.data?.success) {
        setConnectionState({ loading: false, ok: true, error: null });
        return;
      }

      const message = response?.data?.message || t('连接失败');
      setConnectionState({
        loading: false,
        ok: false,
        error: buildConnectionError(message),
      });
    } catch (error) {
      if (error?.code === 'ERR_NETWORK') {
        setConnectionState({
          loading: false,
          ok: false,
          error: { type: 'network', message: t('网络连接失败') },
        });
        return;
      }
      const rawMessage =
        error?.response?.data?.message || error?.message || t('未知错误');
      setConnectionState({
        loading: false,
        ok: false,
        error: buildConnectionError(rawMessage, t('连接失败')),
      });
    }
  }, [buildConnectionError, t]);

  useEffect(() => {
    if (!loading && isIoNetEnabled) {
      testConnection();
      return;
    }
    setConnectionState({ loading: false, ok: null, error: null });
  }, [loading, isIoNetEnabled, testConnection]);

  return {
    loading,
    settings,
    isIoNetEnabled,
    refresh: getSettings,
    connectionLoading: connectionState.loading,
    connectionOk: connectionState.ok,
    connectionError: connectionState.error,
    testConnection,
  };
};
