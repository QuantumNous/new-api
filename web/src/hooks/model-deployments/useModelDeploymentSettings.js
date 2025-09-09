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

import { useState, useEffect } from 'react';
import { API, toBoolean } from '../../helpers';

export const useModelDeploymentSettings = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    'model_deployment.ionet.enabled': false,
    'model_deployment.ionet.api_key': '',
  });

  const getSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/option/');
      const { success, data } = res.data;
      
      if (success) {
        const newSettings = {
          'model_deployment.ionet.enabled': false,
          'model_deployment.ionet.api_key': '',
        };
        
        data.forEach((item) => {
          if (item.key.endsWith('enabled')) {
            newSettings[item.key] = toBoolean(item.value);
          } else if (newSettings.hasOwnProperty(item.key)) {
            newSettings[item.key] = item.value || '';
          }
        });
        
        setSettings(newSettings);
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

  const isIoNetEnabled = settings['model_deployment.ionet.enabled'] && 
                        settings['model_deployment.ionet.api_key'] && 
                        settings['model_deployment.ionet.api_key'].trim() !== '';

  return {
    loading,
    settings,
    isIoNetEnabled,
    refresh: getSettings,
  };
};