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
import PricingTopSection from '../header/PricingTopSection';
import PricingView from './PricingView';

const PricingContent = ({ isMobile, sidebarProps, ...props }) => {
  // `min-h-full` lets the column fill its parent (which is already height-
  // bounded by PageLayout's main + PricingPage's flex container). The old
  // `min-h-[calc(100dvh-60px)]` hard-coded the global header height which
  // duplicated the offset PageLayout already accounts for.
  return (
    <div
      className={
        isMobile
          ? 'flex min-h-full flex-col'
          : 'pricing-scroll-hide flex min-h-full flex-col'
      }
    >
      {/* Sticky header with vendor intro, search, and actions.
          Top padding is `pt-6` (24px) to give breathing room from the
          global navbar above — `pt-4` left the vendor name flush against
          the navbar bottom edge. */}
      <div className='sticky top-0 z-10 bg-background/95 px-4 pt-6 pb-3 backdrop-blur'>
        <PricingTopSection
          {...props}
          isMobile={isMobile}
          sidebarProps={sidebarProps}
          showWithRecharge={sidebarProps.showWithRecharge}
          setShowWithRecharge={sidebarProps.setShowWithRecharge}
          currency={sidebarProps.currency}
          setCurrency={sidebarProps.setCurrency}
          showRatio={sidebarProps.showRatio}
          setShowRatio={sidebarProps.setShowRatio}
          viewMode={sidebarProps.viewMode}
          setViewMode={sidebarProps.setViewMode}
          tokenUnit={sidebarProps.tokenUnit}
          setTokenUnit={sidebarProps.setTokenUnit}
        />
      </div>

      {/* Scrollable content area. */}
      <div
        className={
          isMobile
            ? 'min-h-0 flex-1 px-4 pb-4'
            : 'min-h-0 flex-1 px-4 pb-6'
        }
      >
        <PricingView {...props} viewMode={sidebarProps.viewMode} />
      </div>
    </div>
  );
};

export default PricingContent;
