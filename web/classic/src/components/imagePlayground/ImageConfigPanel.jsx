import React from 'react';
import {
  Card,
  Select,
  Typography,
  Tooltip,
  InputNumber,
  TextArea,
  Switch,
} from '@douyinfe/semi-ui';
import {
  Settings,
  Users,
  Sparkles,
  Ruler,
  HelpCircle,
  Shuffle,
  Ban,
  Gauge,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renderGroupOption, selectFilter } from '../../helpers';
import ImageUrlInput from '../playground/ImageUrlInput';
import {
  IMAGE_MAX_EDIT_IMAGES,
  supportsImageQualityMode,
} from '../../constants/imagePlayground.constants';

const ImageConfigPanel = ({
  isI2I = false,
  inputs,
  groups,
  models,
  availableSizes,
  onInputChange,
  disabled = false,
  styleState,
}) => {
  const { t } = useTranslation();

  // 锁定时当前值可能已不在选项列表里，补进去以保证仍能正常显示
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
      {/* 标题 */}
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
              content={t('仅展示包含图片生成模型的分组。')}
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
              content={t('仅展示具备图片生成能力的模型。')}
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
            emptyContent={t('当前分组下暂无图片模型')}
            disabled={disabled}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
          />
        </div>

        {/* 底图上传（仅图生图;锁定/历史态不展示,底图沿用该会话首条） */}
        {isI2I && !disabled && (
          <ImageUrlInput
            label={t('上传底图')}
            tooltip={t('最多上传 {{count}} 张底图', {
              count: IMAGE_MAX_EDIT_IMAGES,
            })}
            required
            maxCount={IMAGE_MAX_EDIT_IMAGES}
            imageUrls={inputs.imageUrls || []}
            imageEnabled={true}
            onImageUrlsChange={(v) =>
              onInputChange(
                'imageUrls',
                (v || []).slice(0, IMAGE_MAX_EDIT_IMAGES),
              )
            }
            onImageEnabledChange={() => {}}
            disabled={false}
          />
        )}

        {/* 图片尺寸（图生图跟随参考图，不显示、不下发） */}
        {!isI2I && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <Ruler size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('图片尺寸')}
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
        )}

        {/* 负向提示词 */}
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Ban size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('负向提示词')}
            </Typography.Text>
            <Tooltip
              content={t("Describe what you don't want included in the image.")}
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

        {/* 质量档(bot_task)—— 常驻,默认关。开关不按模型名拦截:渠道映射可能把当前
            模型指向 HunyuanImage-3.0,前端看不到映射结果,只用模型名做提示。 */}
        <div>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Gauge size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('质量档')}
              </Typography.Text>
              <Tooltip
                content={t(
                  '仅对 hunyuan-image-3 生效：开启后模型会先思考并改写提示词再生成，出图更贴合描述，但生成时长会明显增加（约 2.8 倍）。其他图片模型（如 z-image、qwen-image-edit）没有该能力，开启也不会有任何效果。默认关闭。',
                )}
                position='top'
                style={{ maxWidth: 320 }}
              >
                <HelpCircle size={14} className='text-gray-400 cursor-help' />
              </Tooltip>
            </div>
            <Switch
              checked={!!inputs.qualityMode}
              onChange={(checked) => onInputChange('qualityMode', checked)}
              checkedText={t('开')}
              uncheckedText={t('关')}
              size='small'
              disabled={disabled}
            />
          </div>
          {!supportsImageQualityMode(inputs.model) && (
            <Typography.Text className='text-xs text-gray-400'>
              {t('当前模型不是 hunyuan-image-3，仅在渠道已映射到该模型时生效')}
            </Typography.Text>
          )}
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

export default ImageConfigPanel;
