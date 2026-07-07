import React from 'react';
import {
  Card,
  Select,
  Typography,
  Tooltip,
  InputNumber,
  TextArea,
} from '@douyinfe/semi-ui';
import {
  Settings,
  Users,
  Sparkles,
  Ruler,
  Clock,
  HelpCircle,
  Shuffle,
  Ban,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renderGroupOption, selectFilter } from '../../helpers';
import ImageUrlInput from '../playground/ImageUrlInput';

const VideoConfigPanel = ({
  needsImage = false,
  isFLF2V = false,
  inputs,
  groups,
  models,
  availableSizes,
  availableDurations,
  onInputChange,
  disabled = false,
  styleState,
}) => {
  const { t } = useTranslation();

  // 单帧上传槽:ImageUrlInput 管理数组,这里只取最后一张作为该槽的单帧。
  // 帧图仅在 i2v/flf2v 模式渲染,均为必填 → 单行标签(上传首帧/尾帧)+ 红星,无启用开关。
  const renderFrameSlot = (label, key) => (
    <ImageUrlInput
      label={label}
      required
      imageUrls={inputs[key] ? [inputs[key]] : []}
      imageEnabled={true}
      onImageUrlsChange={(v) =>
        onInputChange(key, (v && v.length ? v[v.length - 1] : '') || '')
      }
      onImageEnabledChange={() => {}}
      disabled={false}
    />
  );

  const ensureOption = (options, value) => {
    if (!value) return options;
    return options.some((o) => o.value === value)
      ? options
      : [...options, { label: value, value }];
  };

  const groupOptions = ensureOption(groups || [], inputs.group);
  const modelOptions = ensureOption(models || [], inputs.model);
  const sizeOptions = ensureOption(
    (availableSizes || []).map((s) => ({ label: s, value: s })),
    inputs.size,
  );
  const durationOptions = ensureOption(
    (availableDurations || []).map((s) => ({ label: `${s}s`, value: s })),
    inputs.seconds,
  );

  return (
    <Card
      className='h-full flex flex-col'
      bordered={false}
      bodyStyle={{
        padding: styleState?.isMobile ? '16px' : '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className='flex items-center mb-6 flex-shrink-0'>
        <div className='w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3'>
          <Settings size={20} className='text-white' />
        </div>
        <Typography.Title heading={5} className='mb-0'>
          {t('模型配置')}
        </Typography.Title>
      </div>

      <div className='space-y-6 overflow-y-auto flex-1 pr-2'>
        {/* 分组 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Users size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('分组')}
            </Typography.Text>
            <Tooltip
              content={t('仅展示包含视频生成模型的分组。')}
              position='top'
            >
              <HelpCircle size={14} className='text-gray-400 cursor-help' />
            </Tooltip>
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
            optionList={groupOptions}
            renderOptionItem={renderGroupOption}
            disabled={disabled}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
          />
        </div>

        {/* 模型 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Sparkles size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('模型')}
            </Typography.Text>
            <Tooltip
              content={t('仅展示具备视频生成能力的模型。')}
              position='top'
            >
              <HelpCircle size={14} className='text-gray-400 cursor-help' />
            </Tooltip>
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
            optionList={modelOptions}
            emptyContent={t('当前分组下暂无视频模型')}
            disabled={disabled}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
          />
        </div>

        {/* 帧图上传(图生视频:首帧;首尾帧:首帧+尾帧;锁定/历史态不展示) */}
        {needsImage &&
          !disabled &&
          renderFrameSlot(
            isFLF2V ? t('上传首帧') : t('上传首帧/参考图'),
            'firstFrame',
          )}
        {isFLF2V && !disabled && renderFrameSlot(t('上传尾帧'), 'lastFrame')}

        {/* 尺寸 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Ruler size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('视频尺寸')}
            </Typography.Text>
          </div>
          <Select
            placeholder={t('请选择尺寸')}
            name='size'
            selection
            onChange={(value) => onInputChange('size', value)}
            value={inputs.size}
            optionList={sizeOptions}
            disabled={disabled}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
          />
        </div>

        {/* 时长 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Clock size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('视频时长')}
            </Typography.Text>
          </div>
          <Select
            placeholder={t('请选择时长')}
            name='seconds'
            selection
            onChange={(value) => onInputChange('seconds', value)}
            value={inputs.seconds}
            optionList={durationOptions}
            disabled={disabled}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
          />
        </div>

        {/* 负向提示词(默认预填 Wan 推荐值) */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Ban size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('负向提示词')}
            </Typography.Text>
            <Tooltip
              content={t(
                "Describe what you don't want included in the videos.",
              )}
              position='top'
            >
              <HelpCircle size={14} className='text-gray-400 cursor-help' />
            </Tooltip>
          </div>
          <TextArea
            placeholder={t('负向提示词(可选)')}
            name='negativePrompt'
            value={inputs.negativePrompt || ''}
            onChange={(value) => onInputChange('negativePrompt', value)}
            autosize={{ minRows: 2, maxRows: 6 }}
            disabled={disabled}
            className='!rounded-lg'
          />
        </div>

        {/* 随机种子(seed)—— 常驻,留空为随机 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Shuffle size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('随机种子')}
            </Typography.Text>
            <Typography.Text className='text-xs text-gray-400'>
              ({t('留空为随机')})
            </Typography.Text>
          </div>
          <InputNumber
            placeholder={t('留空为随机')}
            name='seed'
            min={0}
            precision={0}
            value={
              inputs.seed === '' || inputs.seed == null
                ? undefined
                : inputs.seed
            }
            onChange={(value) =>
              onInputChange('seed', value === '' || value == null ? '' : value)
            }
            disabled={disabled}
            style={{ width: '100%' }}
            className='!rounded-lg'
          />
        </div>
      </div>
    </Card>
  );
};

export default VideoConfigPanel;
