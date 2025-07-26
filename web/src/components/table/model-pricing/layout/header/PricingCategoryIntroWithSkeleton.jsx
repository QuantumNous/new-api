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
import PricingCategoryIntro from './PricingCategoryIntro';
import PricingCategoryIntroSkeleton from './PricingCategoryIntroSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';

const PricingCategoryIntroWithSkeleton = ({
  loading = false,
  activeKey,
  modelCategories,
  categoryCounts,
  availableCategories,
  t
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);

  if (showSkeleton) {
    return (
      <PricingCategoryIntroSkeleton
        isAllModels={activeKey === 'all'}
      />
    );
  }

  return (
    <PricingCategoryIntro
      activeKey={activeKey}
      modelCategories={modelCategories}
      categoryCounts={categoryCounts}
      availableCategories={availableCategories}
      t={t}
    />
  );
};

export default PricingCategoryIntroWithSkeleton; 