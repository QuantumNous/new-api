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
import { Button, Card, Checkbox, Chip, Pagination, Tooltip } from '@heroui/react';
import { CircleHelp, Copy } from 'lucide-react';
import { EmptyState } from '@heroui-pro/react';
import {
  IllustrationNoResult,
} from '@/components/common/ui/HeroIllustrationsCompat';
import {
  calculateModelPrice,
  formatPriceInfo,
  getLobeHubIcon,
} from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';
import { renderLimitedItems } from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md',
  icon: 'w-8 h-8 flex items-center justify-center',
  selected: 'border-blue-500 bg-blue-50',
  default: 'border-border hover:border-border',
};

const PricingCardView = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  selectedGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
  t,
  selectedRowKeys = [],
  setSelectedRowKeys,
  openModelDetail,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = filteredModels.slice(
    startIndex,
    startIndex + pageSize,
  );
  const getModelKey = (model) => model.key ?? model.model_name ?? model.id;
  const isMobile = useIsMobile();

  const handleCheckboxChange = (model, checked) => {
    if (!setSelectedRowKeys) return;
    const modelKey = getModelKey(model);
    const newKeys = checked
      ? Array.from(new Set([...selectedRowKeys, modelKey]))
      : selectedRowKeys.filter((key) => key !== modelKey);
    setSelectedRowKeys(newKeys);
    rowSelection?.onChange?.(newKeys, null);
  };

  // 获取模型图标
  const getModelIcon = (model) => {
    if (!model || !model.model_name) {
      return (
        <div className={CARD_STYLES.container}>
          <span className='text-base font-semibold text-foreground'>?</span>
        </div>
      );
    }
    // Prefer model custom icon.
    if (model.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.icon, 32)}
          </div>
        </div>
      );
    }
    // Fallback to vendor icon.
    if (model.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // Fallback to initials when no icon is available.

    const avatarText = model.model_name.slice(0, 2).toUpperCase();
    return (
      <div className={CARD_STYLES.container}>
        <span className='flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-foreground'>
          {avatarText}
        </span>
      </div>
    );
  };

  // Get model description.
  const getModelDescription = (record) => {
    return record.description || '';
  };

  // Render tags.
  const renderTags = (record) => {
    // 计费类型标签（左边）
    let billingTag = (
      <Chip key='billing' size='sm' variant='secondary'>
        -
      </Chip>
    );
    if (record.quota_type === 1) {
      billingTag = (
        <Chip key='billing' size='sm' color='success' variant='secondary'>
          {t('按次计费')}
        </Chip>
      );
    } else if (record.quota_type === 0) {
      billingTag = (
        <Chip key='billing' size='sm' color='secondary' variant='secondary'>
          {t('按量计费')}
        </Chip>
      );
    }

    // Custom tags.
    const customTags = [];
    if (record.tags) {
      const tagArr = record.tags.split(',').filter(Boolean);
      tagArr.forEach((tg, idx) => {
        customTags.push(
          <Chip
            key={`custom-${idx}`}
            size='sm'
            variant='secondary'
          >
            {tg}
          </Chip>,
        );
      });
    }

    return (
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>{billingTag}</div>
        <div className='flex items-center gap-1'>
          {customTags.length > 0 &&
            renderLimitedItems({
              items: customTags.map((tag, idx) => ({
                key: `custom-${idx}`,
                element: tag,
              })),
              renderItem: (item, idx) => item.element,
              maxDisplay: 3,
            })}
        </div>
      </div>
    );
  };

  // Show skeleton.
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
        <EmptyState size='sm'>
          <EmptyState.Header>
            <EmptyState.Media variant='illustration'>
              <IllustrationNoResult style={{ width: 120, height: 120 }} />
            </EmptyState.Media>
            <EmptyState.Title>{t('暂无内容')}</EmptyState.Title>
            <EmptyState.Description>{t('搜索无结果')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className='px-2 pt-2'>
      <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);

          const priceData = calculateModelPrice({
            record: model,
            selectedGroup,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
            quotaDisplayType: siteDisplayType,
          });

          return (
            <Card
              key={modelKey || index}
              className={`!rounded-2xl transition-all duration-200 hover:shadow-lg border cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              onPress={() => openModelDetail && openModelDetail(model)}
            >
              <Card.Content className='flex h-full flex-col p-6'>
                {/* Header: icon, model name, actions. */}
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex items-start space-x-3 flex-1 min-w-0'>
                    {getModelIcon(model)}
                    <div className='flex-1 min-w-0'>
                      <h3 className='text-lg font-bold text-foreground truncate'>
                        {model.model_name}
                      </h3>
                      <div className='flex flex-col gap-1 text-xs mt-1'>
                        {formatPriceInfo(priceData, t, siteDisplayType)}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center space-x-2 ml-3'>
                    {/* 复制按钮 */}
                    <Button
                      isIconOnly
                      size='sm'
                      variant='outline'
                      onPress={(e) => {
                        e.stopPropagation();
                        copyText(model.model_name);
                      }}
                      aria-label={t('复制')}
                    >
                      <Copy size={12} />
                    </Button>

                    {/* Checkbox */}
                    {rowSelection && (
                      <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleCheckboxChange(model, event.target.checked);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className='h-4 w-4 rounded border-border text-accent'
                        aria-label={t('选择模型')}
                      />
                    )}
                  </div>
                </div>

                {/* Model description. */}
                <div className='flex-1 mb-4'>
                  <p
                    className='text-xs line-clamp-2 leading-relaxed'
                    style={{ color: 'var(--app-muted)' }}
                  >
                    {getModelDescription(model)}
                  </p>
                </div>

                {/* Footer area. */}
                <div className='mt-auto'>
                  {/* Tags. */}
                  {renderTags(model)}

                  {/* Ratio info. */}
                  {showRatio && (
                    <div className='pt-3'>
                      <div className='flex items-center space-x-1 mb-2'>
                        <span className='text-xs font-medium text-foreground'>
                          {t('倍率信息')}
                        </span>
                        <Tooltip
                          content={t('倍率是为了方便换算不同价格的模型')}
                        >
                          <CircleHelp
                            className='text-blue-500 cursor-pointer'
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalImageUrl('/ratio.png');
                              setIsModalOpenurl(true);
                            }}
                          />
                        </Tooltip>
                      </div>
                      <div className='grid grid-cols-3 gap-2 text-xs text-muted'>
                        <div>
                          {t('模型')}:{' '}
                          {model.quota_type === 0 ? model.model_ratio : t('无')}
                        </div>
                        <div>
                          {t('补全')}:{' '}
                          {model.quota_type === 0
                            ? parseFloat(model.completion_ratio.toFixed(3))
                            : t('无')}
                        </div>
                        <div>
                          {t('分组')}: {priceData?.usedGroupRatio ?? '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </div>

      {/* Pagination. */}
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
