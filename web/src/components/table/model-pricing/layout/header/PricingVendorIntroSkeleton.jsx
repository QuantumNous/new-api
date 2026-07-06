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

import React, { memo } from 'react';
import { Card } from '@douyinfe/semi-ui';

const createSkeletonRect = (className, style = {}) => (
  <div className={`pricing-skeleton-block ${className}`} style={style} />
);

const PricingVendorIntroSkeleton = memo(
  ({ isAllVendors = false, isMobile = false }) => {
    return (
      <Card
        className='pricing-hero-card pricing-hero-skeleton !rounded-2xl border-0'
        bodyStyle={{ padding: 0 }}
        style={{
          '--pricing-hero-accent-channel': isAllVendors
            ? '37 99 235'
            : '16 185 129',
        }}
      >
        <div className='pricing-hero-main'>
          <div className='pricing-hero-copy'>
            {createSkeletonRect('pricing-skeleton-eyebrow')}
            <div className='pricing-hero-title-row'>
              {createSkeletonRect('pricing-skeleton-hero-title')}
              {createSkeletonRect('pricing-skeleton-hero-tag')}
            </div>
            <div className='pricing-hero-description pricing-skeleton-hero-description'>
              {createSkeletonRect('pricing-skeleton-hero-desc-line')}
              {createSkeletonRect(
                'pricing-skeleton-hero-desc-line pricing-skeleton-hero-desc-short',
              )}
            </div>
          </div>

          <div className='pricing-hero-metrics'>
            <div className='pricing-hero-metric pricing-hero-metric-skeleton'>
              {createSkeletonRect('pricing-skeleton-metric-value')}
              {createSkeletonRect('pricing-skeleton-metric-label')}
            </div>
            <div className='pricing-hero-metric pricing-hero-metric-skeleton'>
              {createSkeletonRect('pricing-skeleton-metric-value')}
              {createSkeletonRect('pricing-skeleton-metric-label')}
            </div>
            <div className='pricing-hero-avatar-wrap pricing-hero-skeleton-avatar-wrap'>
              {createSkeletonRect('pricing-skeleton-hero-avatar')}
            </div>
          </div>
        </div>

        <div className='pricing-hero-toolbar'>
          <div className='pricing-action-bar'>
            <div className='pricing-search-box'>
              {createSkeletonRect('pricing-skeleton-search-input')}
            </div>
            {createSkeletonRect(
              'pricing-skeleton-action-button pricing-skeleton-copy-button',
            )}
            {!isMobile && (
              <>
                {createSkeletonRect(
                  'pricing-skeleton-control-chip pricing-skeleton-recharge-chip',
                )}
                {createSkeletonRect(
                  'pricing-skeleton-control-chip pricing-skeleton-ratio-chip',
                )}
                {createSkeletonRect(
                  'pricing-skeleton-action-button pricing-skeleton-view-button',
                )}
                {createSkeletonRect(
                  'pricing-skeleton-action-button pricing-skeleton-unit-button',
                )}
              </>
            )}
            {isMobile && createSkeletonRect('pricing-skeleton-action-button')}
          </div>
        </div>
      </Card>
    );
  },
);

PricingVendorIntroSkeleton.displayName = 'PricingVendorIntroSkeleton';

export default PricingVendorIntroSkeleton;
