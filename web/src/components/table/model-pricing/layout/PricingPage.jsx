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
import PricingSidebar from './PricingSidebar';
import PricingContent from './content/PricingContent';
import ModelDetailSideSheet from '../modal/ModelDetailSideSheet';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const isMobile = useIsMobile();
  const [showRatio, setShowRatio] = React.useState(false);
  const [viewMode, setViewMode] = React.useState('card');
  const allProps = {
    ...pricingData,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
  };

  // The page is rendered inside <main> from PageLayout, which already
  // handles the global header offset and provides a bounded height. We
  // just fill that container with `h-full` and create independent scroll
  // for the filter sidebar + main content. The previous `pt-[60px]` /
  // `h-[100dvh]` was a leftover from when this page rendered outside the
  // app shell — it duplicated the header offset and caused a redundant
  // viewport-sized box.
  //
  // Inner element is a `<div>` (not nested `<main>`) since PageLayout
  // already owns the document `<main>` landmark; nesting two would be
  // invalid HTML.
  return (
    <div className='flex h-full min-h-0 overflow-hidden bg-background'>
      {!isMobile && (
        <aside className='pricing-scroll-hide h-full w-72 shrink-0 overflow-y-auto border-r border-border bg-background px-2 py-4'>
          <PricingSidebar {...allProps} />
        </aside>
      )}

      <div className='pricing-scroll-hide h-full min-w-0 flex-1 overflow-y-auto bg-background'>
        <PricingContent
          {...allProps}
          isMobile={isMobile}
          sidebarProps={allProps}
        />
      </div>

      {pricingData.isModalOpenurl && pricingData.modalImageUrl ? (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          onClick={() => pricingData.setIsModalOpenurl(false)}
        >
          <img
            src={pricingData.modalImageUrl}
            alt=''
            className='max-h-[90vh] max-w-[90vw] rounded-2xl bg-white object-contain shadow-2xl'
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <ModelDetailSideSheet
        visible={pricingData.showModelDetail}
        onClose={pricingData.closeModelDetail}
        modelData={pricingData.selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={pricingData.currency}
        siteDisplayType={pricingData.siteDisplayType}
        tokenUnit={pricingData.tokenUnit}
        displayPrice={pricingData.displayPrice}
        showRatio={allProps.showRatio}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={pricingData.t}
      />
    </div>
  );
};

export default PricingPage;
