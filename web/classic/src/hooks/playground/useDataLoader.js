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
  showError,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';

const PLAYGROUND_CHAT_ENDPOINT_TYPES = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
]);

const PLAYGROUND_IMAGE_MODEL_HINTS = [
  'gpt-image',
  'dall-e',
  'imagen',
  'flux',
  'recraft',
];

const PLAYGROUND_VIDEO_MODEL_HINTS = [
  'seedance',
  'kling',
  'veo',
  'jimeng',
  'cogvideo',
  'luma',
  'hailuo',
  'video',
];

const isPlaygroundChatModel = (modelName) => {
  if (typeof modelName !== 'string' || modelName.trim() === '') {
    return false;
  }
  const normalizedModelName = modelName.toLowerCase();
  return ![...PLAYGROUND_IMAGE_MODEL_HINTS, ...PLAYGROUND_VIDEO_MODEL_HINTS].some(
    (hint) => normalizedModelName.includes(hint),
  );
};

export const useDataLoader = (
  userState,
  inputs,
  handleInputChange,
  setModels,
  setImageModels,
  setVideoModels,
  setGroups,
) => {
  if (typeof setGroups !== 'function' && typeof setVideoModels !== 'function') {
    setGroups = setImageModels;
    setImageModels = undefined;
  }

  const { t } = useTranslation();

  const loadModels = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.PRICING);
      const { success, message, data } = res.data;

      if (success) {
        const pricingItems = Array.isArray(data) ? data : [];
        const filteredModels = Array.from(
          new Set(
            pricingItems
              .filter((item) => {
                const modelName = item?.model_name;
                const endpointTypes = Array.isArray(
                  item?.supported_endpoint_types,
                )
                  ? item.supported_endpoint_types
                  : [];

                if (!isPlaygroundChatModel(modelName)) {
                  return false;
                }

                return endpointTypes.some((endpointType) =>
                  PLAYGROUND_CHAT_ENDPOINT_TYPES.has(endpointType),
                );
              })
              .map((item) => item.model_name)
              .filter(Boolean),
          ),
        );
        const filteredVideoModels = Array.from(
          new Set(
            pricingItems
              .filter((item) => {
                const modelName = item?.model_name;
                return (
                  typeof modelName === 'string' &&
                  modelName.trim() !== '' &&
                  PLAYGROUND_VIDEO_MODEL_HINTS.some((hint) =>
                    modelName.toLowerCase().includes(hint),
                  )
                );
              })
              .map((item) => item.model_name)
              .filter(Boolean),
          ),
        );
        const filteredImageModels = Array.from(
          new Set(
            pricingItems
              .filter((item) => {
                const modelName = item?.model_name;

                return (
                  typeof modelName === 'string' &&
                  modelName.trim() !== '' &&
                  PLAYGROUND_IMAGE_MODEL_HINTS.some((hint) =>
                    modelName.toLowerCase().includes(hint),
                  )
                );
              })
              .map((item) => item.model_name)
              .filter(Boolean),
          ),
        );

        const { modelOptions, selectedModel } = processModelsData(
          filteredModels,
          inputs.model,
        );
        const {
          modelOptions: imageModelOptions,
          selectedModel: selectedImageModel,
        } = processModelsData(filteredImageModels, inputs.imageModel);
        const {
          modelOptions: videoModelOptions,
          selectedModel: selectedVideoModel,
        } = processModelsData(filteredVideoModels, inputs.videoModel);

        setModels(modelOptions);
        if (typeof setImageModels === 'function') {
          setImageModels(imageModelOptions);
        }
        if (typeof setVideoModels === 'function') {
          setVideoModels(videoModelOptions);
        }

        if (selectedModel && selectedModel !== inputs.model) {
          handleInputChange('model', selectedModel);
        }
        if (selectedImageModel && selectedImageModel !== inputs.imageModel) {
          handleInputChange('imageModel', selectedImageModel);
        }
        if (selectedVideoModel && selectedVideoModel !== inputs.videoModel) {
          handleInputChange('videoModel', selectedVideoModel);
        }
      } else {
        showError(t(message));
      }
    } catch (error) {
      showError(t('加载模型失败'));
    }
  }, [
    inputs.model,
    inputs.imageModel,
    inputs.videoModel,
    handleInputChange,
    setModels,
    setImageModels,
    setVideoModels,
    t,
  ]);

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

  // 自动加载数据
  useEffect(() => {
    if (userState?.user) {
      loadModels();
      loadGroups();
    }
  }, [userState?.user, loadModels, loadGroups]);

  return {
    loadModels,
    loadGroups,
  };
};
