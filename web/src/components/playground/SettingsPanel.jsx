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

  const currentConfig = {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0b0b0b] border-l border-gray-200 dark:border-gray-800">
      <div className={`flex flex-col h-full ${styleState.isMobile ? 'p-4' : 'p-6'}`}>
        {/* 标题区域 - 与调试面板保持一致 */}
        <div className='flex items-center justify-between mb-6 flex-shrink-0'>
          <div className='flex items-center'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shadow-sm'>
              <Settings size={18} className='text-white' />
            </div>
            <Typography.Title heading={6} className='!mb-0 text-gray-900 dark:text-white font-semibold'>
              {t('Model Settings')}
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

        <div className='space-y-6 overflow-y-auto flex-1 pr-1 model-settings-scroll'>
          {/* 自定义请求体编辑器 */}
          <CustomRequestEditor
            customRequestMode={customRequestMode}
            customRequestBody={customRequestBody}
            onCustomRequestModeChange={onCustomRequestModeChange}
            onCustomRequestBodyChange={onCustomRequestBodyChange}
            defaultPayload={previewPayload}
          />

          {/* 分组选择 */}
          <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <Users size={14} className='text-gray-500' />
              <Typography.Text strong className='text-sm text-gray-700 dark:text-gray-300'>
                {t('Group')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('Ignored in custom mode')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('Select group')}
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
              className='!rounded-lg !bg-gray-50 dark:!bg-[#1a1a1a] !border-gray-200 dark:!border-gray-700'
              disabled={customRequestMode}
            />
          </div>

          {/* 模型选择 */}
          <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <Sparkles size={14} className='text-gray-500' />
              <Typography.Text strong className='text-sm text-gray-700 dark:text-gray-300'>
                {t('Model')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('Ignored in custom mode')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('Select model')}
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
              className='!rounded-lg !bg-gray-50 dark:!bg-[#1a1a1a] !border-gray-200 dark:!border-gray-700'
              disabled={customRequestMode}
            />
          </div>

          {/* 图片URL输入 */}
          <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
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

          {/* 参数控制组件 */}
          <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
            <ParameterControl
              inputs={inputs}
              parameterEnabled={parameterEnabled}
              onInputChange={onInputChange}
              onParameterToggle={onParameterToggle}
              disabled={customRequestMode}
            />
          </div>

          {/* 流式输出开关 */}
          <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
            <div className='flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-800'>
              <div className='flex items-center gap-2'>
                <ToggleLeft size={16} className='text-gray-500' />
                <Typography.Text strong className='text-sm text-gray-700 dark:text-gray-300'>
                  {t('Stream Response')}
                </Typography.Text>
                {customRequestMode && (
                  <Typography.Text className='text-xs text-orange-600'>
                    ({t('Ignored in custom mode')})
                  </Typography.Text>
                )}
              </div>
              <Switch
                checked={inputs.stream}
                onChange={(checked) => onInputChange('stream', checked)}
                checkedText={t('On')}
                uncheckedText={t('Off')}
                size='small'
                disabled={customRequestMode}
              />
            </div>
          </div>
        </div>

        {/* 桌面端的配置管理放在底部 */}
        {!styleState.isMobile && (
          <div className='flex-shrink-0 pt-4 mt-2 border-t border-gray-100 dark:border-gray-800'>
            <ConfigManager
              currentConfig={currentConfig}
              onConfigImport={onConfigImport}
              onConfigReset={onConfigReset}
              styleState={styleState}
              messages={messages}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
