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

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Button,
  InputNumber,
  Select,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  Bot,
  ChevronDown,
  Image as ImageIcon,
  Sparkles,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayground } from '../../contexts/PlaygroundContext';
import { selectFilter } from '../../helpers';

const PlaygroundComposer = ({
  detailProps,
  inputs,
  models,
  videoModels,
  playgroundMode,
  customRequestMode,
  onInputChange,
  onModeChange,
}) => {
  const { t } = useTranslation();
  const { onPasteImage, imageEnabled } = usePlayground();
  const containerRef = useRef(null);
  const { inputNode, sendNode, onClick } = detailProps;

  const handlePaste = useCallback(
    async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();
          const file = item.getAsFile();

          if (!file) break;

          if (!imageEnabled) {
            Toast.warning({
              content: t('请先启用图片模式'),
              duration: 3,
            });
            return;
          }

          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            onPasteImage(readerEvent.target.result);
            Toast.success({
              content: t('图片已添加'),
              duration: 2,
            });
          };
          reader.onerror = () => {
            Toast.error({
              content: t('粘贴图片失败'),
              duration: 2,
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [imageEnabled, onPasteImage, t],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste);
    return () => {
      container.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const styledSendNode = React.cloneElement(sendNode, {
    className: `composer-send-button ${sendNode.props.className || ''}`,
  });

  const isVideoMode = playgroundMode === 'video';
  const modelOptions = isVideoMode ? videoModels : models;
  const selectedModel = isVideoMode ? inputs.videoModel : inputs.model;

  return (
    <div className='new-playground-composer-wrap' ref={containerRef}>
      <div className='new-playground-composer' onClick={onClick}>
        <div className='composer-input-row'>{inputNode}</div>
        <div className='composer-controls'>
          <div className='composer-left-controls'>
            <Select
              value={selectedModel}
              optionList={modelOptions}
              filter={selectFilter}
              autoClearSearchValue={false}
              disabled={customRequestMode}
              onChange={(value) =>
                onInputChange(isVideoMode ? 'videoModel' : 'model', value)
              }
              prefix={<Bot size={16} />}
              suffix={<ChevronDown size={15} />}
              className='composer-model-select'
              dropdownStyle={{ maxWidth: 420 }}
            />
            <div className='reference-images'>
              <Typography.Text className='reference-label'>
                {t('参考图片')}
              </Typography.Text>
              <button
                className={`reference-upload ${inputs.imageEnabled ? 'is-active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onInputChange('imageEnabled', !inputs.imageEnabled);
                }}
                type='button'
              >
                <ImageIcon size={20} />
              </button>
              <span>{t('支持 JPEG、PNG、Webp')}</span>
            </div>
            {isVideoMode && (
              <div className='video-options'>
                <Select
                  value={inputs.videoRatio}
                  optionList={[
                    { label: '16:9', value: '16:9' },
                    { label: '9:16', value: '9:16' },
                    { label: '1:1', value: '1:1' },
                    { label: '4:3', value: '4:3' },
                    { label: '3:4', value: '3:4' },
                  ]}
                  onChange={(value) => onInputChange('videoRatio', value)}
                  className='video-option-control'
                />
                <InputNumber
                  min={1}
                  max={30}
                  value={inputs.videoDuration}
                  suffix={t('秒')}
                  onChange={(value) => onInputChange('videoDuration', value)}
                  className='video-option-control'
                />
              </div>
            )}
          </div>

          <div className='composer-bottom-row'>
            <div className='mode-tabs'>
              <button
                className={`mode-tab ${playgroundMode === 'chat' ? 'active' : ''}`}
                type='button'
                onClick={(event) => {
                  event.stopPropagation();
                  onModeChange('chat');
                }}
              >
                <Sparkles size={19} />
                <span>{t('聊天')}</span>
              </button>
              <button
                className={`mode-tab ${inputs.imageEnabled ? 'active-soft' : ''}`}
                type='button'
                onClick={(event) => {
                  event.stopPropagation();
                  onInputChange('imageEnabled', true);
                }}
              >
                <ImageIcon size={18} />
                <span>{t('图片')}</span>
              </button>
              <button
                className={`mode-tab ${playgroundMode === 'video' ? 'active' : ''}`}
                type='button'
                onClick={(event) => {
                  event.stopPropagation();
                  onModeChange('video');
                }}
              >
                <Video size={18} />
                <span>{t('视频')}</span>
              </button>
            </div>
            {styledSendNode}
          </div>
        </div>
      </div>
      <div className='composer-disclaimer'>
        {t('AI 可能会出错，请核实重要信息。')}
      </div>
    </div>
  );
};

export default PlaygroundComposer;
