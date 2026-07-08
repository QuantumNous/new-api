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

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  processModelsData,
  processGroupsData,
  showWarning,
  showError,
  getUserModelsCached,
  cachedGet,
} from '../../helpers';
import { isPlaygroundSupported } from '../../helpers/playground';
import { API_ENDPOINTS } from '../../constants/playground.constants';
import { StatusContext } from '../../context/Status';
import { parseImageSizeConfig } from '../../constants/imagePlayground.constants';
import { parseVideoModelConfig } from '../../constants/videoPlayground.constants';

export const useDataLoader = (
  userState,
  inputs,
  handleInputChange,
  setModels,
  setGroups,
  setModelEndpointTypes,
) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  // 本地保存 pricing 的 model->端点类型、model->分组 映射，用于"仅展示文本模型/分组"过滤。
  const pricingRef = useRef({ types: new Map(), groups: new Map() });
  const [pricingVersion, setPricingVersion] = useState(0);

  // 运营设置里声明为图片/视频的模型集合：文本操练场需排除这些模型
  // （即便后端未按端点类型识别为 image-generation/openai-video）。
  const mediaModelSet = useMemo(() => {
    const set = new Set();
    const img = parseImageSizeConfig(statusState?.status?.ImageModelSizeConfig);
    const vid = parseVideoModelConfig(statusState?.status?.VideoModelConfig);
    Object.keys(img.models || {}).forEach((m) => set.add(m));
    Object.keys(vid.models || {}).forEach((m) => set.add(m));
    return set;
  }, [
    statusState?.status?.ImageModelSizeConfig,
    statusState?.status?.VideoModelConfig,
  ]);

  const loadModels = useCallback(async () => {
    try {
      const { success, message, data } = await getUserModelsCached(
        inputs.group,
      );

      if (success) {
        const previousModel = inputs.model;
        // 仅保留文本模型（排除 图片/视频/embedding/rerank）。pricing 不可用时不过滤。
        let list = Array.isArray(data) ? data : [];
        const types = pricingRef.current.types;
        if (types.size > 0) {
          list = list.filter((m) => isPlaygroundSupported(m, types));
        }
        // 再排除运营设置里声明为图片/视频的模型
        if (mediaModelSet.size > 0) {
          list = list.filter((m) => !mediaModelSet.has(m));
        }
        const { modelOptions, selectedModel } = processModelsData(
          list,
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
  }, [
    inputs.model,
    inputs.group,
    handleInputChange,
    setModels,
    mediaModelSet,
    t,
  ]);

  const loadGroups = useCallback(async () => {
    try {
      const { success, message, data } = await cachedGet(
        API_ENDPOINTS.USER_GROUPS,
      );

      if (success) {
        const userGroup =
          userState?.user?.group ||
          JSON.parse(localStorage.getItem('user'))?.group;
        let groupOptions = processGroupsData(data, userGroup);

        // 仅保留含文本模型的分组（auto / "all" 哨兵放行）
        const { types, groups: gmap } = pricingRef.current;
        if (types.size > 0) {
          const textGroupSet = new Set();
          types.forEach((_tp, model) => {
            if (
              isPlaygroundSupported(model, types) &&
              !mediaModelSet.has(model)
            ) {
              (gmap.get(model) || []).forEach((g) => textGroupSet.add(g));
            }
          });
          const allowAll = textGroupSet.has('all');
          if (textGroupSet.size > 0 && !allowAll) {
            groupOptions = groupOptions.filter(
              (g) => textGroupSet.has(g.value) || g.value === 'auto',
            );
          }
        }
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
  }, [userState, inputs.group, handleInputChange, setGroups, mediaModelSet, t]);

  // 拉一次 /api/pricing，构建 model -> endpoint_types[] 映射，
  // 用于提交前判断模型是否可在操练场调试（非 chat 模型会弹框提示）。
  // 失败 silent：保持 map 为空 == 全部放行（fail-open），不影响 chat 主路径。
  const loadModelEndpointTypes = useCallback(async () => {
    if (!setModelEndpointTypes) return;
    try {
      // skipErrorHandler 跳过全局拦截器的 Toast，pricing 拉不到不应该让用户看到错误弹窗。
      const payload = await cachedGet(API_ENDPOINTS.PRICING, {
        config: { skipErrorHandler: true },
      });
      const { success, data } = payload || {};
      if (!success || !Array.isArray(data)) return;
      const map = new Map();
      const groupsMap = new Map();
      data.forEach((item) => {
        if (item && item.model_name) {
          map.set(item.model_name, item.supported_endpoint_types || []);
          groupsMap.set(item.model_name, item.enable_groups || []);
        }
      });
      pricingRef.current = { types: map, groups: groupsMap };
      setModelEndpointTypes(map);
      // 通知 models/groups 重新按能力过滤
      setPricingVersion((v) => v + 1);
    } catch (_) {
      // 静默：保持 map 为空 → 不过滤（全部放行）
    }
  }, [setModelEndpointTypes]);

  // pricing 先加载一次
  useEffect(() => {
    if (userState?.user) loadModelEndpointTypes();
  }, [userState?.user, loadModelEndpointTypes]);

  // models/groups：用户/分组变化或 pricing 就绪后（重新）按能力过滤加载
  useEffect(() => {
    if (userState?.user) {
      loadModels();
      loadGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, loadModels, loadGroups, pricingVersion]);

  return {
    loadModels,
    loadGroups,
    loadModelEndpointTypes,
  };
};
