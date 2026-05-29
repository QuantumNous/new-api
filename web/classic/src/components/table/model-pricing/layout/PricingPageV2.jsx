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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Select,
  SideSheet,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconFilter,
  IconSearch,
} from '@douyinfe/semi-icons';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Grid2x2,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react';
import {
  API,
  calculateModelPrice,
  copy,
  getLobeHubIcon,
  getModelPriceItems,
  showSuccess,
  stringToColor,
} from '../../../../helpers';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SelectableButtonGroup from '../../../common/ui/SelectableButtonGroup';
import ModelDetailSideSheetV2 from '../modal/ModelDetailSideSheetV2';

const { Text, Paragraph } = Typography;

const FILTER_ALL = 'all';
const QUOTA_TYPES = {
  ALL: 'all',
  TOKEN: 'token',
  REQUEST: 'request',
};
const ENDPOINT_TYPES = {
  ALL: 'all',
  OPENAI: 'openai',
  OPENAI_RESPONSE: 'openai-response',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  JINA_RERANK: 'jina-rerank',
  IMAGE_GENERATION: 'image-generation',
  EMBEDDINGS: 'embeddings',
  OPENAI_VIDEO: 'openai-video',
};
const SORT_OPTIONS = {
  NAME: 'name',
  PRICE_LOW: 'price-low',
  PRICE_HIGH: 'price-high',
};
const VIEW_MODES = {
  CARD: 'card',
  TABLE: 'table',
};
const DEFAULT_PAGE_SIZE = 20;
const EXCLUDED_GROUPS = ['', 'auto'];

const parseTags = (tagsString) => {
  if (!tagsString) return [];
  return tagsString
    .split(/[,;|\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const extractAllTags = (models) => {
  const tagSet = new Set();
  models.forEach((model) => {
    parseTags(model.tags).forEach((tag) => tagSet.add(tag.toLowerCase()));
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
};

const getSortPrice = (model) =>
  model.quota_type === 0
    ? Number(model.model_ratio || 0)
    : Number(model.model_price || 0);

const endpointTypeOptions = (t) => [
  { value: ENDPOINT_TYPES.ALL, label: t('All Types') },
  { value: ENDPOINT_TYPES.OPENAI, label: 'Chat' },
  { value: ENDPOINT_TYPES.OPENAI_RESPONSE, label: 'Response' },
  { value: ENDPOINT_TYPES.ANTHROPIC, label: 'Anthropic' },
  { value: ENDPOINT_TYPES.GEMINI, label: 'Gemini' },
  { value: ENDPOINT_TYPES.JINA_RERANK, label: 'Rerank' },
  { value: ENDPOINT_TYPES.IMAGE_GENERATION, label: t('Image') },
  { value: ENDPOINT_TYPES.EMBEDDINGS, label: t('Embeddings') },
  { value: ENDPOINT_TYPES.OPENAI_VIDEO, label: t('Video') },
];

const quotaTypeOptions = (t) => [
  { value: QUOTA_TYPES.ALL, label: t('All Models') },
  { value: QUOTA_TYPES.TOKEN, label: t('Token-based') },
  { value: QUOTA_TYPES.REQUEST, label: t('Per Request') },
];

const sortOptions = (t) => [
  { value: SORT_OPTIONS.NAME, label: t('Name') },
  { value: SORT_OPTIONS.PRICE_LOW, label: t('Price: Low to High') },
  { value: SORT_OPTIONS.PRICE_HIGH, label: t('Price: High to Low') },
];

const filterAndSortModels = (models, filters) => {
  let result = [...models];
  const query = filters.search.trim().toLowerCase();

  if (query) {
    result = result.filter(
      (model) =>
        model.model_name?.toLowerCase().includes(query) ||
        model.description?.toLowerCase().includes(query) ||
        model.tags?.toLowerCase().includes(query) ||
        model.vendor_name?.toLowerCase().includes(query),
    );
  }

  if (filters.vendor !== FILTER_ALL) {
    result = result.filter((model) => model.vendor_name === filters.vendor);
  }

  if (filters.group !== FILTER_ALL) {
    result = result.filter((model) =>
      model.enable_groups?.includes(filters.group),
    );
  }

  if (filters.quotaType !== QUOTA_TYPES.ALL) {
    const targetType = filters.quotaType === QUOTA_TYPES.TOKEN ? 0 : 1;
    result = result.filter((model) => model.quota_type === targetType);
  }

  if (filters.endpointType !== ENDPOINT_TYPES.ALL) {
    result = result.filter((model) =>
      model.supported_endpoint_types?.includes(filters.endpointType),
    );
  }

  if (filters.tag !== FILTER_ALL) {
    result = result.filter((model) =>
      parseTags(model.tags)
        .map((tag) => tag.toLowerCase())
        .includes(filters.tag.toLowerCase()),
    );
  }

  if (filters.sortBy === SORT_OPTIONS.PRICE_LOW) {
    result.sort((a, b) => getSortPrice(a) - getSortPrice(b));
  } else if (filters.sortBy === SORT_OPTIONS.PRICE_HIGH) {
    result.sort((a, b) => getSortPrice(b) - getSortPrice(a));
  } else {
    result.sort((a, b) =>
      (a.model_name || '').localeCompare(b.model_name || ''),
    );
  }

  return result;
};

const buildDefaultDisplayPrice = ({
  priceInUSD,
  siteDisplayType,
  showRechargePrice,
  priceRate,
  usdExchangeRate,
  customExchangeRate,
  customCurrencySymbol,
  precision = 4,
}) => {
  let actualPrice = priceInUSD;
  if (showRechargePrice) {
    actualPrice = (priceInUSD * priceRate) / usdExchangeRate;
  }

  if (siteDisplayType === 'CNY') {
    return `¥${(actualPrice * usdExchangeRate).toFixed(precision)}`;
  }
  if (siteDisplayType === 'CUSTOM') {
    return `${customCurrencySymbol}${(actualPrice * customExchangeRate).toFixed(precision)}`;
  }
  return `$${actualPrice.toFixed(precision)}`;
};

const formatCount = (value) => Number(value || 0).toLocaleString();

const PerfBadge = ({ perf, t }) => {
  if (!perf) return null;

  const latency = Number(perf.avg_latency_ms || 0);
  const throughput = Number(perf.avg_tps || 0);
  const successRate = Number(perf.success_rate || 0);
  let statusColor = '#10b981';

  if (successRate < 99) {
    statusColor = '#ef4444';
  } else if (successRate < 99.9) {
    statusColor = '#f59e0b';
  }

  return (
    <div className='hidden min-[460px]:grid grid-cols-[44px_52px_24px] gap-x-2 text-right'>
      <div>
        <div className='text-[10px] text-[var(--app-text-muted)]'>
          {t('平均延迟')}
        </div>
        <div className='font-mono text-xs text-[var(--app-text-secondary)] whitespace-nowrap'>
          {latency > 0 ? `${Math.round(latency)}ms` : '—'}
        </div>
      </div>
      <div>
        <div className='text-[10px] text-[var(--app-text-muted)]'>TPS</div>
        <div className='font-mono text-xs text-[var(--app-text-secondary)] whitespace-nowrap'>
          {throughput > 0 ? throughput.toFixed(1) : '—'}
        </div>
      </div>
      <div title={`${t('成功率')}: ${successRate.toFixed(1)}%`}>
        <div className='text-[10px] text-[var(--app-text-muted)]'>
          {t('状态')}
        </div>
        <div className='flex h-4 items-center justify-end gap-[2px]'>
          <span className='h-2 w-1 rounded-full bg-[rgba(148,163,184,0.18)]' />
          <span className='h-2.5 w-1 rounded-full bg-[rgba(148,163,184,0.28)]' />
          <span
            className='h-3 w-1 rounded-full'
            style={{ backgroundColor: statusColor }}
          />
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({
  t,
  filters,
  models,
  vendors,
  groups,
  tags,
  groupRatios,
  onChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  const endpointOptionsWithCount = endpointTypeOptions(t).map((option) => ({
    value: option.value,
    label: option.label,
    tagCount:
      option.value === ENDPOINT_TYPES.ALL
        ? models.length
        : models.filter((model) =>
            model.supported_endpoint_types?.includes(option.value),
          ).length,
  }));

  const quotaOptionsWithCount = quotaTypeOptions(t).map((option) => ({
    value: option.value,
    label: option.label,
    tagCount:
      option.value === QUOTA_TYPES.ALL
        ? models.length
        : models.filter((model) =>
            option.value === QUOTA_TYPES.TOKEN
              ? model.quota_type === 0
              : model.quota_type === 1,
          ).length,
  }));

  const vendorOptions = [
    {
      value: FILTER_ALL,
      label: t('All Vendors'),
      tagCount: models.length,
    },
    ...vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        tagCount: models.filter((model) => model.vendor_name === vendor.name)
          .length,
        icon: vendor.icon ? getLobeHubIcon(vendor.icon, 14) : null,
      }))
      .filter((vendor) => vendor.tagCount > 0),
  ];

  const groupOptions = [
    { value: FILTER_ALL, label: t('All Groups'), tagCount: '' },
    ...groups.map((group) => ({
      value: group,
      label: group,
      tagCount:
        groupRatios[group] == null
          ? ''
          : `x${Number(groupRatios[group]).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`,
    })),
  ];

  const tagOptions = [
    {
      value: FILTER_ALL,
      label: t('All Tags'),
      tagCount: models.length,
    },
    ...tags.map((tag) => ({
      value: tag,
      label: tag,
      tagCount: models.filter((model) =>
        parseTags(model.tags)
          .map((item) => item.toLowerCase())
          .includes(tag.toLowerCase()),
      ).length,
    })),
  ];

  return (
    <div className='pricing-sidebar-shell !p-0 !bg-transparent !border-0 !shadow-none'>
      <div className='pricing-sidebar-header flex items-center justify-between mb-5'>
        <div>
          <div className='pricing-sidebar-title text-lg font-semibold'>
            {t('Filter')}
          </div>
          <div className='text-xs text-[var(--app-text-muted)] mt-1'>
            {t('Refine models by provider, group, type, and tags.')}
          </div>
        </div>
        <Button
          theme='outline'
          type='tertiary'
          disabled={!hasActiveFilters}
          onClick={onClearFilters}
          className='pricing-sidebar-reset'
          icon={<RotateCcw size={14} />}
        >
          {t('Reset')}
        </Button>
      </div>

      {hasActiveFilters && (
        <Tag className='mb-4' color='blue' shape='circle' size='small'>
          {t('Filters active')}
        </Tag>
      )}

      <SelectableButtonGroup
        title={t('Groups')}
        items={groupOptions}
        activeValue={filters.group}
        onChange={(value) => onChange('group', value)}
        t={t}
      />
      <SelectableButtonGroup
        title={t('All Vendors')}
        items={vendorOptions}
        activeValue={filters.vendor}
        onChange={(value) => onChange('vendor', value)}
        t={t}
      />
      <SelectableButtonGroup
        title={t('Model Tags')}
        items={tagOptions}
        activeValue={filters.tag}
        onChange={(value) => onChange('tag', value)}
        t={t}
      />
      <SelectableButtonGroup
        title={t('Pricing Type')}
        items={quotaOptionsWithCount}
        activeValue={filters.quotaType}
        onChange={(value) => onChange('quotaType', value)}
        t={t}
      />
      <SelectableButtonGroup
        title={t('Endpoint Type')}
        items={endpointOptionsWithCount}
        activeValue={filters.endpointType}
        onChange={(value) => onChange('endpointType', value)}
        t={t}
      />
    </div>
  );
};

const PricingToolbar = ({
  t,
  filteredCount,
  totalCount,
  sortBy,
  onSortChange,
  tokenUnit,
  onTokenUnitChange,
  showRechargePrice,
  onRechargePriceChange,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onOpenFilters,
  isMobile,
}) => (
  <div className='pricing-toolbar-surface'>
    <div className='pricing-actions-bar'>
      <div className='pricing-actions-main'>
        <div className='flex items-center gap-2 flex-wrap'>
          {isMobile && (
            <Button
              theme='outline'
              type='tertiary'
              icon={<IconFilter />}
              onClick={onOpenFilters}
              className='pricing-toolbar-button'
            >
              {t('Filter')}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          )}
          <div className='text-sm text-[var(--app-text-secondary)]'>
            <strong className='text-[var(--app-text-primary)]'>
              {formatCount(filteredCount)}
            </strong>{' '}
            {filteredCount === 1 ? t('model') : t('models')}
            {filteredCount !== totalCount
              ? ` / ${formatCount(totalCount)}`
              : ''}
          </div>
        </div>

        <div className='pricing-actions-controls'>
          <div className='pricing-toggle-chip'>
            <Button
              theme={!showRechargePrice ? 'solid' : 'outline'}
              type={!showRechargePrice ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${!showRechargePrice ? 'pricing-toolbar-button-primary' : ''}`}
              onClick={() => onRechargePriceChange(false)}
            >
              {t('Standard')}
            </Button>
            <Button
              theme={showRechargePrice ? 'solid' : 'outline'}
              type={showRechargePrice ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${showRechargePrice ? 'pricing-toolbar-button-primary' : ''}`}
              onClick={() => onRechargePriceChange(true)}
            >
              {t('Recharge')}
            </Button>
          </div>

          <div className='pricing-toggle-chip'>
            <Button
              theme={tokenUnit === 'M' ? 'solid' : 'outline'}
              type={tokenUnit === 'M' ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${tokenUnit === 'M' ? 'pricing-toolbar-button-primary' : ''}`}
              onClick={() => onTokenUnitChange('M')}
            >
              /1M
            </Button>
            <Button
              theme={tokenUnit === 'K' ? 'solid' : 'outline'}
              type={tokenUnit === 'K' ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${tokenUnit === 'K' ? 'pricing-toolbar-button-primary' : ''}`}
              onClick={() => onTokenUnitChange('K')}
            >
              /1K
            </Button>
          </div>

          <Select
            value={sortBy}
            onChange={onSortChange}
            optionList={sortOptions(t)}
            prefix={<ArrowUpDown size={14} />}
            className='pricing-currency-select'
          />

          <div className='pricing-toggle-chip'>
            <Button
              theme={viewMode === VIEW_MODES.CARD ? 'solid' : 'outline'}
              type={viewMode === VIEW_MODES.CARD ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${viewMode === VIEW_MODES.CARD ? 'pricing-toolbar-button-primary' : ''}`}
              icon={<Grid2x2 size={14} />}
              onClick={() => onViewModeChange(VIEW_MODES.CARD)}
            />
            <Button
              theme={viewMode === VIEW_MODES.TABLE ? 'solid' : 'outline'}
              type={viewMode === VIEW_MODES.TABLE ? 'primary' : 'tertiary'}
              className={`pricing-toolbar-button ${viewMode === VIEW_MODES.TABLE ? 'pricing-toolbar-button-primary' : ''}`}
              icon={<Table2 size={14} />}
              onClick={() => onViewModeChange(VIEW_MODES.TABLE)}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LoadingState = () => (
  <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
    {Array.from({ length: 6 }).map((_, index) => (
      <Card
        key={index}
        className='pricing-model-card pricing-model-card-default'
      >
        <Skeleton
          placeholder={<Skeleton.Paragraph rows={6} active />}
          loading
        />
      </Card>
    ))}
  </div>
);

const EmptyState = ({ t, searchQuery, hasActiveFilters, onClearAll }) => (
  <div className='pricing-table-card !rounded-3xl'>
    <div className='flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center'>
      <Search className='mb-3 size-10 text-[var(--app-text-muted)] opacity-40' />
      <h3 className='mb-1 text-base font-semibold'>{t('No models found')}</h3>
      <p className='mb-5 max-w-xs text-sm text-[var(--app-text-muted)]'>
        {searchQuery
          ? t(
              'No results for "{{query}}". Try adjusting your search or filters.',
              {
                query: searchQuery,
              },
            )
          : t('No models match your current filters.')}
      </p>
      {(hasActiveFilters || searchQuery) && (
        <Button theme='outline' type='tertiary' onClick={onClearAll}>
          {t('Clear all filters')}
        </Button>
      )}
    </div>
  </div>
);

const PricingCardGrid = ({
  t,
  models,
  page,
  onPageChange,
  tokenUnit,
  buildPriceItems,
  onModelClick,
  onCopyModel,
  perfMap,
}) => {
  const totalPages = Math.max(1, Math.ceil(models.length / DEFAULT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedModels = models.slice(
    (currentPage - 1) * DEFAULT_PAGE_SIZE,
    currentPage * DEFAULT_PAGE_SIZE,
  );

  return (
    <div className='space-y-4'>
      <div className='grid pricing-card-grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3'>
        {pagedModels.map((model) => {
          const priceItems = buildPriceItems(model).slice(0, 3);
          const tags = parseTags(model.tags);
          const groups = model.enable_groups || [];
          const endpoints = model.supported_endpoint_types || [];
          const icon = model.vendor_icon
            ? getLobeHubIcon(model.vendor_icon, 28)
            : null;
          const initial = model.model_name?.charAt(0).toUpperCase() || '?';
          const primaryGroup = groups[0];
          const bottomTags = [...endpoints.slice(0, 2), ...tags.slice(0, 2)];
          const hiddenCount =
            Math.max(groups.length - 1, 0) +
            Math.max(endpoints.length - 2, 0) +
            Math.max(tags.length - 2, 0);
          const perf = perfMap?.[model.model_name] || null;

          return (
            <Card
              key={model.id || model.model_name}
              className='pricing-model-card pricing-model-card-default cursor-pointer'
              onClick={() => onModelClick(model)}
            >
              <div className='pricing-model-card-head flex items-start justify-between'>
                <div className='flex min-w-0 items-start gap-3'>
                  <div className='pricing-model-card-icon-shell'>
                    {icon || (
                      <Avatar
                        size='small'
                        style={{ backgroundColor: 'transparent' }}
                      >
                        {initial}
                      </Avatar>
                    )}
                  </div>
                  <div className='min-w-0'>
                    <div className='pricing-model-card-title truncate'>
                      {model.model_name}
                    </div>
                    <div className='pricing-model-card-meta mt-2 flex flex-wrap items-center gap-2'>
                      <span className='pricing-model-card-vendor'>
                        {model.vendor_name || t('Unknown vendor')}
                      </span>
                      <Tag
                        color={model.quota_type === 0 ? 'violet' : 'teal'}
                        shape='circle'
                        size='small'
                      >
                        {model.quota_type === 0
                          ? t('Token-based')
                          : t('Per Request')}
                      </Tag>
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Button
                    theme='outline'
                    type='tertiary'
                    className='pricing-toolbar-button'
                    onClick={(event) => {
                      event.stopPropagation();
                      onModelClick(model);
                    }}
                  >
                    {t('详情')}
                  </Button>
                  <Button
                    theme='outline'
                    type='tertiary'
                    icon={<Copy size={14} />}
                    className='pricing-model-card-copy'
                    onClick={(event) => {
                      event.stopPropagation();
                      onCopyModel(model.model_name);
                    }}
                  />
                </div>
              </div>

              <Paragraph
                className='pricing-model-card-description mt-4 mb-0'
                ellipsis={{ rows: 2 }}
              >
                {model.description || t('No description available.')}
              </Paragraph>

              <div className='pricing-model-card-price-section'>
                <div className='pricing-model-card-price-section-head'>
                  <span className='pricing-model-card-price-label'>
                    {t('Price')}
                  </span>
                </div>
                <div className='pricing-model-card-price-grid'>
                  {priceItems.map((item) => (
                    <div
                      key={item.key}
                      className='pricing-model-card-price-row'
                    >
                      <span className='pricing-model-card-price-name'>
                        {item.label}
                      </span>
                      <div className='pricing-model-card-price-value-wrap'>
                        <span className='pricing-model-card-price-value'>
                          {item.value}
                        </span>
                        {item.suffix ? (
                          <span className='pricing-model-card-price-suffix'>
                            {item.suffix}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className='pricing-model-card-foot mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 items-start'>
                <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                  {primaryGroup ? (
                    <span className='text-xs font-medium text-[var(--app-text-muted)]'>
                      {primaryGroup} {t('Groups')}
                    </span>
                  ) : null}
                  <span className='text-xs font-medium text-[var(--app-text-muted)]'>
                    {model.quota_type === 0
                      ? t('Token-based')
                      : t('Per Request')}
                  </span>
                </div>
                <PerfBadge perf={perf} t={t} />

                <div className='flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1'>
                  {bottomTags.map((item) => (
                    <span
                      key={item}
                      className='text-xs text-[var(--app-text-muted)]'
                    >
                      {item}
                    </span>
                  ))}
                  <span className='text-xs text-[var(--app-text-muted)] opacity-70'>
                    {tokenUnit === 'K' ? '1K' : '1M'}
                  </span>
                  {hiddenCount > 0 ? (
                    <span className='text-xs text-[var(--app-text-muted)] opacity-60'>
                      +{hiddenCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className='pricing-table-card !rounded-3xl'>
          <div className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
            <Text type='tertiary'>
              {t('Page {{current}} of {{total}}', {
                current: currentPage,
                total: totalPages,
              })}
            </Text>
            <div className='flex items-center gap-2'>
              <Button
                theme='outline'
                type='tertiary'
                icon={<ChevronLeft size={14} />}
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                {t('上一步')}
              </Button>
              <Button
                theme='outline'
                type='tertiary'
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                {t('下一步')}
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PricingTableView = ({
  t,
  models,
  page,
  onPageChange,
  buildPriceItems,
  onModelClick,
}) => {
  const pagedModels = models.slice(
    (page - 1) * DEFAULT_PAGE_SIZE,
    page * DEFAULT_PAGE_SIZE,
  );

  const columns = [
    {
      title: t('Model'),
      dataIndex: 'model_name',
      render: (_, record) => (
        <div className='pricing-table-model-cell gap-2'>
          {record.vendor_icon ? getLobeHubIcon(record.vendor_icon, 16) : null}
          <span className='font-mono text-sm font-medium'>
            {record.model_name}
          </span>
        </div>
      ),
    },
    {
      title: t('Type'),
      dataIndex: 'quota_type',
      render: (value) => (
        <Text type='tertiary' size='small'>
          {value === 0 ? t('Token') : t('Request')}
        </Text>
      ),
    },
    {
      title: t('Price'),
      dataIndex: 'price',
      render: (_, record) => {
        const items = buildPriceItems(record);
        const first = items[0];
        const second = items[1];
        return (
          <div className='pricing-table-price-stack'>
            {first ? (
              <div className='pricing-table-price-line'>
                <span className='pricing-table-price-label'>{first.label}</span>
                <span className='pricing-table-price-value'>
                  {first.value}
                  {first.suffix || ''}
                </span>
              </div>
            ) : (
              <Text type='tertiary'>-</Text>
            )}
            {second ? (
              <div className='pricing-table-price-line'>
                <span className='pricing-table-price-label'>
                  {second.label}
                </span>
                <span className='pricing-table-price-value'>
                  {second.value}
                  {second.suffix || ''}
                </span>
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: t('Cached'),
      dataIndex: 'cached_price',
      render: (_, record) => {
        const items = buildPriceItems(record);
        const cached = items.find((item) => item.key.includes('cache'));
        if (!cached) return <Text type='tertiary'>-</Text>;
        return (
          <div className='pricing-table-price-stack'>
            <div className='pricing-table-price-line'>
              <span className='pricing-table-price-label'>{cached.label}</span>
              <span className='pricing-table-price-value'>
                {cached.value}
                {cached.suffix || ''}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: t('Vendor'),
      dataIndex: 'vendor_name',
      render: (value, record) =>
        value ? (
          <div className='flex items-center gap-1.5 text-sm text-[var(--app-text-secondary)]'>
            {record.vendor_icon ? getLobeHubIcon(record.vendor_icon, 12) : null}
            {value}
          </div>
        ) : (
          <Text type='tertiary'>-</Text>
        ),
    },
    {
      title: t('Tags'),
      dataIndex: 'tags',
      render: (value) => {
        const tags = parseTags(value);
        if (tags.length === 0) return <Text type='tertiary'>-</Text>;
        return (
          <Tooltip content={tags.join(', ')}>
            <div className='pricing-table-endpoint-list flex flex-wrap'>
              {tags.slice(0, 2).map((tag) => (
                <Tag
                  key={tag}
                  shape='circle'
                  size='small'
                  color={stringToColor(tag)}
                >
                  {tag}
                </Tag>
              ))}
              {tags.length > 2 ? (
                <Tag shape='circle' size='small' color='white'>
                  +{tags.length - 2}
                </Tag>
              ) : null}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: t('Endpoints'),
      dataIndex: 'supported_endpoint_types',
      render: (value = []) => {
        if (!value.length) return <Text type='tertiary'>-</Text>;
        return (
          <Tooltip content={value.join(', ')}>
            <div className='pricing-table-endpoint-list flex flex-wrap'>
              {value.slice(0, 2).map((item) => (
                <Tag key={item} shape='circle' size='small' color='white'>
                  {item}
                </Tag>
              ))}
              {value.length > 2 ? (
                <Tag shape='circle' size='small' color='white'>
                  +{value.length - 2}
                </Tag>
              ) : null}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: t('Groups'),
      dataIndex: 'enable_groups',
      render: (value = []) => {
        if (!value.length) return <Text type='tertiary'>-</Text>;
        return (
          <Tooltip content={value.join(', ')}>
            <div className='pricing-table-endpoint-list flex flex-wrap'>
              {value.slice(0, 2).map((group) => (
                <Tag key={group} shape='circle' size='small' color='blue'>
                  {group}
                </Tag>
              ))}
              {value.length > 2 ? (
                <Tag shape='circle' size='small' color='white'>
                  +{value.length - 2}
                </Tag>
              ) : null}
            </div>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Card
      className='pricing-table-card table-scroll-card !rounded-xl overflow-hidden'
      bordered={false}
    >
      <Table
        className='pricing-model-table'
        columns={columns}
        dataSource={pagedModels}
        pagination={{
          currentPage: page,
          pageSize: DEFAULT_PAGE_SIZE,
          total: models.length,
          showSizeChanger: false,
          onPageChange,
        }}
        onRow={(record) => ({
          onClick: () => onModelClick(record),
          style: { cursor: 'pointer' },
        })}
        empty={
          <Empty
            description={t('No models match your current filters.')}
            style={{ padding: 30 }}
          />
        }
      />
    </Card>
  );
};

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const isMobile = useIsMobile();
  const [mobileFilterVisible, setMobileFilterVisible] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.NAME);
  const [vendorFilter, setVendorFilter] = useState(FILTER_ALL);
  const [groupFilter, setGroupFilter] = useState(FILTER_ALL);
  const [quotaTypeFilter, setQuotaTypeFilter] = useState(QUOTA_TYPES.ALL);
  const [endpointTypeFilter, setEndpointTypeFilter] = useState(
    ENDPOINT_TYPES.ALL,
  );
  const [tagFilter, setTagFilter] = useState(FILTER_ALL);
  const [tokenUnit, setTokenUnit] = useState('M');
  const [viewMode, setViewMode] = useState(VIEW_MODES.CARD);
  const [showRechargePrice, setShowRechargePrice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showModelDetail, setShowModelDetail] = useState(false);
  const [perfMap, setPerfMap] = useState({});

  const t = pricingData.t;
  const siteDisplayType = pricingData.siteDisplayType || 'USD';
  const currency =
    siteDisplayType === 'CNY'
      ? 'CNY'
      : siteDisplayType === 'CUSTOM'
        ? 'CUSTOM'
        : 'USD';
  const customExchangeRate =
    pricingData.statusState?.status?.custom_currency_exchange_rate ?? 1;
  const customCurrencySymbol =
    pricingData.statusState?.status?.custom_currency_symbol ?? '¤';

  const vendors = useMemo(
    () =>
      Object.values(pricingData.vendorsMap || {}).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [pricingData.vendorsMap],
  );
  const groups = useMemo(
    () =>
      Object.keys(pricingData.usableGroup || {}).filter(
        (group) => !EXCLUDED_GROUPS.includes(group),
      ),
    [pricingData.usableGroup],
  );
  const availableTags = useMemo(
    () => extractAllTags(pricingData.models || []),
    [pricingData.models],
  );

  const filters = {
    search: searchInput,
    sortBy,
    vendor: vendorFilter,
    group: groupFilter,
    quotaType: quotaTypeFilter,
    endpointType: endpointTypeFilter,
    tag: tagFilter,
  };

  const filteredModels = useMemo(
    () => filterAndSortModels(pricingData.models || [], filters),
    [
      pricingData.models,
      searchInput,
      sortBy,
      vendorFilter,
      groupFilter,
      quotaTypeFilter,
      endpointTypeFilter,
      tagFilter,
    ],
  );

  const hasActiveFilters =
    vendorFilter !== FILTER_ALL ||
    groupFilter !== FILTER_ALL ||
    quotaTypeFilter !== QUOTA_TYPES.ALL ||
    endpointTypeFilter !== ENDPOINT_TYPES.ALL ||
    tagFilter !== FILTER_ALL;
  const activeFilterCount =
    (vendorFilter !== FILTER_ALL ? 1 : 0) +
    (groupFilter !== FILTER_ALL ? 1 : 0) +
    (quotaTypeFilter !== QUOTA_TYPES.ALL ? 1 : 0) +
    (endpointTypeFilter !== ENDPOINT_TYPES.ALL ? 1 : 0) +
    (tagFilter !== FILTER_ALL ? 1 : 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    viewMode,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadPerfSummary = async () => {
      try {
        const res = await API.get('/api/perf-metrics/summary', {
          params: { hours: 24 },
          skipErrorHandler: true,
        });
        const { success, data } = res.data || {};
        if (!cancelled && success) {
          const nextMap = {};
          (data?.models || []).forEach((item) => {
            if (item?.model_name) {
              nextMap[item.model_name] = item;
            }
          });
          setPerfMap(nextMap);
        }
      } catch (error) {
        if (!cancelled) {
          setPerfMap({});
        }
      }
    };

    loadPerfSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearFilters = useCallback(() => {
    setVendorFilter(FILTER_ALL);
    setGroupFilter(FILTER_ALL);
    setQuotaTypeFilter(QUOTA_TYPES.ALL);
    setEndpointTypeFilter(ENDPOINT_TYPES.ALL);
    setTagFilter(FILTER_ALL);
  }, []);

  const clearAll = useCallback(() => {
    clearFilters();
    setSearchInput('');
  }, [clearFilters]);

  const onFilterChange = useCallback((key, value) => {
    if (key === 'vendor') setVendorFilter(value);
    if (key === 'group') setGroupFilter(value);
    if (key === 'quotaType') setQuotaTypeFilter(value);
    if (key === 'endpointType') setEndpointTypeFilter(value);
    if (key === 'tag') setTagFilter(value);
  }, []);

  const handleModelClick = useCallback((model) => {
    setSelectedModel(model);
    setShowModelDetail(true);
  }, []);

  const handleCopyModel = useCallback(
    async (modelName) => {
      const ok = await copy(modelName);
      if (ok) {
        showSuccess(t('已复制：') + modelName);
      }
    },
    [t],
  );

  const displayPrice = useCallback(
    (priceInUSD, precision = 4) =>
      buildDefaultDisplayPrice({
        priceInUSD,
        siteDisplayType,
        showRechargePrice,
        priceRate: pricingData.priceRate,
        usdExchangeRate: pricingData.usdExchangeRate,
        customExchangeRate,
        customCurrencySymbol,
        precision,
      }),
    [
      siteDisplayType,
      showRechargePrice,
      pricingData.priceRate,
      pricingData.usdExchangeRate,
      customExchangeRate,
      customCurrencySymbol,
    ],
  );

  const buildPriceItems = useCallback(
    (model) => {
      const priceData = calculateModelPrice({
        record: model,
        selectedGroup: FILTER_ALL,
        groupRatio: pricingData.groupRatio || {},
        tokenUnit,
        displayPrice,
        currency,
        quotaDisplayType: siteDisplayType,
      });
      return getModelPriceItems(priceData, t, siteDisplayType).filter(Boolean);
    },
    [
      pricingData.groupRatio,
      tokenUnit,
      displayPrice,
      currency,
      siteDisplayType,
      t,
    ],
  );

  const billingUnitLabel =
    siteDisplayType === 'TOKENS'
      ? t('每 {{unit}} Token', { unit: tokenUnit })
      : showRechargePrice
        ? t('Recharge')
        : t('Standard');

  return (
    <div className='pricing-page-surface'>
      <div className='pricing-overview'>
        <div className='pricing-overview-copy'>
          <div className='pricing-overview-mainline'>
            <div className='pricing-overview-heading'>
              <div className='pricing-overview-kicker'>
                {t('Models Directory')}
              </div>
              <h1 className='pricing-overview-title'>{t('Model Square')}</h1>
              <p className='pricing-overview-description'>
                {t('This site currently has {{count}} models enabled', {
                  count: pricingData.models.length || 0,
                })}
              </p>
              <p className='pricing-overview-subdescription'>
                {t(
                  'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.',
                )}
              </p>
            </div>

            <div className='pricing-overview-inline-meta'>
              <span className='pricing-overview-inline-chip'>
                <em>{t('Results')}</em>
                <strong>
                  {filteredModels.length}/{pricingData.models.length}
                </strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{t('Vendors')}</em>
                <strong>{vendors.length}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{t('Groups')}</em>
                <strong>{groups.length}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{t('View')}</em>
                <strong>
                  {viewMode === VIEW_MODES.CARD
                    ? t('Card view')
                    : t('Table view')}
                </strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{t('Billing unit')}</em>
                <strong>{billingUnitLabel}</strong>
              </span>
            </div>

            <div className='pricing-actions-search w-full max-w-2xl'>
              <Input
                prefix={<IconSearch />}
                suffix={
                  searchInput ? (
                    <Button
                      theme='borderless'
                      type='tertiary'
                      icon={<IconClose />}
                      onClick={() => setSearchInput('')}
                    />
                  ) : null
                }
                placeholder={t(
                  'Search model name, provider, endpoint, or tag...',
                )}
                size='large'
                value={searchInput}
                onChange={setSearchInput}
                showClear
                className='pricing-search-control'
              />
            </div>

            {(hasActiveFilters || searchInput) && (
              <div className='pricing-overview-filters'>
                <span className='pricing-overview-filters-label'>
                  {t('Current filters')}
                </span>
                {searchInput ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Search')}</em>
                    <strong>{searchInput}</strong>
                  </span>
                ) : null}
                {vendorFilter !== FILTER_ALL ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Vendor')}</em>
                    <strong>{vendorFilter}</strong>
                  </span>
                ) : null}
                {groupFilter !== FILTER_ALL ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Group')}</em>
                    <strong>{groupFilter}</strong>
                  </span>
                ) : null}
                {quotaTypeFilter !== QUOTA_TYPES.ALL ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Pricing Type')}</em>
                    <strong>
                      {quotaTypeFilter === QUOTA_TYPES.TOKEN
                        ? t('Token-based')
                        : t('Per Request')}
                    </strong>
                  </span>
                ) : null}
                {endpointTypeFilter !== ENDPOINT_TYPES.ALL ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Endpoint Type')}</em>
                    <strong>{endpointTypeFilter}</strong>
                  </span>
                ) : null}
                {tagFilter !== FILTER_ALL ? (
                  <span className='pricing-overview-filter-chip'>
                    <em>{t('Tag')}</em>
                    <strong>{tagFilter}</strong>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='pricing-layout pricing-workbench-layout'>
        {!isMobile && (
          <div className='pricing-sidebar pricing-sidebar-column'>
            <div className='pricing-sidebar-shell'>
              <FilterPanel
                t={t}
                filters={filters}
                models={pricingData.models}
                vendors={vendors}
                groups={groups}
                tags={availableTags}
                groupRatios={pricingData.groupRatio || {}}
                onChange={onFilterChange}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </div>
        )}

        <div className='pricing-content'>
          <div className='pricing-search-header'>
            <PricingToolbar
              t={t}
              filteredCount={filteredModels.length}
              totalCount={pricingData.models.length}
              sortBy={sortBy}
              onSortChange={setSortBy}
              tokenUnit={tokenUnit}
              onTokenUnitChange={setTokenUnit}
              showRechargePrice={showRechargePrice}
              onRechargePriceChange={setShowRechargePrice}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeFilterCount={activeFilterCount}
              onOpenFilters={() => setMobileFilterVisible(true)}
              isMobile={isMobile}
            />
          </div>

          <div
            className={
              isMobile
                ? 'pricing-view-container-mobile'
                : 'pricing-view-container'
            }
          >
            {pricingData.loading ? (
              <LoadingState />
            ) : filteredModels.length === 0 ? (
              <EmptyState
                t={t}
                searchQuery={searchInput}
                hasActiveFilters={hasActiveFilters}
                onClearAll={clearAll}
              />
            ) : viewMode === VIEW_MODES.CARD ? (
              <PricingCardGrid
                t={t}
                models={filteredModels}
                page={currentPage}
                onPageChange={setCurrentPage}
                tokenUnit={tokenUnit}
                buildPriceItems={buildPriceItems}
                onModelClick={handleModelClick}
                onCopyModel={handleCopyModel}
                perfMap={perfMap}
              />
            ) : (
              <PricingTableView
                t={t}
                models={filteredModels}
                page={currentPage}
                onPageChange={setCurrentPage}
                buildPriceItems={buildPriceItems}
                onModelClick={handleModelClick}
              />
            )}
          </div>
        </div>
      </div>

      <SideSheet
        title={t('Filter')}
        placement='right'
        visible={mobileFilterVisible}
        width={isMobile ? '100%' : 420}
        onCancel={() => setMobileFilterVisible(false)}
        closeIcon={<IconClose />}
        bodyStyle={{ padding: 16 }}
      >
        <FilterPanel
          t={t}
          filters={filters}
          models={pricingData.models}
          vendors={vendors}
          groups={groups}
          tags={availableTags}
          groupRatios={pricingData.groupRatio || {}}
          onChange={onFilterChange}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </SideSheet>

      <ModelDetailSideSheetV2
        visible={showModelDetail}
        onClose={() => {
          setShowModelDetail(false);
          setSelectedModel(null);
        }}
        modelData={selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={currency}
        siteDisplayType={siteDisplayType}
        tokenUnit={tokenUnit}
        displayPrice={displayPrice}
        showRatio={siteDisplayType === 'TOKENS'}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={t}
      />
    </div>
  );
};

export default PricingPage;
