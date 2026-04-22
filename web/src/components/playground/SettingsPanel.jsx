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

import React, { useEffect } from 'react';
import { Card, Select, Typography, Button, Switch } from '@douyinfe/semi-ui';
import { Sparkles, Users, ToggleLeft, X, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renderGroupOption, selectFilter } from '../../helpers';
import ParameterControl from './ParameterControl';
import ImageUrlInput from './ImageUrlInput';
import ConfigManager from './ConfigManager';
import CustomRequestEditor from './CustomRequestEditor';

const SettingsPanel = ({
  inputs,
  parameterEnabled,
  models,
  groups,
  styleState,
  showDebugPanel,
  customRequestMode,
  customRequestBody,
  onInputChange,
  onParameterToggle,
  onCloseSettings,
  onConfigImport,
  onConfigReset,
  onCustomRequestModeChange,
  onCustomRequestBodyChange,
  previewPayload,
  messages,
}) => {
  const { t } = useTranslation();
  const normalizeGrokImageSize = (size) => {
    if (size === '1536x1024') {
      return '1792x1024';
    }
    if (size === '1024x1536') {
      return '1024x1792';
    }
    return size;
  };
  const grokImagineImageModels = new Set([
    'grok-imagine-1.0',
    'grok-imagine-1.0-fast',
  ]);
  const grokImagineImageEditModels = new Set(['grok-imagine-1.0-edit']);
  const restrictedImageUploadModels = new Set(['grok-imagine-1.0']);
  const adobeImageModels = new Set([
    'nano-banana',
    'nano-banana2',
    'nano-banana-pro',
    'gpt-image2',
  ]);
  const chatAdobeImageModels = new Set(['nano-banana2', 'nano-banana-pro']);
  const adobeVideoModels = new Set([
    'sora2',
    'sora2-pro',
    'veo31',
    'veo31-ref',
    'veo31-fast',
  ]);
  const isGrokImagineImageModel =
    grokImagineImageModels.has(inputs.model) ||
    grokImagineImageEditModels.has(inputs.model);
  const isGrokImagineImageEditModel = grokImagineImageEditModels.has(inputs.model);
  const isAdobeImageModel = adobeImageModels.has(inputs.model);
  const isAdobeVideoModel = adobeVideoModels.has(inputs.model);
  const isAdobeSoraModel =
    inputs.model === 'sora2' || inputs.model === 'sora2-pro';
  const isAdobeVeoModel =
    inputs.model === 'veo31' ||
    inputs.model === 'veo31-ref' ||
    inputs.model === 'veo31-fast';
  const isVideoModel =
    typeof inputs.model === 'string' && inputs.model.includes('video');
  const isGrokImagineVideoModel = inputs.model === 'grok-imagine-1.0-video';
  const imageSizeOptions = [
    { label: '1:1 方图 (1024x1024)', value: '1024x1024' },
    { label: '3:2 横图 (1792x1024)', value: '1792x1024' },
    { label: '2:3 竖图 (1024x1792)', value: '1024x1792' },
    { label: '16:9 宽屏 (1280x720)', value: '1280x720' },
    { label: '9:16 竖屏 (720x1280)', value: '720x1280' },
  ];
  const videoSizeOptions = [
    { label: '1280x720', value: '1280x720' },
    { label: '720x1280', value: '720x1280' },
    { label: '1792x1024', value: '1792x1024' },
    { label: '1024x1792', value: '1024x1792' },
    { label: '1024x1024', value: '1024x1024' },
  ];
  const grokImageRatioOptions = [
    { label: '3:2', value: '1792x1024' },
    { label: '2:3', value: '1024x1792' },
    { label: '16:9', value: '1280x720' },
    { label: '9:16', value: '720x1280' },
    { label: '1:1', value: '1024x1024' },
  ];
  const grokVideoRatioOptions = [
    { label: '3:2', value: '1792x1024' },
    { label: '2:3', value: '1024x1792' },
    { label: '16:9', value: '1280x720' },
    { label: '9:16', value: '720x1280' },
    { label: '1:1', value: '1024x1024' },
  ];
  const videoSecondsOptions = [6, 8, 10, 12, 15, 20, 25, 30].map((v) => ({
    label: `${v}s`,
    value: String(v),
  }));
  const videoPresetOptions = [
    { label: 'Normal', value: 'normal' },
    { label: 'Fun', value: 'fun' },
    { label: 'Spicy', value: 'spicy' },
    { label: 'Custom', value: 'custom' },
  ];
  const videoQualityOptions = [
    { label: '480p', value: '480p' },
    { label: '720p', value: '720p' },
  ];
  const defaultAdobeAspectRatioOptions = [
    { label: 'Auto', value: 'auto' },
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
  ];
  const chatAdobeAspectRatioOptions = [
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
  ];
  const gptImage2SizeOptions = [
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
    { label: '3:2', value: '3:2' },
    { label: '2:3', value: '2:3' },
  ];
  const adobeAutoImageSizeOptions = [
    { label: 'Square (1024x1024)', value: '1024x1024' },
    { label: 'Landscape (1792x1024)', value: '1792x1024' },
    { label: 'Portrait (1024x1792)', value: '1024x1792' },
    { label: 'Classic (2048x1536)', value: '2048x1536' },
    { label: 'Tall (1536x2048)', value: '1536x2048' },
  ];
  const adobeVideoAspectRatioOptions = [
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
  ];
  const adobeOutputResolutionOptions = [
    { label: '1K', value: '1K' },
    { label: '2K', value: '2K' },
    { label: '4K', value: '4K' },
  ];
  const adobeSoraDurationOptions = [4, 8, 12].map((v) => ({
    label: `${v}s`,
    value: String(v),
  }));
  const adobeVeoDurationOptions = [4, 6, 8].map((v) => ({
    label: `${v}s`,
    value: String(v),
  }));
  const getAdobeVideoDurationOptions = (modelName) => {
    if (modelName === 'veo31-ref') {
      return adobeVeoDurationOptions.filter((option) => option.value === '8');
    }
    if (modelName === 'sora2' || modelName === 'sora2-pro') {
      return adobeSoraDurationOptions;
    }
    return adobeVeoDurationOptions;
  };
  const getAdobeVideoAspectRatioOptions = (modelName) => {
    if (modelName === 'veo31-ref') {
      return adobeVideoAspectRatioOptions.filter(
        (option) => option.value === '16:9',
      );
    }
    return adobeVideoAspectRatioOptions;
  };
  const getAdobeVideoDefaultDuration = (modelName) =>
    getAdobeVideoDurationOptions(modelName)[0]?.value || '4';
  const getAdobeVideoDefaultAspectRatio = (modelName) =>
    getAdobeVideoAspectRatioOptions(modelName)[0]?.value || '16:9';
  const adobeVideoResolutionOptions = [
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
  ];
  const adobeReferenceModeOptions = [
    { label: 'Frame', value: 'frame' },
    { label: 'Image', value: 'image' },
  ];
  const isGPTImage2Model = inputs.model === 'gpt-image2';
  const currentAdobeAspectRatioOptions = isGPTImage2Model
    ? gptImage2SizeOptions
    : chatAdobeImageModels.has(inputs.model)
      ? chatAdobeAspectRatioOptions
      : defaultAdobeAspectRatioOptions;
  const currentAdobeSupportsAutoImageSize = currentAdobeAspectRatioOptions.some(
    (option) => option.value === 'auto',
  );
  const isImageUploadAllowed = !restrictedImageUploadModels.has(inputs.model);

  useEffect(() => {
    if (isImageUploadAllowed) {
      return;
    }
    if (inputs.imageEnabled) {
      onInputChange('imageEnabled', false);
    }
    if (Array.isArray(inputs.imageUrls) && inputs.imageUrls.some((url) => url)) {
      onInputChange('imageUrls', ['']);
    }
  }, [inputs.imageEnabled, inputs.imageUrls, isImageUploadAllowed, onInputChange]);

  const currentConfig = {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
  };
  const currentAdobeVideoDurationOptions = getAdobeVideoDurationOptions(inputs.model);
  const currentAdobeVideoAspectRatioOptions = getAdobeVideoAspectRatioOptions(
    inputs.model,
  );
  const selectedAdobeVideoDuration = currentAdobeVideoDurationOptions.some(
    (option) => option.value === inputs.videoDuration,
  )
    ? inputs.videoDuration
    : getAdobeVideoDefaultDuration(inputs.model);
  const selectedAdobeVideoAspectRatio = currentAdobeVideoAspectRatioOptions.some(
    (option) => option.value === inputs.aspectRatio,
  )
    ? inputs.aspectRatio
    : getAdobeVideoDefaultAspectRatio(inputs.model);

  return (
    <Card
      className='h-full flex flex-col'
      bordered={false}
      bodyStyle={{
        padding: styleState.isMobile ? '16px' : '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 标题区域 - 与调试面板保持一致 */}
      <div className='flex items-center justify-between mb-6 flex-shrink-0'>
        <div className='flex items-center'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3'>
            <Settings size={20} className='text-white' />
          </div>
          <Typography.Title heading={5} className='mb-0'>
            {t('模型配置')}
          </Typography.Title>
        </div>

        {styleState.isMobile && onCloseSettings && (
          <Button
            icon={<X size={16} />}
            onClick={onCloseSettings}
            theme='borderless'
            type='tertiary'
            size='small'
            className='!rounded-lg'
          />
        )}
      </div>

      {/* 移动端配置管理 */}
      {styleState.isMobile && (
        <div className='mb-4 flex-shrink-0'>
          <ConfigManager
            currentConfig={currentConfig}
            onConfigImport={onConfigImport}
            onConfigReset={onConfigReset}
            styleState={{ ...styleState, isMobile: false }}
            messages={messages}
          />
        </div>
      )}

      <div className='space-y-6 overflow-y-auto flex-1 pr-2 model-settings-scroll'>
        {/* 自定义请求体编辑器 */}
        <CustomRequestEditor
          customRequestMode={customRequestMode}
          customRequestBody={customRequestBody}
          onCustomRequestModeChange={onCustomRequestModeChange}
          onCustomRequestBodyChange={onCustomRequestBodyChange}
          defaultPayload={previewPayload}
        />

        {/* 分组选择 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Users size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('分组')}
            </Typography.Text>
            {customRequestMode && (
              <Typography.Text className='text-xs text-orange-600'>
                ({t('已在自定义模式中忽略')})
              </Typography.Text>
            )}
          </div>
          <Select
            placeholder={t('请选择分组')}
            name='group'
            required
            selection
            filter={selectFilter}
            autoClearSearchValue={false}
            onChange={(value) => onInputChange('group', value)}
            value={inputs.group}
            autoComplete='new-password'
            optionList={groups}
            renderOptionItem={renderGroupOption}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
            disabled={customRequestMode}
          />
        </div>

        {/* 模型选择 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Sparkles size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('模型')}
            </Typography.Text>
            {customRequestMode && (
              <Typography.Text className='text-xs text-orange-600'>
                ({t('已在自定义模式中忽略')})
              </Typography.Text>
            )}
          </div>
          <Select
            placeholder={t('请选择模型')}
            name='model'
            required
            selection
            filter={selectFilter}
            autoClearSearchValue={false}
            onChange={(value) => onInputChange('model', value)}
            value={inputs.model}
            autoComplete='new-password'
            optionList={models}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
            disabled={customRequestMode}
          />
        </div>

        {/* 图片URL输入 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          {isImageUploadAllowed ? (
            <ImageUrlInput
              imageUrls={inputs.imageUrls}
              imageEnabled={inputs.imageEnabled}
              onImageUrlsChange={(urls) => onInputChange('imageUrls', urls)}
              onImageEnabledChange={(enabled) =>
                onInputChange('imageEnabled', enabled)
              }
              disabled={customRequestMode}
            />
          ) : (
            <Typography.Text type='tertiary'>
              {t('当前模型暂不支持上传图片。')}
            </Typography.Text>
          )}
        </div>

        {/* 参数控制组件 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <ParameterControl
            inputs={inputs}
            parameterEnabled={parameterEnabled}
            onInputChange={onInputChange}
            onParameterToggle={onParameterToggle}
            disabled={customRequestMode}
          />
        </div>

        {/* 视频参数（仅视频模型显示） */}
        {isGrokImagineImageModel && !isGrokImagineImageEditModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div>
              <Typography.Text strong className='text-sm'>
                {t('图片尺寸')}
              </Typography.Text>
              <Select
                className='!rounded-lg mt-2'
                optionList={grokImageRatioOptions}
                value={normalizeGrokImageSize(inputs.imageSize || '1024x1024')}
                onChange={(value) => onInputChange('imageSize', value)}
                disabled={customRequestMode}
              />
            </div>
          </div>
        )}
        {isGrokImagineImageEditModel && (
          <div>
            <Typography.Text type='tertiary'>
              {t('单图编辑默认跟随上传图片比例，xAI 不支持在这里强制改尺寸。')}
            </Typography.Text>
          </div>
        )}

        {isAdobeImageModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  Aspect Ratio
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={currentAdobeAspectRatioOptions}
                  value={
                    inputs.aspectRatio ||
                    currentAdobeAspectRatioOptions[0]?.value ||
                    '1:1'
                  }
                  onChange={(value) => onInputChange('aspectRatio', value)}
                  disabled={customRequestMode}
                />
              </div>
              {currentAdobeSupportsAutoImageSize &&
                (inputs.aspectRatio || 'auto') === 'auto' && (
                <div>
                  <Typography.Text strong className='text-sm'>
                    Auto Size
                  </Typography.Text>
                  <Select
                    className='!rounded-lg mt-2'
                    optionList={adobeAutoImageSizeOptions}
                    value={inputs.autoImageSize || '1024x1024'}
                    onChange={(value) => onInputChange('autoImageSize', value)}
                    disabled={customRequestMode}
                  />
                </div>
              )}
              {!isGPTImage2Model && (
                <div>
                  <Typography.Text strong className='text-sm'>
                    Output Resolution
                  </Typography.Text>
                  <Select
                    className='!rounded-lg mt-2'
                    optionList={adobeOutputResolutionOptions}
                    value={inputs.outputResolution || '2K'}
                    onChange={(value) => onInputChange('outputResolution', value)}
                    disabled={customRequestMode}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isVideoModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  {t('视频尺寸')}
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={grokVideoRatioOptions}
                  value={inputs.videoSize}
                  onChange={(value) => onInputChange('videoSize', value)}
                  disabled={customRequestMode}
                />
              </div>
              <div>
                <Typography.Text strong className='text-sm'>
                  {t('视频时长')}
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={videoSecondsOptions}
                  value={inputs.videoSeconds}
                  onChange={(value) => onInputChange('videoSeconds', value)}
                  disabled={customRequestMode}
                />
              </div>
              {isGrokImagineVideoModel && (
                <div>
                  <Typography.Text strong className='text-sm'>
                    {t('风格预设')}
                  </Typography.Text>
                  <Select
                    className='!rounded-lg mt-2'
                    optionList={videoPresetOptions}
                    value={inputs.videoPreset || 'normal'}
                    onChange={(value) => onInputChange('videoPreset', value)}
                    disabled={customRequestMode}
                  />
                </div>
              )}
              <div>
                <Typography.Text strong className='text-sm'>
                  {t('视频质量')}
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={videoQualityOptions}
                  value={
                    inputs.videoQuality === 'high'
                      ? '720p'
                      : inputs.videoQuality === 'standard'
                        ? '480p'
                        : inputs.videoQuality
                  }
                  onChange={(value) => onInputChange('videoQuality', value)}
                  disabled={customRequestMode}
                />
              </div>
            </div>
          </div>
        )}

        {isAdobeVideoModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  Duration
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={currentAdobeVideoDurationOptions}
                  value={selectedAdobeVideoDuration}
                  onChange={(value) => onInputChange('videoDuration', value)}
                  disabled={customRequestMode}
                />
              </div>
              <div>
                <Typography.Text strong className='text-sm'>
                  Aspect Ratio
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={currentAdobeVideoAspectRatioOptions}
                  value={selectedAdobeVideoAspectRatio}
                  onChange={(value) => onInputChange('aspectRatio', value)}
                  disabled={customRequestMode}
                />
              </div>
              {isAdobeVeoModel && (
                <div>
                  <Typography.Text strong className='text-sm'>
                    Resolution
                  </Typography.Text>
                  <Select
                    className='!rounded-lg mt-2'
                    optionList={adobeVideoResolutionOptions}
                    value={inputs.videoResolution || '1080p'}
                    onChange={(value) => onInputChange('videoResolution', value)}
                    disabled={customRequestMode}
                  />
                </div>
              )}
              {inputs.model === 'veo31' && (
                <div>
                  <Typography.Text strong className='text-sm'>
                    Reference Mode
                  </Typography.Text>
                  <Select
                    className='!rounded-lg mt-2'
                    optionList={adobeReferenceModeOptions}
                    value={inputs.referenceMode || 'frame'}
                    onChange={(value) => onInputChange('referenceMode', value)}
                    disabled={customRequestMode}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 流式输出开关 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <ToggleLeft size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('流式输出')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <Switch
              checked={inputs.stream}
              onChange={(checked) => onInputChange('stream', checked)}
              checkedText={t('开')}
              uncheckedText={t('关')}
              size='small'
              disabled={customRequestMode}
            />
          </div>
        </div>
      </div>

      {/* 桌面端的配置管理放在底部 */}
      {!styleState.isMobile && (
        <div className='flex-shrink-0 pt-3'>
          <ConfigManager
            currentConfig={currentConfig}
            onConfigImport={onConfigImport}
            onConfigReset={onConfigReset}
            styleState={styleState}
            messages={messages}
          />
        </div>
      )}
    </Card>
  );
};

export default SettingsPanel;
