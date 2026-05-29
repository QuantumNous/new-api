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
import { Tag, Space, Tooltip } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  renderModelTag,
  stringToColor,
  calculateModelPrice,
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
  getModelPriceItems,
  getLobeHubIcon,
} from '../../../../../helpers';
import {
  renderLimitedItems,
  renderDescription,
} from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag className='pricing-table-status-tag' color='teal' shape='circle'>
          {t('按次计费')}
        </Tag>
      );
    case 0:
      return (
        <Tag className='pricing-table-status-tag' color='violet' shape='circle'>
          {t('按量计费')}
        </Tag>
      );
    default:
      return t('未知');
  }
}

// Render vendor name
const renderVendor = (vendorName, vendorIcon, t) => {
  if (!vendorName) return '-';
  return (
    <Tag
      className='pricing-table-meta-pill pricing-table-vendor-tag'
      color='white'
      shape='circle'
      prefixIcon={getLobeHubIcon(vendorIcon || 'Layers', 14)}
    >
      {vendorName}
    </Tag>
  );
};

// Render tags list using RenderUtils
const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter((tag) => tag.trim());
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <Tag
        key={idx}
        className='pricing-table-meta-pill'
        color={stringToColor(tag.trim())}
        shape='circle'
        size='small'
      >
        {tag.trim()}
      </Tag>
    ),
    maxDisplay: 3,
  });
};

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <Space wrap className='pricing-table-endpoint-list'>
      {endpoints.map((endpoint, idx) => (
        <Tag
          key={endpoint}
          className='pricing-table-meta-pill'
          color={stringToColor(endpoint)}
          shape='circle'
        >
          {endpoint}
        </Tag>
      ))}
    </Space>
  );
}

export const getPricingTableColumns = ({
  t,
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
}) => {
  const isMobile = useIsMobile();
  const priceDataCache = new WeakMap();

  const getPriceData = (record) => {
    let cache = priceDataCache.get(record);
    if (!cache) {
      cache = calculateModelPrice({
        record,
        selectedGroup,
        groupRatio,
        tokenUnit,
        displayPrice,
        currency,
        quotaDisplayType: siteDisplayType,
      });
      priceDataCache.set(record, cache);
    }
    return cache;
  };

  const endpointColumn = {
    title: t('可用端点类型'),
    dataIndex: 'supported_endpoint_types',
    render: (text, record, index) => {
      return renderSupportedEndpoints(text);
    },
  };

  const modelNameColumn = {
    title: t('模型名称'),
    dataIndex: 'model_name',
    render: (text, record, index) => {
      return (
        <div className='pricing-table-model-cell'>
          {renderModelTag(text, {
            onClick: () => {
              copyText(text);
            },
          })}
        </div>
      );
    },
    onFilter: (value, record) =>
      record.model_name.toLowerCase().includes(value.toLowerCase()),
  };

  const quotaColumn = {
    title: t('计费类型'),
    dataIndex: 'quota_type',
    render: (text, record, index) => {
      return renderQuotaType(parseInt(text), t);
    },
    sorter: (a, b) => a.quota_type - b.quota_type,
  };

  const descriptionColumn = {
    title: t('描述'),
    dataIndex: 'description',
    render: (text) => (
      <div className='pricing-table-description'>
        {renderDescription(text, 200)}
      </div>
    ),
  };

  const tagsColumn = {
    title: t('标签'),
    dataIndex: 'tags',
    render: renderTags,
  };

  const vendorColumn = {
    title: t('供应商'),
    dataIndex: 'vendor_name',
    render: (text, record) => renderVendor(text, record.vendor_icon, t),
  };

  const baseColumns = [
    modelNameColumn,
    vendorColumn,
    descriptionColumn,
    tagsColumn,
    quotaColumn,
  ];

  const ratioColumn = {
    title: () => (
      <div className='flex items-center space-x-1'>
        <span>{t('倍率')}</span>
        <Tooltip content={t('倍率是为了方便换算不同价格的模型')}>
          <IconHelpCircle
            className='text-blue-500 cursor-pointer'
            onClick={() => {
              setModalImageUrl('/ratio.png');
              setIsModalOpenurl(true);
            }}
          />
        </Tooltip>
      </div>
    ),
    dataIndex: 'model_ratio',
    render: (text, record, index) => {
      const completionRatio = parseFloat(record.completion_ratio.toFixed(3));
      const priceData = getPriceData(record);

      return (
        <div className='pricing-table-ratio-stack space-y-1'>
          <div className='pricing-table-ratio-line'>
            {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
          </div>
          <div className='pricing-table-ratio-line'>
            {t('补全倍率')}：
            {record.quota_type === 0 ? completionRatio : t('无')}
          </div>
          <div className='pricing-table-ratio-line'>
            {t('分组倍率')}：{priceData?.usedGroupRatio ?? '-'}
          </div>
        </div>
      );
    },
  };

  const priceColumn = {
    title: siteDisplayType === 'TOKENS' ? t('计费摘要') : t('模型价格'),
    dataIndex: 'model_price',
    ...(isMobile ? {} : { fixed: 'right' }),
    render: (text, record, index) => {
      const dynamicSummary = getDynamicPricingSummary(record, {
        displayPrice,
        tokenUnit,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          record,
          groupRatio || {},
        ),
      });
      const priceData = dynamicSummary ? null : getPriceData(record);
      const priceItems = dynamicSummary
        ? dynamicSummary.isSpecialExpression
          ? [
              {
                key: 'dynamic-special',
                label: t('特殊计费表达式'),
                value: t('无法解析结构化定价'),
                suffix: '',
              },
            ]
          : dynamicSummary.entries.map((entry) => ({
              key: entry.key,
              label: t(entry.label),
              value: entry.formatted,
              suffix: ` / 1${tokenUnit}`,
            }))
        : getModelPriceItems(priceData, t, siteDisplayType);

      return (
        <div className='pricing-table-price-stack space-y-1'>
          {priceItems.map((item) => (
            <div key={item.key} className='pricing-table-price-line'>
              <span className='pricing-table-price-label'>{item.label}</span>
              <span className='pricing-table-price-value'>
                {item.value}
                {item.suffix}
              </span>
            </div>
          ))}
        </div>
      );
    },
  };

  const columns = [...baseColumns];
  columns.push(endpointColumn);
  if (showRatio) {
    columns.push(ratioColumn);
  }
  columns.push(priceColumn);
  return columns;
};
