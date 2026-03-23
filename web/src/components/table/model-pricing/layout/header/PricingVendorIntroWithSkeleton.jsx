import React, { memo } from 'react';
import PricingVendorIntro from './PricingVendorIntro';
import PricingVendorIntroSkeleton from './PricingVendorIntroSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';

const PricingVendorIntroWithSkeleton = memo(
  ({ loading = false, filterVendor, ...restProps }) => {
    const showSkeleton = useMinimumLoadingTime(loading);

    if (showSkeleton) {
      return (
        <PricingVendorIntroSkeleton
          isAllVendors={filterVendor === 'all'}
          isMobile={restProps.isMobile}
        />
      );
    }

    return <PricingVendorIntro filterVendor={filterVendor} {...restProps} />;
  },
);

PricingVendorIntroWithSkeleton.displayName = 'PricingVendorIntroWithSkeleton';

export default PricingVendorIntroWithSkeleton;
