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

import React, { useState, memo } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import PricingFilterModal from '../../modal/PricingFilterModal';
import PricingMarketplaceHero from './PricingMarketplaceHero';
import SearchActions from './SearchActions';
import { resetPricingFilters } from '../../../../../helpers/utils';
import { getModelTypeLabel } from '../../utils/modelType';

const getQuotaTypeLabel = (value, t) => {
  if (value === 0) return t('按量计费');
  if (value === 1) return t('按次计费');
  return value;
};

const getSortLabel = (value, t) => {
  const sortLabels = {
    popular: t('热门'),
    name: t('名称'),
    vendor: t('供应商'),
    type: t('类型'),
  };
  return sortLabels[value] || value;
};

const buildActiveFilters = ({
  searchValue,
  filterVendor,
  filterGroup,
  filterEndpointType,
  filterTag,
  filterQuotaType,
  filterModelType,
  sortBy,
  t,
}) => {
  const filters = [];
  if (searchValue) filters.push(`${t('搜索')}: ${searchValue}`);
  if (filterVendor && filterVendor !== 'all') {
    filters.push(
      `${t('供应商')}: ${filterVendor === 'unknown' ? t('未知供应商') : filterVendor}`,
    );
  }
  if (filterModelType && filterModelType !== 'all') {
    filters.push(`${t('模型类型')}: ${t(getModelTypeLabel(filterModelType))}`);
  }
  if (filterEndpointType && filterEndpointType !== 'all') {
    filters.push(`${t('端点')}: ${filterEndpointType}`);
  }
  if (filterTag && filterTag !== 'all') {
    filters.push(`${t('标签')}: ${filterTag}`);
  }
  if (filterQuotaType !== 'all') {
    filters.push(`${t('计费')}: ${getQuotaTypeLabel(filterQuotaType, t)}`);
  }
  if (filterGroup && filterGroup !== 'all') {
    filters.push(`${t('分组')}: ${filterGroup}`);
  }
  if (sortBy && sortBy !== 'popular') {
    filters.push(`${t('排序')}: ${getSortLabel(sortBy, t)}`);
  }
  return filters;
};

const PricingTopSection = memo(
  ({
    selectedRowKeys,
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile,
    sidebarProps,
    models,
    filteredModels,
    loading,
    searchValue,
    showWithRecharge,
    setShowWithRecharge,
    currency,
    setCurrency,
    siteDisplayType,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
    tokenUnit,
    setTokenUnit,
    t,
  }) => {
    const [showFilterModal, setShowFilterModal] = useState(false);
    const { sortBy, setSortBy } = sidebarProps;
    const resetFilters = () =>
      resetPricingFilters({
        handleChange,
        setShowWithRecharge,
        setCurrency,
        setShowRatio,
        setViewMode,
        setFilterGroup: sidebarProps.setFilterGroup,
        setFilterQuotaType: sidebarProps.setFilterQuotaType,
        setFilterEndpointType: sidebarProps.setFilterEndpointType,
        setFilterVendor: sidebarProps.setFilterVendor,
        setFilterTag: sidebarProps.setFilterTag,
        setFilterModelType: sidebarProps.setFilterModelType,
        setSortBy,
        setCurrentPage: sidebarProps.setCurrentPage,
        setTokenUnit,
      });
    const activeFilters = buildActiveFilters({
      searchValue,
      filterVendor: sidebarProps.filterVendor,
      filterGroup: sidebarProps.filterGroup,
      filterEndpointType: sidebarProps.filterEndpointType,
      filterTag: sidebarProps.filterTag,
      filterQuotaType: sidebarProps.filterQuotaType,
      filterModelType: sidebarProps.filterModelType,
      sortBy,
      t,
    });

    return (
      <>
        <PricingMarketplaceHero
          models={models}
          filteredModels={filteredModels}
          vendorsMap={sidebarProps.vendorsMap}
          loading={loading}
          t={t}
        />

        <div className='pricing-marketplace-search-card'>
          <SearchActions
            selectedRowKeys={selectedRowKeys}
            copyText={copyText}
            handleChange={handleChange}
            handleCompositionStart={handleCompositionStart}
            handleCompositionEnd={handleCompositionEnd}
            isMobile={isMobile}
            searchValue={searchValue}
            setShowFilterModal={setShowFilterModal}
            showWithRecharge={showWithRecharge}
            setShowWithRecharge={setShowWithRecharge}
            currency={currency}
            setCurrency={setCurrency}
            siteDisplayType={siteDisplayType}
            showRatio={showRatio}
            setShowRatio={setShowRatio}
            viewMode={viewMode}
            setViewMode={setViewMode}
            tokenUnit={tokenUnit}
            setTokenUnit={setTokenUnit}
            sortBy={sortBy}
            setSortBy={setSortBy}
            t={t}
          />

          {activeFilters.length > 0 && (
            <div className='pricing-marketplace-filter-summary'>
              <div className='pricing-marketplace-filter-chips'>
                {activeFilters.map((filter) => (
                  <Tag key={filter} shape='circle' color='white'>
                    {filter}
                  </Tag>
                ))}
              </div>
              <Button
                size='small'
                theme='borderless'
                type='tertiary'
                onClick={resetFilters}
              >
                {t('清空筛选')}
              </Button>
            </div>
          )}
        </div>

        <PricingFilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          sidebarProps={sidebarProps}
          t={t}
        />
      </>
    );
  },
);

PricingTopSection.displayName = 'PricingTopSection';

export default PricingTopSection;
