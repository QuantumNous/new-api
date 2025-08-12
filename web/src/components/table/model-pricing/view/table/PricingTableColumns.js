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
import { renderModelTag, stringToColor, calculateModelPrice, getLobeHubIcon } from '../../../../../helpers';
import { renderLimitedItems, renderDescription } from '../../../../common/ui/RenderUtils';

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag color='teal' shape='circle'>
          {t('按次计费')}
        </Tag>
      );
    case 0:
      return (
        <Tag color='violet' shape='circle'>
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
    <Tag color='white' shape='circle' prefixIcon={getLobeHubIcon(vendorIcon || 'Layers', 14)}>
      {vendorName}
    </Tag>
  );
};

// Render tags list using RenderUtils
const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter(tag => tag.trim());
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <Tag key={idx} color={stringToColor(tag.trim())} shape='circle' size='small'>
        {tag.trim()}
      </Tag>
    ),
    maxDisplay: 3
  });
};

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <Space wrap>
      {endpoints.map((endpoint, idx) => (
        <Tag
          key={endpoint}
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
  tokenUnit,
  displayPrice,
  showRatio,
}) => {
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
      return renderModelTag(text, {
        onClick: () => {
          copyText(text);
        }
      });
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
    render: (text) => renderDescription(text, 200),
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

  const baseColumns = [modelNameColumn, vendorColumn, descriptionColumn, tagsColumn, quotaColumn];

  const ratioColumn = {
    title: () => (
      <div className="flex items-center space-x-1">
        <span>{t('倍率')}</span>
        <Tooltip content={t('倍率是为了方便换算不同价格的模型')}>
          <IconHelpCircle
            className="text-blue-500 cursor-pointer"
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
      const content = (
        <div className="space-y-1">
          <div className="text-gray-700">
            {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
          </div>
          <div className="text-gray-700">
            {t('补全倍率')}：
            {record.quota_type === 0 ? completionRatio : t('无')}
          </div>
          <div className="text-gray-700">
            {t('分组倍率')}：{groupRatio[selectedGroup]}
          </div>
        </div>
      );
      return content;
    },
  };

  const priceColumn = {
    title: t('模型价格'),
    dataIndex: 'model_price',
    fixed: 'right',
    render: (text, record, index) => {
      const priceData = calculateModelPrice({
        record,
        selectedGroup,
        groupRatio,
        tokenUnit,
        displayPrice,
        currency
      });

      if (priceData.isPerToken) {
        return (
          <div className="space-y-1">
            <div className="text-gray-700">
              {t('提示')} {priceData.inputPrice} / 1{priceData.unitLabel} tokens
            </div>
            <div className="text-gray-700">
              {t('补全')} {priceData.completionPrice} / 1{priceData.unitLabel} tokens
            </div>
          </div>
        );
      } else {
        return (
          <div className="text-gray-700">
            {t('模型价格')}：{priceData.price}
          </div>
        );
      }
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