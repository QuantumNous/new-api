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
import { Card, Tag, Tooltip, Checkbox, Empty, Pagination, Button, Avatar } from '@douyinfe/semi-ui';
import { IconHelpCircle, IconCopy } from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { stringToColor, getModelCategories, calculateModelPrice, formatPriceInfo } from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';

const CARD_STYLES = {
  container: "w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md",
  icon: "w-8 h-8 flex items-center justify-center",
  selected: "border-blue-500 bg-blue-50",
  default: "border-gray-200 hover:border-gray-300"
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
  tokenUnit,
  displayPrice,
  showRatio,
  t,
  selectedRowKeys = [],
  setSelectedRowKeys,
  activeKey,
  availableCategories,
  openModelDetail,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedModels = filteredModels.slice(startIndex, endIndex);

  const getModelKey = (model) => model.key ?? model.model_name ?? model.id;

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
  const getModelIcon = (modelName) => {
    const categories = getModelCategories(t);
    let icon = null;

    // 遍历分类，找到匹配的模型图标
    for (const [key, category] of Object.entries(categories)) {
      if (key !== 'all' && category.filter({ model_name: modelName })) {
        icon = category.icon;
        break;
      }
    }

    // 如果找到了匹配的图标，返回包装后的图标
    if (icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {React.cloneElement(icon, { size: 32 })}
          </div>
        </div>
      );
    }

    const avatarText = modelName.slice(0, 2).toUpperCase();
    return (
      <div className={CARD_STYLES.container}>
        <Avatar
          size="large"
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  // 获取模型描述
  const getModelDescription = (modelName) => {
    return t('高性能AI模型，适用于各种文本生成和理解任务。');
  };

  // 渲染价格信息
  const renderPriceInfo = (record) => {
    const priceData = calculateModelPrice({
      record,
      selectedGroup,
      groupRatio,
      tokenUnit,
      displayPrice,
      currency
    });
    return formatPriceInfo(priceData, t);
  };

  // 渲染标签
  const renderTags = (record) => {
    const tags = [];

    // 计费类型标签  
    const billingType = record.quota_type === 1 ? 'teal' : 'violet';
    const billingText = record.quota_type === 1 ? t('按次计费') : t('按量计费');
    tags.push(
      <Tag shape='circle' key="billing" color={billingType} size='small'>
        {billingText}
      </Tag>
    );

    // 热门模型标签
    if (record.model_name.includes('gpt')) {
      tags.push(
        <Tag shape='circle' key="hot" color='red' size='small'>
          {t('热')}
        </Tag>
      );
    }

    // 端点类型标签
    if (record.supported_endpoint_types?.length > 0) {
      record.supported_endpoint_types.slice(0, 2).forEach((endpoint, index) => {
        tags.push(
          <Tag shape='circle' key={`endpoint-${index}`} color={stringToColor(endpoint)} size='small'>
            {endpoint}
          </Tag>
        );
      });
    }

    // 上下文长度标签
    const contextMatch = record.model_name.match(/(\d+)k/i);
    const contextSize = contextMatch ? contextMatch[1] + 'K' : '4K';
    tags.push(
      <Tag shape='circle' key="context" color='blue' size='small'>
        {contextSize}
      </Tag>
    );

    return tags;
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
      <div className="flex justify-center items-center py-20">
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
          description={t('搜索无结果')}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);

          return (
            <Card
              key={modelKey || index}
              className={`!rounded-2xl transition-all duration-200 hover:shadow-lg border cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default
                }`}
              bodyStyle={{ padding: '24px' }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              {/* 头部：图标 + 模型名称 + 操作按钮 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  {getModelIcon(model.model_name)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">
                      {model.model_name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs mt-1">
                      {renderPriceInfo(model)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-3">
                  {/* 复制按钮 */}
                  <Button
                    size="small"
                    type="tertiary"
                    icon={<IconCopy />}
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

              {/* 模型描述 */}
              <div className="mb-4">
                <p
                  className="text-xs line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {getModelDescription(model.model_name)}
                </p>
              </div>

              {/* 标签区域 */}
              <div className="flex flex-wrap gap-2">
                {renderTags(model)}
              </div>

              {/* 倍率信息（可选） */}
              {showRatio && (
                <div
                  className="mt-4 pt-3 border-t border-dashed"
                  style={{ borderColor: 'var(--semi-color-border)' }}
                >
                  <div className="flex items-center space-x-1 mb-2">
                    <span className="text-xs font-medium text-gray-700">{t('倍率信息')}</span>
                    <Tooltip content={t('倍率是为了方便换算不同价格的模型')}>
                      <IconHelpCircle
                        className="text-blue-500 cursor-pointer"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalImageUrl('/ratio.png');
                          setIsModalOpenurl(true);
                        }}
                      />
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      {t('模型')}: {model.quota_type === 0 ? model.model_ratio : t('无')}
                    </div>
                    <div>
                      {t('补全')}: {model.quota_type === 0 ? parseFloat(model.completion_ratio.toFixed(3)) : t('无')}
                    </div>
                    <div>
                      {t('分组')}: {groupRatio[selectedGroup]}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 分页 */}
      {filteredModels.length > 0 && (
        <div className="flex justify-center mt-6 pt-4 border-t pricing-pagination-divider">
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={filteredModels.length}
            showSizeChanger={true}
            pageSizeOptions={[10, 20, 50, 100]}
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