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
import { Card } from '@heroui/react';

const PricingCardSkeleton = ({
  skeletonCount = 100,
  rowSelection = false,
  showRatio = false,
}) => {
  const SkeletonLine = ({ className = '' }) => (
    <div className={`animate-pulse rounded bg-surface-secondary ${className}`} />
  );

  return (
    <div className='px-2 pt-2'>
      <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card key={index} className='rounded-2xl border border-gray-200'>
            <Card.Content className='p-6'>
            {/* Header: icon, model name, actions. */}
            <div className='flex items-start justify-between mb-3'>
              <div className='flex items-start space-x-3 flex-1 min-w-0'>
                {/* Model icon skeleton. */}
                <div className='w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-sm'>
                  <SkeletonLine className='h-12 w-12 rounded-2xl' />
                </div>
                {/* Model name and price skeleton. */}
                <div className='flex-1 min-w-0'>
                  <SkeletonLine
                    className='mb-2 h-5'
                    style={{ width: `${120 + (index % 3) * 30}px` }}
                  />
                  <SkeletonLine
                    className='h-5'
                    style={{ width: `${160 + (index % 4) * 20}px` }}
                  />
                </div>
              </div>

              <div className='flex items-center space-x-2 ml-3'>
                <SkeletonLine className='h-4 w-4 rounded' />
                {rowSelection && <SkeletonLine className='h-4 w-4 rounded-sm' />}
              </div>
            </div>

            {/* Model description skeleton. */}
            <div className='mb-4'>
              <SkeletonLine className='mb-2 h-4 w-full' />
              <SkeletonLine className='h-4 w-4/5' />
            </div>

            {/* Tags skeleton. */}
            <div className='flex flex-wrap gap-2'>
              {Array.from({ length: 2 + (index % 3) }).map((_, tagIndex) => (
                <SkeletonLine key={tagIndex} className='h-[18px] w-16 rounded-full' />
              ))}
            </div>

            {/* Ratio info skeleton. */}
            {showRatio && (
              <div className='mt-4 pt-3 border-t border-border'>
                <div className='flex items-center space-x-1 mb-2'>
                  <SkeletonLine className='h-3 w-14' />
                  <SkeletonLine className='h-3.5 w-3.5 rounded-full' />
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  {Array.from({ length: 3 }).map((_, ratioIndex) => (
                    <SkeletonLine key={ratioIndex} className='h-3 w-full' />
                  ))}
                </div>
              </div>
            )}
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* Pagination skeleton. */}
      <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
        <SkeletonLine className='h-8 w-[300px]' />
      </div>
    </div>
  );
};

export default PricingCardSkeleton;
