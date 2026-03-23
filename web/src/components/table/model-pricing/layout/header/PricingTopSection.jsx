import React, { useState, memo } from 'react';
import PricingFilterModal from '../../modal/PricingFilterModal';
import PricingVendorIntroWithSkeleton from './PricingVendorIntroWithSkeleton';
import SearchActions from './SearchActions';

const PricingTopSection = memo(
  ({
    selectedRowKeys,
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile,
    sidebarProps,
    filterVendor,
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

    return (
      <>
        {isMobile ? (
          <>
            <div className='w-full'>
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
                t={t}
              />
            </div>
            <PricingFilterModal
              visible={showFilterModal}
              onClose={() => setShowFilterModal(false)}
              sidebarProps={sidebarProps}
              t={t}
            />
          </>
        ) : (
          <PricingVendorIntroWithSkeleton
            loading={loading}
            filterVendor={filterVendor}
            models={filteredModels}
            allModels={models}
            t={t}
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
          />
        )}
      </>
    );
  },
);

PricingTopSection.displayName = 'PricingTopSection';

export default PricingTopSection;
