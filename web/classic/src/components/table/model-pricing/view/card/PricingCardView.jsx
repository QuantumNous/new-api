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
import {
  Card,
  Tag,
  Checkbox,
  Empty,
  Pagination,
  Button,
  Avatar,
} from '@douyinfe/semi-ui';
import { Copy, ExternalLink } from 'lucide-react';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { stringToColor, getLobeHubIcon } from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';
import { renderLimitedItems } from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';
import { resetPricingFilters } from '../../../../../helpers/utils';
import { getModelType } from '../../utils/modelType';

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-xl flex items-center justify-center relative shadow-sm',
  icon: 'w-8 h-8 flex items-center justify-center',
  selected: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  default: 'border-semi-color-border hover:border-semi-color-primary',
};

const COVER_CLASS_BY_TYPE = {
  text: 'pricing-marketplace-cover-text',
  image: 'pricing-marketplace-cover-image',
  video: 'pricing-marketplace-cover-video',
  audio: 'pricing-marketplace-cover-audio',
  code: 'pricing-marketplace-cover-code',
  general: 'pricing-marketplace-cover-general',
};

const COVER_IMAGE_FIELDS = [
  'cover_url',
  'coverUrl',
  'cover',
  'coverImage',
  'cover_image',
  'image',
  'imageUrl',
  'image_url',
  'thumbnail',
  'thumbnailUrl',
  'thumbnail_url',
  'avatar',
  'avatarUrl',
  'avatar_url',
  'icon',
  'vendor_icon',
];

const COVER_VIDEO_FIELDS = ['preview_video_url', 'previewVideoUrl'];

const isUsableImageSource = (value) => {
  if (!value || typeof value !== 'string') return false;
  const source = value.trim();
  if (!source) return false;
  return (
    /^https?:\/\//i.test(source) ||
    source.startsWith('/') ||
    source.startsWith('data:image/') ||
    /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(source)
  );
};

const isUsableVideoSource = (value) => {
  if (!value || typeof value !== 'string') return false;
  const source = value.trim();
  if (!source) return false;
  return /^https?:\/\//i.test(source) || source.startsWith('/');
};

const getCoverImageSource = (model) => {
  if (!model) return '';
  const source = COVER_IMAGE_FIELDS.map((field) => model[field]).find(
    isUsableImageSource,
  );
  return typeof source === 'string' ? source.trim() : '';
};

const getCoverVideoSource = (model) => {
  if (!model) return '';
  const source = COVER_VIDEO_FIELDS.map((field) => model[field]).find(
    isUsableVideoSource,
  );
  return typeof source === 'string' ? source.trim() : '';
};

const ModelCardCover = ({
  model,
  coverClass,
  modelCapability,
  getModelIcon,
  copyText,
  rowSelection,
  isSelected,
  handleCheckboxChange,
  t,
}) => {
  const coverImageSource = React.useMemo(
    () => getCoverImageSource(model),
    [model],
  );
  const coverVideoSource = React.useMemo(
    () => getCoverVideoSource(model),
    [model],
  );
  const [imageFailed, setImageFailed] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const videoRef = React.useRef(null);
  const showVideo = coverVideoSource && !videoFailed;
  const showImage = !showVideo && coverImageSource && !imageFailed;
  const showMedia = showVideo || showImage;

  React.useEffect(() => {
    setImageFailed(false);
  }, [coverImageSource]);

  React.useEffect(() => {
    setVideoFailed(false);
  }, [coverVideoSource]);

  const handleVideoMouseEnter = () => {
    if (!videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  };

  const handleVideoMouseLeave = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    try {
      videoRef.current.currentTime = 0;
    } catch {
      // Some streams are not seekable before metadata is ready.
    }
  };

  return (
    <div
      className={`pricing-marketplace-card-cover ${coverClass} ${
        showMedia ? 'has-image' : ''
      }`}
      onMouseEnter={showVideo ? handleVideoMouseEnter : undefined}
      onMouseLeave={showVideo ? handleVideoMouseLeave : undefined}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          className='pricing-marketplace-cover-image-media pricing-marketplace-cover-video-media'
          src={coverVideoSource}
          poster={coverImageSource || undefined}
          muted
          playsInline
          preload='metadata'
          onError={() => setVideoFailed(true)}
        />
      ) : showImage ? (
        <img
          className='pricing-marketplace-cover-image-media'
          src={coverImageSource}
          alt={model?.model_name || ''}
          loading='lazy'
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <div className='pricing-marketplace-cover-pattern' />
          <div className='pricing-marketplace-cover-icon'>
            {getModelIcon(model)}
          </div>
        </>
      )}

      <Tag
        className='pricing-marketplace-cover-badge'
        color={modelCapability.color}
        size='small'
      >
        {modelCapability.label}
      </Tag>
      {showVideo && (
        <span className='pricing-marketplace-cover-video-badge'>
          {t('视频预览')}
        </span>
      )}
      <div className='pricing-marketplace-cover-actions'>
        <Button
          size='small'
          theme='outline'
          type='tertiary'
          icon={<Copy size={12} />}
          onClick={(event) => {
            event.stopPropagation();
            copyText(model.model_name);
          }}
        />

        {rowSelection && (
          <Checkbox
            checked={isSelected}
            onChange={(event) => {
              event.stopPropagation();
              handleCheckboxChange(model, event.target.checked);
            }}
          />
        )}
      </div>
    </div>
  );
};

const PricingCardView = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  copyText,
  showRatio,
  t,
  selectedRowKeys = [],
  setSelectedRowKeys,
  openModelDetail,
  handleChange,
  setShowWithRecharge,
  setCurrency,
  setShowRatio,
  setViewMode,
  setFilterGroup,
  setFilterQuotaType,
  setFilterEndpointType,
  setFilterVendor,
  setFilterTag,
  setFilterModelType,
  setSortBy,
  setTokenUnit,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = filteredModels.slice(
    startIndex,
    startIndex + pageSize,
  );
  const getModelKey = (model) => model.key ?? model.model_name ?? model.id;
  const isMobile = useIsMobile();
  const resetFilters = () =>
    resetPricingFilters({
      handleChange,
      setShowWithRecharge,
      setCurrency,
      setShowRatio,
      setViewMode,
      setFilterGroup,
      setFilterQuotaType,
      setFilterEndpointType,
      setFilterVendor,
      setFilterTag,
      setFilterModelType,
      setSortBy,
      setCurrentPage,
      setTokenUnit,
    });

  const handleCheckboxChange = (model, checked) => {
    if (!setSelectedRowKeys) return;
    const modelKey = getModelKey(model);
    const newKeys = checked
      ? Array.from(new Set([...selectedRowKeys, modelKey]))
      : selectedRowKeys.filter((key) => key !== modelKey);
    setSelectedRowKeys(newKeys);
    rowSelection?.onChange?.(newKeys, null);
  };

  const getModelIcon = (model) => {
    if (!model || !model.model_name) {
      return (
        <div className={CARD_STYLES.container}>
          <Avatar size='large'>?</Avatar>
        </div>
      );
    }

    if (model.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.icon, 32)}
          </div>
        </div>
      );
    }

    if (model.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    const avatarText = model.model_name.slice(0, 2).toUpperCase();
    return (
      <div className={CARD_STYLES.container}>
        <Avatar
          size='large'
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  const getModelCapability = (record) => {
    const type = getModelType(record);
    return {
      label: t(type.label),
      color: type.color,
      value: type.value,
    };
  };

  const getBillingHint = (record) => {
    if (record.quota_type === 1) return t('按次计费');
    if (record.quota_type === 0) return t('按量计费');
    return t('按站点配置计费');
  };

  const getModelDescription = (record) => {
    return (
      record.description ||
      t('该模型来自站点公开配置，具体可用范围以账号和分组配置为准。')
    );
  };

  const renderTags = (record) => {
    const customTags = [];
    if (record.tags) {
      const tagArr = String(record.tags)
        .split(/[,;|]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      tagArr.forEach((tag, idx) => {
        customTags.push(
          <Tag
            key={`custom-${idx}`}
            shape='circle'
            color={stringToColor(tag)}
            size='small'
          >
            {tag}
          </Tag>,
        );
      });
    }

    if (customTags.length === 0) {
      return (
        <Tag shape='circle' color='white' size='small'>
          {t('站点配置')}
        </Tag>
      );
    }

    return renderLimitedItems({
      items: customTags.map((tag, idx) => ({
        key: `custom-${idx}`,
        element: tag,
      })),
      renderItem: (item) => item.element,
      maxDisplay: 3,
    });
  };

  if (showSkeleton) {
    return (
      <PricingCardSkeleton
        rowSelection={!!rowSelection}
        showRatio={showRatio}
      />
    );
  }

  if (!filteredModels || filteredModels.length === 0) {
    return (
      <div className='flex justify-center items-center py-20'>
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          title={t('当前筛选条件下暂无模型')}
          description={t('请调整搜索词或清空筛选')}
          style={{ padding: 30 }}
        >
          {resetFilters && (
            <Button theme='solid' type='primary' onClick={resetFilters}>
              {t('清空筛选')}
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div className='pricing-marketplace-card-view'>
      <div className='pricing-marketplace-card-grid'>
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);
          const modelCapability = getModelCapability(model);
          const coverClass =
            COVER_CLASS_BY_TYPE[modelCapability.value] ||
            COVER_CLASS_BY_TYPE.general;

          return (
            <Card
              key={modelKey || index}
              className={`pricing-marketplace-model-card transition-all duration-200 hover:shadow-md border cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              bodyStyle={{ height: '100%', padding: 0 }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              <div className='flex h-full flex-col'>
                <ModelCardCover
                  model={model}
                  coverClass={coverClass}
                  modelCapability={modelCapability}
                  getModelIcon={getModelIcon}
                  copyText={copyText}
                  rowSelection={rowSelection}
                  isSelected={isSelected}
                  handleCheckboxChange={handleCheckboxChange}
                  t={t}
                />

                <div className='pricing-marketplace-card-body'>
                  <div className='pricing-marketplace-card-provider'>
                    {model.vendor_name || t('未知供应商')}
                  </div>
                  <h3 className='pricing-marketplace-card-title'>
                    {model.model_name}
                  </h3>
                  <p className='pricing-marketplace-card-description'>
                    {getModelDescription(model)}
                  </p>

                  <div className='pricing-marketplace-card-tags'>
                    {renderTags(model)}
                  </div>

                  <div className='pricing-marketplace-card-footer'>
                    <div>
                      <div className='text-xs font-medium text-semi-color-text-0'>
                        {getBillingHint(model)}
                      </div>
                      <div className='text-xs text-semi-color-text-2'>
                        {t('详情中可查看站点配置摘要')}
                      </div>
                    </div>
                    <Button
                      size='small'
                      theme='borderless'
                      type='primary'
                      icon={<ExternalLink size={13} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openModelDetail && openModelDetail(model);
                      }}
                    >
                      {t('查看详情')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredModels.length > 0 && (
        <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={filteredModels.length}
            showSizeChanger={true}
            pageSizeOptions={[10, 20, 50, 100]}
            size={isMobile ? 'small' : 'default'}
            showQuickJumper={isMobile}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PricingCardView;
