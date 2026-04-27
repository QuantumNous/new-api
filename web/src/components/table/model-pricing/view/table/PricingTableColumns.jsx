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
import { Tooltip } from '@heroui/react';
import { HelpCircle } from 'lucide-react';
import {
  renderModelTag,
  stringToColor,
  calculateModelPrice,
  getModelPriceItems,
  getLobeHubIcon,
} from '../../../../../helpers';
import {
  renderLimitedItems,
  renderDescription,
} from '../../../../common/ui/RenderUtils';

function ColorChip({ color, children }) {
  return (
    <span
      className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
      style={{
        backgroundColor: `${color}1A`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function WhiteChip({ children, prefix }) {
  return (
    <span className='inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-background px-2 py-0.5 text-xs font-medium text-foreground'>
      {prefix}
      {children}
    </span>
  );
}

function ToneChip({ tone, children }) {
  const cls =
    tone === 'teal'
      ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
      : tone === 'violet'
        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
        : '';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return <ToneChip tone='teal'>{t('按次计费')}</ToneChip>;
    case 0:
      return <ToneChip tone='violet'>{t('按量计费')}</ToneChip>;
    default:
      return t('未知');
  }
}

const renderVendor = (vendorName, vendorIcon) => {
  if (!vendorName) return '-';
  return (
    <WhiteChip prefix={getLobeHubIcon(vendorIcon || 'Layers', 14)}>
      {vendorName}
    </WhiteChip>
  );
};

const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter((tag) => tag.trim());
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <ColorChip key={idx} color={stringToColor(tag.trim())}>
        {tag.trim()}
      </ColorChip>
    ),
    maxDisplay: 3,
  });
};

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {endpoints.map((endpoint) => (
        <ColorChip key={endpoint} color={stringToColor(endpoint)}>
          {endpoint}
        </ColorChip>
      ))}
    </div>
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
  isMobile,
}) => {
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
    render: (text) => renderSupportedEndpoints(text),
  };

  const modelNameColumn = {
    title: t('模型名称'),
    dataIndex: 'model_name',
    render: (text) =>
      renderModelTag(text, {
        onClick: () => copyText(text),
      }),
    onFilter: (value, record) =>
      record.model_name.toLowerCase().includes(value.toLowerCase()),
  };

  const quotaColumn = {
    title: t('计费类型'),
    dataIndex: 'quota_type',
    render: (text) => renderQuotaType(parseInt(text), t),
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
    render: (text, record) => renderVendor(text, record.vendor_icon),
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
      <div className='flex items-center gap-1'>
        <span>{t('倍率')}</span>
        <Tooltip
          content={t('倍率是为了方便换算不同价格的模型')}
          placement='top'
        >
          <button
            type='button'
            className='inline-flex h-4 w-4 items-center justify-center text-sky-500'
            onClick={() => {
              setModalImageUrl('/ratio.png');
              setIsModalOpenurl(true);
            }}
            aria-label={t('倍率说明')}
          >
            <HelpCircle size={14} />
          </button>
        </Tooltip>
      </div>
    ),
    dataIndex: 'model_ratio',
    render: (text, record) => {
      const completionRatio = parseFloat(record.completion_ratio.toFixed(3));
      const priceData = getPriceData(record);

      return (
        <div className='space-y-1'>
          <div className='text-sm text-foreground'>
            {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
          </div>
          <div className='text-sm text-foreground'>
            {t('补全倍率')}：
            {record.quota_type === 0 ? completionRatio : t('无')}
          </div>
          <div className='text-sm text-foreground'>
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
    render: (text, record) => {
      const priceData = getPriceData(record);
      const priceItems = getModelPriceItems(priceData, t, siteDisplayType);

      return (
        <div className='space-y-1'>
          {priceItems.map((item) => (
            <div key={item.key} className='text-sm text-foreground'>
              {item.label} {item.value}
              {item.suffix}
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
