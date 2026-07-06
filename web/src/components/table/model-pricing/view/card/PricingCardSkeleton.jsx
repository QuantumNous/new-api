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
import { Card } from '@douyinfe/semi-ui';

const PricingCardSkeleton = ({
  skeletonCount = 12,
  rowSelection = false,
  showRatio = false,
}) => {
  return (
    <div className='pricing-card-skeleton px-2 pt-2'>
      <div className='pricing-model-grid grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card
            key={index}
            className='pricing-model-card pricing-model-card-skeleton !rounded-2xl border'
            bodyStyle={{ height: '100%' }}
          >
            <div className='flex flex-col h-full'>
              {/* 头部：图标 + 模型名称 + 操作按钮 */}
              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-start space-x-3 flex-1 min-w-0'>
                  <div className='pricing-skeleton-avatar w-12 h-12 rounded-2xl' />
                  <div className='flex-1 min-w-0'>
                    <div
                      className='pricing-skeleton-line pricing-skeleton-title-line'
                      style={{ width: `${138 + (index % 3) * 28}px` }}
                    />
                    <div className='pricing-skeleton-price-stack'>
                      <div
                        className='pricing-skeleton-line pricing-skeleton-price-line'
                        style={{ width: `${170 + (index % 2) * 26}px` }}
                      />
                      <div
                        className='pricing-skeleton-line pricing-skeleton-price-line'
                        style={{ width: `${150 + (index % 3) * 20}px` }}
                      />
                      {index % 3 === 0 && (
                        <div className='pricing-skeleton-line pricing-skeleton-price-line pricing-skeleton-price-line-short' />
                      )}
                    </div>
                  </div>
                </div>

                <div className='flex items-center space-x-2 ml-3'>
                  <div className='pricing-skeleton-icon-button' />
                  {rowSelection && (
                    <div className='pricing-skeleton-icon-button' />
                  )}
                </div>
              </div>

              {/* 模型描述 - 占据剩余空间 */}
              <div className='pricing-skeleton-description flex-1 mb-4' />

              {/* 底部区域 */}
              <div className='mt-auto'>
                <div className='flex items-center justify-between'>
                  <div className='pricing-skeleton-pill pricing-skeleton-billing-pill' />
                  <div className='flex items-center gap-1'>
                    {index % 2 === 0 && (
                      <div className='pricing-skeleton-pill pricing-skeleton-tag-pill' />
                    )}
                    {index % 3 === 0 && (
                      <div className='pricing-skeleton-pill pricing-skeleton-tag-pill' />
                    )}
                  </div>
                </div>

                {showRatio && (
                  <div className='pt-3'>
                    <div className='flex items-center space-x-1 mb-2'>
                      <div className='pricing-skeleton-line pricing-skeleton-ratio-label' />
                      <div className='pricing-skeleton-dot' />
                    </div>
                    <div className='pricing-ratio-grid grid grid-cols-3 gap-2'>
                      {Array.from({ length: 3 }).map((_, ratioIndex) => (
                        <div
                          key={ratioIndex}
                          className='pricing-skeleton-line pricing-skeleton-ratio-line'
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
        <div className='pricing-skeleton-pagination' />
      </div>
    </div>
  );
};

export default PricingCardSkeleton;
