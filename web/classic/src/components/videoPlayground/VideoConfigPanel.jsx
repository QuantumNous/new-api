import React from 'react';
import {
  Card,
  Select,
  Switch,
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
  Proportions,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renderGroupOption, selectFilter } from '../../helpers';
import ImageUrlInput from '../playground/ImageUrlInput';
import MediaFileInput from './MediaFileInput';

const VideoConfigPanel = ({
  needsImage = false,
  followsInput = false,
  isI2V = false,
  isFLF2V = false,
  isS2V = false,
  isSR = false,
  isDub = false,
  isVACE = false,
  dubAvailable = false,
  maxRefImages = 5,
  maxInputMB = 0,
  inputs,
  groups,
  models,
  availableSizes,
  availableDurations,
  availableAspectRatios,
  onInputChange,
  disabled = false,
  styleState,
}) => {
  const { t } = useTranslation();

  // 输入大小上限(MB):直接透传 maxInputMB。0/未配 = 不限(与配置页「留空/0 不限」及
  // 后端一致);>0 时各上传控件按它拦。不再套前端兜底默认,避免和「显式不限」冲突。
  const uploadMaxMB = maxInputMB;

  // 单帧上传槽:ImageUrlInput 管理数组,这里只取最后一张作为该槽的单帧。
  // 帧图仅在 i2v/flf2v 模式渲染,均为必填 → 单行标签(上传首帧/尾帧)+ 红星,无启用开关。
  // 只读图片预览(锁定/历史态)。ImageUrlInput 的图片列表在 disabled 时会被整体隐藏
  // (isActive = imageEnabled && !disabled),不能用来做只读展示;锁定态改用纯 <img>。
  const renderImagePreview = (label, urls) => (
    <div>
      <div className='flex items-center gap-1 mb-2'>
        <Typography.Text strong className='text-sm'>
          {label}
        </Typography.Text>
      </div>
      <div className='flex flex-wrap gap-2'>
        {(urls || []).filter(Boolean).map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${label}-${i + 1}`}
            className='w-20 h-20 object-cover rounded-lg border border-gray-200'
          />
        ))}
      </div>
    </div>
  );

  // 单帧槽:未锁定=可编辑上传(ImageUrlInput);锁定/历史=只读预览已上传帧。
  const renderFrameSlot = (label, key, opts = {}) =>
    disabled ? (
      inputs[key] ? (
        renderImagePreview(label, [inputs[key]])
      ) : null
    ) : (
      <ImageUrlInput
        label={label}
        required={!opts.optional}
        maxMB={uploadMaxMB}
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
  const aspectRatioOptions = ensureOption(
    (availableAspectRatios || []).map((r) => ({ label: r, value: r })),
    inputs.aspectRatio,
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

        {/* 主图上传(图生视频:首帧;首尾帧:首帧+尾帧;数字人:人物图)。锁定/历史态改为
            只读展示已上传的文件(disabled 透传,ImageUrlInput/MediaFileInput 仍渲染预览/播放器);
            未上传的可选项在锁定态不展示,避免空的禁用上传框。 */}
        {needsImage &&
          (!disabled || inputs.firstFrame) &&
          renderFrameSlot(
            isS2V
              ? t('上传人物图')
              : isFLF2V
                ? t('上传首帧')
                : t('上传首帧/参考图'),
            'firstFrame',
          )}
        {/* 关键帧:尾帧可选 —— 仅首帧走 i2v,首+尾帧走 flf2v(提交时派生)。 */}
        {isFLF2V &&
          (!disabled || inputs.lastFrame) &&
          renderFrameSlot(t('上传尾帧（可选）'), 'lastFrame', { optional: true })}

        {/* 数字人:驱动音频(必填) */}
        {isS2V && (!disabled || inputs.audioData) && (
          <MediaFileInput
            label={t('上传驱动音频')}
            required
            kind='audio'
            maxMB={uploadMaxMB}
            value={inputs.audioData}
            disabled={disabled}
            onChange={(v) => onInputChange('audioData', v)}
          />
        )}

        {/* 视频超分:源视频(必填)+ 超分倍率;视频配乐:仅源视频(必填,复用同一输入)。 */}
        {(isSR || isDub) && (!disabled || inputs.sourceVideo) && (
          <>
            <MediaFileInput
              label={t(isDub ? '上传待配音视频' : '上传源视频')}
              required
              kind='video'
              value={inputs.sourceVideo}
              maxMB={uploadMaxMB}
              disabled={disabled}
              onChange={(v) => onInputChange('sourceVideo', v)}
            />
            {isSR && (
              <div>
                <div className='flex items-center gap-2 mb-2'>
                  <Ruler size={16} className='text-gray-500' />
                  <Typography.Text strong className='text-sm'>
                    {t('超分倍率')}
                  </Typography.Text>
                </div>
                <InputNumber
                  min={1}
                  max={4}
                  step={0.25}
                  value={inputs.srRatio}
                  onChange={(v) => onInputChange('srRatio', v == null ? 2 : v)}
                  disabled={disabled}
                  style={{ width: '100%' }}
                  className='!rounded-lg'
                />
              </div>
            )}
          </>
        )}

        {/* 图生视频(Bernini r2v):参考图 1~3 张(必填),定义主体/服装/道具/场景。 */}
        {isI2V && (
          <>
            {!disabled && (
              <ImageUrlInput
                label={t('上传参考图（必填，最多 {{count}} 张）', {
                  count: maxRefImages,
                })}
                maxMB={uploadMaxMB}
                imageUrls={inputs.refImages || []}
                imageEnabled={true}
                onImageUrlsChange={(v) =>
                  onInputChange('refImages', (v || []).slice(0, maxRefImages))
                }
                onImageEnabledChange={() => {}}
                disabled={false}
              />
            )}
            {disabled &&
              (inputs.refImages || []).length > 0 &&
              renderImagePreview(t('参考图'), inputs.refImages)}
          </>
        )}

        {/* 视频编辑(Bernini):≥1 源视频(必填),1 视频=v2v、1 视频+参考图=rv2v、
            2 视频=mv2v(广告植入 ads2v 走示例显式指定);仅参考图的 r2v 已迁到图生视频。 */}
        {isVACE && (
          <>
            {(!disabled || inputs.srcVideo) && (
              <MediaFileInput
                label={t('上传源视频')}
                required
                kind='video'
                value={inputs.srcVideo}
                maxMB={uploadMaxMB}
                disabled={disabled}
                onChange={(v) => onInputChange('srcVideo', v)}
              />
            )}
            {(!disabled || inputs.srcVideo2) && (
              <MediaFileInput
                label={t('上传第二视频（可选，双视频=多源编辑）')}
                kind='video'
                value={inputs.srcVideo2}
                maxMB={uploadMaxMB}
                disabled={disabled}
                onChange={(v) => onInputChange('srcVideo2', v)}
              />
            )}
            {!disabled && (
              <ImageUrlInput
                label={t('上传参考图（可选，最多 {{count}} 张）', {
                  count: maxRefImages,
                })}
                maxMB={uploadMaxMB}
                imageUrls={inputs.refImages || []}
                imageEnabled={true}
                onImageUrlsChange={(v) =>
                  onInputChange('refImages', (v || []).slice(0, maxRefImages))
                }
                onImageEnabledChange={() => {}}
                disabled={false}
              />
            )}
            {disabled &&
              (inputs.refImages || []).length > 0 &&
              renderImagePreview(t('参考图'), inputs.refImages)}
          </>
        )}

        {/* 视频尺寸/分辨率(仅文生视频,且该模型在后台配了尺寸才展示;图生视频跟随参考图) */}
        {!followsInput && (availableSizes || []).length > 0 && (
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
            {/1080/i.test(inputs.size || '') && (
              <Typography.Text className='text-xs text-amber-600 mt-1 block'>
                {t(
                  '1080P 将先生成再调用超分模型提升画质：耗时更久，且会同时产生本模型与超分模型的额度/积分消耗',
                )}
              </Typography.Text>
            )}
          </div>
        )}

        {/* 宽高比(仅文生视频,且该模型在后台配了宽高比才展示;wan 下由此决定输出分辨率) */}
        {!followsInput && (availableAspectRatios || []).length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <Proportions size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('宽高比')}
              </Typography.Text>
            </div>
            <Select
              placeholder={t('请选择宽高比')}
              name='aspectRatio'
              selection
              onChange={(value) => onInputChange('aspectRatio', value)}
              value={inputs.aspectRatio}
              optionList={aspectRatioOptions}
              disabled={disabled}
              style={{ width: '100%' }}
              dropdownStyle={{ width: '100%', maxWidth: '100%' }}
              className='!rounded-lg'
            />
          </div>
        )}

        {/* 时长(超分/配乐输出时长跟随源视频,不展示) */}
        {!isSR && !isDub && (
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
        )}

        {/* 负向提示词(默认留空;超分无提示词,不展示) */}
        {!isSR && (
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
        )}

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

        {/* 插帧(RIFE 帧率翻倍)——超分/配乐不适用;默认关,开启才透传 target_fps */}
        {!isSR && !isDub && (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Typography.Text strong className='text-sm'>
                {t('插帧')}
              </Typography.Text>
              <Typography.Text className='text-xs text-gray-400'>
                ({t('帧率翻倍，生成更流畅')})
              </Typography.Text>
            </div>
            <Switch
              checked={!!inputs.interpolation}
              onChange={(v) => onInputChange('interpolation', v)}
              disabled={disabled}
              size='small'
            />
          </div>
        )}

        {/* 配音(v2a/LTX-2.3)——默认关;开启则生成后自动为成片配上 AI 音轨 */}
        {dubAvailable && (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Typography.Text strong className='text-sm'>
                {t('配音')}
              </Typography.Text>
              <Typography.Text className='text-xs text-gray-400'>
                ({t('生成后自动配音，耗时更久，额外消耗配音模型额度')})
              </Typography.Text>
            </div>
            <Switch
              checked={!!inputs.dubbing}
              onChange={(v) => onInputChange('dubbing', v)}
              disabled={disabled}
              size='small'
            />
          </div>
        )}

        {/* 配音提示词（可选）：开配音后可描述想要的声音；留空则模型按画面自由配音 */}
        {dubAvailable && inputs.dubbing && (
          <TextArea
            placeholder={t(
              '配音提示词（可选）：描述想要的声音，如「舒缓的钢琴背景乐」；留空则按画面自动配音',
            )}
            value={inputs.dubPrompt || ''}
            onChange={(value) => onInputChange('dubPrompt', value)}
            disabled={disabled}
            autosize={{ minRows: 2, maxRows: 4 }}
            maxCount={500}
            className='!rounded-lg'
          />
        )}
      </div>
    </Card>
  );
};

export default VideoConfigPanel;
