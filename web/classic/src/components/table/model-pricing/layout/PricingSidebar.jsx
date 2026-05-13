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
import { Button, Collapsible } from '@douyinfe/semi-ui';
import { SlidersHorizontal } from 'lucide-react';
import PricingGroups from '../filter/PricingGroups';
import PricingQuotaTypes from '../filter/PricingQuotaTypes';
import PricingEndpointTypes from '../filter/PricingEndpointTypes';
import PricingVendors from '../filter/PricingVendors';
import PricingTags from '../filter/PricingTags';
import PricingModelTypes from '../filter/PricingModelTypes';

import { resetPricingFilters } from '../../../../helpers/utils';
import { usePricingFilterCounts } from '../../../../hooks/model-pricing/usePricingFilterCounts';

const PricingSidebar = ({
  showWithRecharge,
  setShowWithRecharge,
  currency,
  setCurrency,
  handleChange,
  showRatio,
  setShowRatio,
  viewMode,
  setViewMode,
  filterGroup,
  setFilterGroup,
  handleGroupClick,
  filterQuotaType,
  setFilterQuotaType,
  filterEndpointType,
  setFilterEndpointType,
  filterVendor,
  setFilterVendor,
  filterTag,
  setFilterTag,
  filterModelType,
  setFilterModelType,
  setSortBy,
  setCurrentPage,
  tokenUnit,
  setTokenUnit,
  loading,
  t,
  ...categoryProps
}) => {
  const hasAdvancedFilters =
    filterGroup !== 'all' ||
    filterQuotaType !== 'all' ||
    filterEndpointType !== 'all' ||
    filterTag !== 'all';
  const [showMoreFilters, setShowMoreFilters] =
    React.useState(hasAdvancedFilters);
  const {
    quotaTypeModels,
    endpointTypeModels,
    vendorModels,
    tagModels,
    groupCountModels,
    modelTypeCounts,
  } = usePricingFilterCounts({
    models: categoryProps.models,
    filterGroup,
    filterQuotaType,
    filterEndpointType,
    filterVendor,
    filterTag,
    filterModelType,
    searchValue: categoryProps.searchValue,
  });

  const handleResetFilters = () =>
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

  React.useEffect(() => {
    if (hasAdvancedFilters) {
      setShowMoreFilters(true);
    }
  }, [hasAdvancedFilters]);

  return (
    <div className='pricing-marketplace-sidebar-card'>
      <div className='pricing-marketplace-sidebar-head'>
        <div className='pricing-marketplace-sidebar-title'>
          <SlidersHorizontal size={16} strokeWidth={1.8} />
          <span>{t('筛选')}</span>
        </div>
        <Button
          theme='borderless'
          type='tertiary'
          onClick={handleResetFilters}
          size='small'
          className='pricing-marketplace-reset-button'
        >
          {t('重置')}
        </Button>
      </div>

      <PricingModelTypes
        filterModelType={filterModelType}
        setFilterModelType={setFilterModelType}
        modelTypeCounts={modelTypeCounts}
        loading={loading}
        defaultOpen
        t={t}
      />

      <PricingVendors
        filterVendor={filterVendor}
        setFilterVendor={setFilterVendor}
        models={vendorModels}
        allModels={categoryProps.models}
        loading={loading}
        compact
        defaultOpen={false}
        t={t}
      />

      <section className='pricing-marketplace-more-filters'>
        <button
          type='button'
          className='pricing-marketplace-more-filters-toggle'
          onClick={() => setShowMoreFilters((value) => !value)}
        >
          <span>{t('更多筛选')}</span>
          <span>{showMoreFilters ? t('收起') : t('展开')}</span>
        </button>

        <Collapsible isOpen={showMoreFilters}>
          <div className='pricing-marketplace-more-filters-content'>
            <PricingGroups
              filterGroup={filterGroup}
              setFilterGroup={handleGroupClick}
              usableGroup={categoryProps.usableGroup}
              groupRatio={categoryProps.groupRatio}
              models={groupCountModels}
              loading={loading}
              t={t}
            />

            <PricingQuotaTypes
              filterQuotaType={filterQuotaType}
              setFilterQuotaType={setFilterQuotaType}
              models={quotaTypeModels}
              loading={loading}
              t={t}
            />

            <PricingTags
              filterTag={filterTag}
              setFilterTag={setFilterTag}
              models={tagModels}
              allModels={categoryProps.models}
              loading={loading}
              t={t}
            />

            <PricingEndpointTypes
              filterEndpointType={filterEndpointType}
              setFilterEndpointType={setFilterEndpointType}
              models={endpointTypeModels}
              allModels={categoryProps.models}
              loading={loading}
              t={t}
            />
          </div>
        </Collapsible>
      </section>
    </div>
  );
};

export default PricingSidebar;
