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
import { Skeleton } from '@heroui/react';

// Flat skeleton matching the redesigned PricingVendorIntro — avatar
// square + (title row, description) + a faux search/actions row. No
// gradient cover.
const PricingVendorIntroSkeleton = memo(({ isMobile = false }) => {
  return (
    <div className='flex flex-col gap-3 pb-3'>
      <div className='flex items-start gap-3'>
        <Skeleton className='h-12 w-12 shrink-0 rounded-2xl' />
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-5 w-24 rounded' />
            <Skeleton className='h-5 w-20 rounded-full' />
          </div>
          <Skeleton className='h-3.5 w-full rounded' />
          <Skeleton className='h-3.5 w-3/4 rounded' />
        </div>
      </div>

      <div className='flex w-full items-center gap-2'>
        <Skeleton className='h-9 flex-1 rounded-lg' />
        <Skeleton className='h-9 w-20 rounded-lg' />
        {isMobile ? <Skeleton className='h-9 w-20 rounded-lg' /> : null}
      </div>
    </div>
  );
});

PricingVendorIntroSkeleton.displayName = 'PricingVendorIntroSkeleton';

export default PricingVendorIntroSkeleton;
