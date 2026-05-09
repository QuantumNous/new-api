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
  Tooltip,
  Checkbox,
  Empty,
  Pagination,
  Button,
  Avatar,
} from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import { Copy } from 'lucide-react';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  stringToColor,
  calculateModelPrice,
  getLobeHubIcon,
  getModelPriceItems,
} from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';
import { renderLimitedItems } from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

const CARD_STYLES = {
  container: 'pricing-model-card-icon-shell',
  icon: 'pricing-model-card-icon',
  selected: 'pricing-model-card-selected',
  default: 'pricing-model-card-default',
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
          <Avatar size='large'>?</Avatar>
        </div>
      );
    }
    // 1) 优先使用模型自定义图标
    if (model.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.icon, 32)}
          </div>
        </div>
      );
    }
    // 2) 退化为供应商图标
    if (model.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // 如果没有供应商图标，使用模型名称生成头像

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

  // 获取模型描述
  const getModelDescription = (record) => {
    return record.description || '';
  };

  const renderBillingTag = (quotaType) => {
    if (quotaType === 1) {
      return (
        <Tag key='billing' shape='circle' color='teal' size='small'>
          {t('按次计费')}
        </Tag>
      );
    }
    if (quotaType === 0) {
      return (
        <Tag key='billing' shape='circle' color='violet' size='small'>
          {t('按量计费')}
        </Tag>
      );
    }
    return (
      <Tag key='billing' shape='circle' color='white' size='small'>
        -
      </Tag>
    );
  };

  // 渲染标签
  const renderTags = (record) => {
    // 自定义标签（右边）
    const customTags = [];
    if (record.tags) {
      const tagArr = record.tags.split(',').filter(Boolean);
      tagArr.forEach((tg, idx) => {
        customTags.push(
          <Tag
            key={`custom-${idx}`}
            shape='circle'
            color={stringToColor(tg)}
            size='small'
          >
            {tg}
          </Tag>,
        );
      });
    }

    return (
      <div className='pricing-model-card-footbar flex items-center justify-between gap-3'>
        <div className='pricing-model-card-foot-main flex items-center gap-2'>
          {renderBillingTag(record.quota_type)}
        </div>
        <div className='pricing-model-card-foot-tags flex items-center gap-1'>
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

  // 显示骨架屏
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
          description={t('搜索无结果')}
        />
      </div>
    );
  }

  return (
    <div className='pricing-card-view px-2 pt-2'>
      <div className='pricing-card-grid grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
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
          const priceItems = getModelPriceItems(priceData, t, siteDisplayType);
          const primaryPriceItems = priceItems.slice(0, 3);
          const extraPriceItemsCount = Math.max(priceItems.length - 3, 0);

          return (
            <Card
              key={modelKey || index}
              className={`pricing-model-card !rounded-2xl transition-all duration-200 hover:shadow-lg border cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              bodyStyle={{ height: '100%' }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              <div className='flex flex-col h-full'>
                {/* 头部：图标 + 模型名称 + 操作按钮 */}
                <div className='pricing-model-card-head flex items-start justify-between mb-3'>
                  <div className='pricing-model-card-main flex items-start space-x-3 flex-1 min-w-0'>
                    {getModelIcon(model)}
                    <div className='flex-1 min-w-0'>
                      <h3 className='pricing-model-card-title text-lg font-bold truncate'>
                        {model.model_name}
                      </h3>
                      <div className='pricing-model-card-meta mt-2 flex flex-wrap items-center gap-2'>
                        {model.vendor_name && (
                          <span className='pricing-model-card-vendor'>
                            {model.vendor_name}
                          </span>
                        )}
                        {renderBillingTag(model.quota_type)}
                      </div>
                    </div>
                  </div>

                  <div className='pricing-model-card-actions flex items-center space-x-2 ml-3'>
                    {/* 复制按钮 */}
                    <Button
                      size='small'
                      theme='outline'
                      type='tertiary'
                      icon={<Copy size={12} />}
                      className='pricing-model-card-copy'
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(model.model_name);
                      }}
                    />

                    {/* 选择框 */}
                    {rowSelection && (
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCheckboxChange(model, e.target.checked);
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* 模型描述 - 占据剩余空间 */}
                <div className='pricing-model-card-body flex-1 mb-4'>
                  <div className='pricing-model-card-price-section mb-4'>
                    <div className='pricing-model-card-price-section-head'>
                      <span className='pricing-model-card-price-label'>
                        {siteDisplayType === 'TOKENS'
                          ? t('计费摘要')
                          : t('价格摘要')}
                      </span>
                      {extraPriceItemsCount > 0 && (
                        <span className='pricing-model-card-price-more'>
                          +{extraPriceItemsCount} {t('项更多价格细节')}
                        </span>
                      )}
                    </div>
                    <div className='pricing-model-card-price-grid'>
                      {primaryPriceItems.map((item) => (
                        <div
                          key={item.key}
                          className='pricing-model-card-price-item'
                        >
                          <span className='pricing-model-card-price-name'>
                            {item.label}
                          </span>
                          <span className='pricing-model-card-price-value'>
                            {item.value}
                            {item.suffix}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className='pricing-model-card-description text-xs line-clamp-2 leading-relaxed'>
                    {getModelDescription(model)}
                  </p>
                </div>

                {/* 底部区域 */}
                <div className='pricing-model-card-foot mt-auto'>
                  {/* 标签区域 */}
                  {renderTags(model)}

                  {/* 倍率信息（可选） */}
                  {showRatio && (
                    <div className='pricing-model-card-ratio-panel pt-3'>
                      <div className='pricing-model-card-ratio-head flex items-center space-x-1 mb-2'>
                        <span className='pricing-model-card-ratio-title text-xs font-medium text-gray-700'>
                          {t('倍率信息')}
                        </span>
                        <Tooltip
                          content={t('倍率是为了方便换算不同价格的模型')}
                        >
                          <IconHelpCircle
                            className='text-blue-500 cursor-pointer'
                            size='small'
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalImageUrl('/ratio.png');
                              setIsModalOpenurl(true);
                            }}
                          />
                        </Tooltip>
                      </div>
                      <div className='pricing-model-card-ratio grid grid-cols-3 gap-2 text-xs text-gray-600'>
                        <div className='pricing-model-card-ratio-item'>
                          <span className='pricing-model-card-ratio-name'>
                            {t('模型')}
                          </span>
                          <strong className='pricing-model-card-ratio-value'>
                            {model.quota_type === 0
                              ? model.model_ratio
                              : t('无')}
                          </strong>
                        </div>
                        <div className='pricing-model-card-ratio-item'>
                          <span className='pricing-model-card-ratio-name'>
                            {t('补全')}
                          </span>
                          <strong className='pricing-model-card-ratio-value'>
                            {model.quota_type === 0
                              ? parseFloat(model.completion_ratio.toFixed(3))
                              : t('无')}
                          </strong>
                        </div>
                        <div className='pricing-model-card-ratio-item'>
                          <span className='pricing-model-card-ratio-name'>
                            {t('分组')}
                          </span>
                          <strong className='pricing-model-card-ratio-value'>
                            {priceData?.usedGroupRatio ?? '-'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 分页 */}
      {filteredModels.length > 0 && (
        <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={filteredModels.length}
            showSizeChanger={filteredModels.length > pageSize}
            hideOnSinglePage={filteredModels.length <= pageSize}
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
