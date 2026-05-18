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

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  processModelsData,
  processGroupsData,
  showWarning,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';

export const useDataLoader = (
  userState,
  inputs,
  handleInputChange,
  setModels,
  setGroups,
  setModelEndpointTypes,
) => {
  const { t } = useTranslation();

  const loadModels = useCallback(async () => {
    try {
      const groupParam = inputs.group
        ? `?group=${encodeURIComponent(inputs.group)}`
        : '';
      const res = await API.get(`${API_ENDPOINTS.USER_MODELS}${groupParam}`);
      const { success, message, data } = res.data;

      if (success) {
        const previousModel = inputs.model;
        const { modelOptions, selectedModel } = processModelsData(
          data,
          previousModel,
        );
        setModels(modelOptions);

        if (selectedModel !== previousModel) {
          handleInputChange('model', selectedModel);
          if (previousModel) {
            showWarning(
              t('模型 {{model}} 在所选分组下不可用，已切换为 {{next}}', {
                model: previousModel,
                next: selectedModel || t('（无可用模型）'),
              }),
            );
          }
        }
      } else {
        showError(t(message));
      }
    } catch (error) {
      showError(t('加载模型失败'));
    }
  }, [inputs.model, inputs.group, handleInputChange, setModels, t]);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.USER_GROUPS);
      const { success, message, data } = res.data;

      if (success) {
        const userGroup =
          userState?.user?.group ||
          JSON.parse(localStorage.getItem('user'))?.group;
        const groupOptions = processGroupsData(data, userGroup);
        setGroups(groupOptions);

        const hasCurrentGroup = groupOptions.some(
          (option) => option.value === inputs.group,
        );
        if (!hasCurrentGroup) {
          handleInputChange('group', groupOptions[0]?.value || '');
        }
      } else {
        showError(t(message));
      }
    } catch (error) {
      showError(t('加载分组失败'));
    }
  }, [userState, inputs.group, handleInputChange, setGroups, t]);

  // 拉一次 /api/pricing，构建 model -> endpoint_types[] 映射，
  // 用于提交前判断模型是否可在操练场调试（非 chat 模型会弹框提示）。
  // 失败 silent：保持 map 为空 == 全部放行（fail-open），不影响 chat 主路径。
  const loadModelEndpointTypes = useCallback(async () => {
    if (!setModelEndpointTypes) return;
    try {
      // skipErrorHandler 跳过全局拦截器的 Toast，pricing 拉不到不应该让用户看到错误弹窗。
      const res = await API.get(API_ENDPOINTS.PRICING, {
        skipErrorHandler: true,
      });
      const { success, data } = res.data || {};
      if (!success || !Array.isArray(data)) return;
      const map = new Map();
      data.forEach((item) => {
        if (item && item.model_name) {
          map.set(item.model_name, item.supported_endpoint_types || []);
        }
      });
      setModelEndpointTypes(map);
    } catch (_) {
      // 静默：保持 map 为空 → isPlaygroundSupported 一律放行
    }
  }, [setModelEndpointTypes]);

  // 自动加载数据
  useEffect(() => {
    if (userState?.user) {
      loadModels();
      loadGroups();
      loadModelEndpointTypes();
    }
  }, [userState?.user, loadModels, loadGroups, loadModelEndpointTypes]);

  return {
    loadModels,
    loadGroups,
    loadModelEndpointTypes,
  };
};
