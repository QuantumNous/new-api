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

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-xl flex items-center justify-center relative shadow-sm',
  icon: 'w-8 h-8 flex items-center justify-center',
  selected: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  default: 'border-semi-color-border hover:border-semi-color-primary',
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

  const getModelCapability = (record) => {
    const searchText = [
      record?.model_name,
      record?.vendor_name,
      record?.tags,
      ...(Array.isArray(record?.supported_endpoint_types)
        ? record.supported_endpoint_types
        : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/(image|vision|paint|midjourney)/.test(searchText)) return t('图像');
    if (/(video|kling|runway)/.test(searchText)) return t('视频');
    if (/(audio|music|speech|tts|voice)/.test(searchText)) return t('音频');
    if (/(code|coder|coding|developer)/.test(searchText)) return t('编码');
    return t('文本');
  };

  const getBillingHint = (record) => {
    if (record.quota_type === 1) return t('按次计费');
    if (record.quota_type === 0) return t('按量计费');
    return t('按站点配置计费');
  };

  // 获取模型描述
  const getModelDescription = (record) => {
    return (
      record.description ||
      t('该模型来自站点公开配置，具体可用范围以账号和分组配置为准。')
    );
  };

  // 渲染标签
  const renderTags = (record) => {
    // 计费类型标签（左边）
    let billingTag = (
      <Tag key='billing' shape='circle' color='white' size='small'>
        -
      </Tag>
    );
    if (record.quota_type === 1) {
      billingTag = (
        <Tag key='billing' shape='circle' color='teal' size='small'>
          {t('按次计费')}
        </Tag>
      );
    } else if (record.quota_type === 0) {
      billingTag = (
        <Tag key='billing' shape='circle' color='violet' size='small'>
          {t('按量计费')}
        </Tag>
      );
    }

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
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>{billingTag}</div>
        <div className='flex min-w-0 flex-wrap items-center justify-end gap-1'>
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
    <div className='pricing-marketplace-card-view'>
      <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);

          return (
            <Card
              key={modelKey || index}
              className={`pricing-marketplace-model-card transition-all duration-200 hover:shadow-md border cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              bodyStyle={{ height: '100%' }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              <div className='flex flex-col h-full'>
                {/* 头部：图标 + 模型名称 + 操作按钮 */}
                <div className='mb-3 flex items-start justify-between gap-3'>
                  <div className='flex items-start space-x-3 flex-1 min-w-0'>
                    {getModelIcon(model)}
                    <div className='flex-1 min-w-0'>
                      <div className='mb-1 flex min-w-0 flex-wrap items-center gap-1.5'>
                        <Tag color='blue' shape='circle' size='small'>
                          {getModelCapability(model)}
                        </Tag>
                        {model.vendor_name && (
                          <Tag color='white' shape='circle' size='small'>
                            {model.vendor_name}
                          </Tag>
                        )}
                      </div>
                      <h3 className='text-lg font-bold text-semi-color-text-0 break-words leading-snug'>
                        {model.model_name}
                      </h3>
                      <div className='mt-1 text-xs text-semi-color-text-2'>
                        {t('按站点配置计费')}
                      </div>
                    </div>
                  </div>

                  <div className='flex shrink-0 items-center space-x-2'>
                    {/* 复制按钮 */}
                    <Button
                      size='small'
                      theme='outline'
                      type='tertiary'
                      icon={<Copy size={12} />}
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
                <div className='flex-1 mb-4'>
                  <p
                    className='text-sm line-clamp-3 leading-relaxed'
                    style={{ color: 'var(--semi-color-text-2)' }}
                  >
                    {getModelDescription(model)}
                  </p>
                </div>

                {/* 底部区域 */}
                <div className='mt-auto'>
                  {/* 标签区域 */}
                  {renderTags(model)}

                  <div className='pricing-marketplace-card-footer'>
                    <div>
                      <div className='text-xs font-medium text-semi-color-text-0'>
                        {getBillingHint(model)}
                      </div>
                      <div className='text-xs text-semi-color-text-2'>
                        {t('额度消耗以详情和站点配置为准')}
                      </div>
                    </div>
                    <Button
                      size='small'
                      theme='borderless'
                      type='primary'
                      icon={<ExternalLink size={13} />}
                      onClick={(e) => {
                        e.stopPropagation();
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

      {/* 分页 */}
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
