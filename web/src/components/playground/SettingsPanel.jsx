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

import React from 'react';
import { Button, Card, Select, Switch, Typography } from '@douyinfe/semi-ui';
import {
  Clapperboard,
  ImagePlus,
  MessageSquareText,
  Settings,
  Sparkles,
  ToggleLeft,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  isAdobeImage4KModel,
  isAdobeImageModel,
  isAdobeSoraModel,
  isAdobeVeoModel,
  isAdobeVideoModel,
  isGrokImagineImageModel,
  isGrokImagineVideoModel,
  isVideoModeModel,
  PLAYGROUND_MODES,
  renderGroupOption,
  selectFilter,
} from '../../helpers';
import ConfigManager from './ConfigManager';
import CustomRequestEditor from './CustomRequestEditor';
import ImageUrlInput from './ImageUrlInput';
import ParameterControl from './ParameterControl';

const MODE_SUMMARY_STYLES = {
  [PLAYGROUND_MODES.CHAT]: {
    icon: MessageSquareText,
    titleKey: '智能对话',
    descriptionKey: '围绕系统提示词、多轮消息和流式响应来组织创作。',
    accent: 'from-sky-500 to-cyan-400',
  },
  [PLAYGROUND_MODES.IMAGE]: {
    icon: ImagePlus,
    titleKey: '图片创作',
    descriptionKey:
      '优先调整图片尺寸、比例和参考图，让同一套操练场工作区更适合图像生成。',
    accent: 'from-amber-500 to-orange-400',
  },
  [PLAYGROUND_MODES.VIDEO]: {
    icon: Clapperboard,
    titleKey: '视频创作',
    descriptionKey: '聚焦视频时长、清晰度和参考模式，继续复用操练场现有视频生成链路。',
    accent: 'from-rose-500 to-fuchsia-500',
  },
};

const normalizeGrokImageSize = (size) => {
  if (size === '1536x1024') {
    return '1792x1024';
  }
  if (size === '1024x1536') {
    return '1024x1792';
  }
  return size;
};

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
  playgroundMode,
  modeHasAvailableModels,
}) => {
  const { t } = useTranslation();
  const modeSummary =
    MODE_SUMMARY_STYLES[playgroundMode] || MODE_SUMMARY_STYLES[PLAYGROUND_MODES.CHAT];
  const ModeIcon = modeSummary.icon;

  const isCurrentGrokImagineImageModel = isGrokImagineImageModel(inputs.model);
  const isCurrentAdobeImageModel = isAdobeImageModel(inputs.model);
  const isCurrentAdobeVideoModel = isAdobeVideoModel(inputs.model);
  const isCurrentAdobeImage4KModel = isAdobeImage4KModel(inputs.model);
  const isCurrentAdobeSoraModel = isAdobeSoraModel(inputs.model);
  const isCurrentAdobeVeoModel = isAdobeVeoModel(inputs.model);
  const isCurrentVideoModel = isVideoModeModel(inputs.model);
  const isCurrentGrokImagineVideoModel = isGrokImagineVideoModel(inputs.model);

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
  const videoSecondsOptions = [6, 8, 10, 12, 15, 20, 25, 30].map((value) => ({
    label: `${value}s`,
    value: String(value),
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
  const adobeAspectRatioOptions = [
    { label: 'Auto', value: 'auto' },
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
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
  ];
  const adobe4KResolutionOptions = [{ label: '4K', value: '4K' }];
  const adobeSoraDurationOptions = [4, 8, 12].map((value) => ({
    label: `${value}s`,
    value: String(value),
  }));
  const adobeVeoDurationOptions = [4, 6, 8].map((value) => ({
    label: `${value}s`,
    value: String(value),
  }));
  const adobeVideoResolutionOptions = [
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
  ];
  const adobeReferenceModeOptions = [
    { label: 'Frame', value: 'frame' },
    { label: 'Image', value: 'image' },
  ];

  const currentConfig = {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,
  };

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
        <div
          className={`rounded-2xl bg-gradient-to-br ${modeSummary.accent} p-[1px]`}
        >
          <div className='rounded-[15px] bg-white/95 px-4 py-4 backdrop-blur'>
            <div className='flex items-start gap-3'>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${modeSummary.accent} text-white shadow-sm`}
              >
                <ModeIcon size={18} />
              </div>
              <div className='min-w-0 flex-1'>
                <Typography.Text strong className='text-sm text-gray-900'>
                  {t(modeSummary.titleKey)}
                </Typography.Text>
                <Typography.Paragraph className='!mt-1 !mb-0 text-xs text-gray-600'>
                  {t(modeSummary.descriptionKey)}
                </Typography.Paragraph>
                {!modeHasAvailableModels && (
                  <Typography.Text className='mt-2 block text-xs text-amber-600'>
                    {t(
                      '当前账号下暂无适合此创作模式的模型，可切换模式或保留全量模型列表进行查看。',
                    )}
                  </Typography.Text>
                )}
              </div>
            </div>
          </div>
        </div>

        <CustomRequestEditor
          customRequestMode={customRequestMode}
          customRequestBody={customRequestBody}
          onCustomRequestModeChange={onCustomRequestModeChange}
          onCustomRequestBodyChange={onCustomRequestBodyChange}
          defaultPayload={previewPayload}
        />

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

        <div className={customRequestMode ? 'opacity-50' : ''}>
          <ImageUrlInput
            imageUrls={inputs.imageUrls}
            imageEnabled={inputs.imageEnabled}
            onImageUrlsChange={(urls) => onInputChange('imageUrls', urls)}
            onImageEnabledChange={(enabled) =>
              onInputChange('imageEnabled', enabled)
            }
            disabled={customRequestMode}
          />
        </div>

        <div className={customRequestMode ? 'opacity-50' : ''}>
          <ParameterControl
            inputs={inputs}
            parameterEnabled={parameterEnabled}
            onInputChange={onInputChange}
            onParameterToggle={onParameterToggle}
            disabled={customRequestMode}
          />
        </div>

        {isCurrentGrokImagineImageModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div>
              <Typography.Text strong className='text-sm'>
                {t('图片尺寸')}
              </Typography.Text>
              <Select
                className='!rounded-lg mt-2'
                optionList={imageSizeOptions}
                value={normalizeGrokImageSize(inputs.imageSize || '1024x1024')}
                onChange={(value) => onInputChange('imageSize', value)}
                disabled={customRequestMode}
              />
            </div>
          </div>
        )}

        {isCurrentAdobeImageModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  Aspect Ratio
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={adobeAspectRatioOptions}
                  value={inputs.aspectRatio || 'auto'}
                  onChange={(value) => onInputChange('aspectRatio', value)}
                  disabled={customRequestMode}
                />
              </div>
              {(inputs.aspectRatio || 'auto') === 'auto' && (
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
              <div>
                <Typography.Text strong className='text-sm'>
                  Output Resolution
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={
                    isCurrentAdobeImage4KModel
                      ? adobe4KResolutionOptions
                      : adobeOutputResolutionOptions
                  }
                  value={
                    isCurrentAdobeImage4KModel
                      ? '4K'
                      : inputs.outputResolution || '2K'
                  }
                  onChange={(value) =>
                    !isCurrentAdobeImage4KModel &&
                    onInputChange('outputResolution', value)
                  }
                  disabled={customRequestMode || isCurrentAdobeImage4KModel}
                />
              </div>
            </div>
          </div>
        )}

        {isCurrentVideoModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  {t('视频尺寸')}
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={videoSizeOptions}
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
              {isCurrentGrokImagineVideoModel && (
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

        {isCurrentAdobeVideoModel && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='space-y-4'>
              <div>
                <Typography.Text strong className='text-sm'>
                  Duration
                </Typography.Text>
                <Select
                  className='!rounded-lg mt-2'
                  optionList={
                    isCurrentAdobeSoraModel
                      ? adobeSoraDurationOptions
                      : adobeVeoDurationOptions
                  }
                  value={inputs.videoDuration || '4'}
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
                  optionList={adobeVideoAspectRatioOptions}
                  value={inputs.aspectRatio || '16:9'}
                  onChange={(value) => onInputChange('aspectRatio', value)}
                  disabled={customRequestMode}
                />
              </div>
              {isCurrentAdobeVeoModel && (
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
