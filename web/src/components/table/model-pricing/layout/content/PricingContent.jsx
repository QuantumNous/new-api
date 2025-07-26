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
  return (
    <div className={isMobile ? "pricing-content-mobile" : "pricing-scroll-hide"}>
      {/* 固定的顶部区域（分类介绍 + 搜索和操作） */}
      <div className="pricing-search-header">
        <PricingTopSection {...props} isMobile={isMobile} sidebarProps={sidebarProps} />
      </div>

      {/* 可滚动的内容区域 */}
      <div className={isMobile ? "pricing-view-container-mobile" : "pricing-view-container"}>
        <PricingView {...props} viewMode={sidebarProps.viewMode} />
      </div>
    </div>
  );
};

export default PricingContent; 