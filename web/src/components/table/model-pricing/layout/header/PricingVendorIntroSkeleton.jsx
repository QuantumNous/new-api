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
import { Card, Skeleton } from '@douyinfe/semi-ui';

const THEME_COLORS = {
  allVendors: {
    background: 'var(--na-accent-primary-light-default)',
    border: 'var(--na-accent-primary-light-hover)',
  },
  specific: {
    background: 'var(--semi-color-success-light-default)',
    border: 'var(--semi-color-success-light-hover)',
  },
  neutral: {
    background: 'var(--semi-color-fill-0)',
    border: 'var(--semi-color-fill-2)',
  },
};

const SIZES = {
  title: { width: { all: 120, specific: 100 }, height: 24 },
  tag: { width: 80, height: 20 },
  description: { height: 14 },
  avatar: { width: 40, height: 40 },
  searchInput: { height: 32 },
  button: { width: 80, height: 32 },
};

const SKELETON_STYLES = {
  title: {
    backgroundColor: 'var(--semi-color-fill-1)',
    borderRadius: 'var(--na-radius-control)',
  },
  tag: {
    backgroundColor: 'var(--semi-color-fill-1)',
    borderRadius: 'var(--na-radius-pill)',
    border: 'var(--na-space-px) solid var(--semi-color-border)',
  },
  description: {
    backgroundColor: 'var(--semi-color-fill-0)',
    borderRadius: 'var(--na-radius-control)',
  },
  avatar: (isAllVendors) => {
    const colors = isAllVendors
      ? THEME_COLORS.allVendors
      : THEME_COLORS.specific;
    return {
      backgroundColor: colors.background,
      borderRadius: 'var(--na-radius-input)',
      border: `var(--na-space-px) solid ${colors.border}`,
    };
  },
  searchInput: {
    backgroundColor: THEME_COLORS.neutral.background,
    borderRadius: 'var(--na-radius-input)',
    border: `var(--na-space-px) solid ${THEME_COLORS.neutral.border}`,
  },
  button: {
    backgroundColor: THEME_COLORS.neutral.background,
    borderRadius: 'var(--na-radius-input)',
    border: `var(--na-space-px) solid ${THEME_COLORS.neutral.border}`,
  },
};

const createSkeletonRect = (style = {}, key = null) => (
  <div key={key} className='animate-pulse' style={style} />
);

const PricingVendorIntroSkeleton = memo(
  ({ isAllVendors = false, isMobile = false }) => {
    const placeholder = (
      <Card
        className='na-pricing-intro-card'
        cover={
          <div className='na-pricing-intro-cover'>
            <div className='na-pricing-intro-content'>
              <div className='na-pricing-intro-copy'>
                <div className='flex flex-row flex-wrap items-center gap-2 sm:gap-3 mb-2'>
                  {createSkeletonRect(
                    {
                      ...SKELETON_STYLES.title,
                      width: isAllVendors
                        ? SIZES.title.width.all
                        : SIZES.title.width.specific,
                      height: SIZES.title.height,
                    },
                    'title',
                  )}
                  {createSkeletonRect(
                    {
                      ...SKELETON_STYLES.tag,
                      width: SIZES.tag.width,
                      height: SIZES.tag.height,
                    },
                    'tag',
                  )}
                </div>
                <div className='space-y-2'>
                  {createSkeletonRect(
                    {
                      ...SKELETON_STYLES.description,
                      width: '100%',
                      height: SIZES.description.height,
                    },
                    'desc1',
                  )}
                  {createSkeletonRect(
                    {
                      ...SKELETON_STYLES.description,
                      backgroundColor: 'var(--semi-color-fill-1)',
                      width: '75%',
                      height: SIZES.description.height,
                    },
                    'desc2',
                  )}
                </div>
              </div>

              <div className='na-pricing-vendor-avatar'>
                {createSkeletonRect(
                  {
                    ...SKELETON_STYLES.avatar(isAllVendors),
                    width: SIZES.avatar.width,
                    height: SIZES.avatar.height,
                  },
                  'avatar',
                )}
              </div>
            </div>
          </div>
        }
      >
        <div className='flex items-center gap-2 w-full'>
          <div className='flex-1'>
            {createSkeletonRect(
              {
                ...SKELETON_STYLES.searchInput,
                width: '100%',
                height: SIZES.searchInput.height,
              },
              'search',
            )}
          </div>

          {createSkeletonRect(
            {
              ...SKELETON_STYLES.button,
              width: SIZES.button.width,
              height: SIZES.button.height,
            },
            'copy-button',
          )}

          {isMobile &&
            createSkeletonRect(
              {
                ...SKELETON_STYLES.button,
                width: SIZES.button.width,
                height: SIZES.button.height,
              },
              'filter-button',
            )}
        </div>
      </Card>
    );

    return (
      <Skeleton loading={true} active placeholder={placeholder}></Skeleton>
    );
  },
);

PricingVendorIntroSkeleton.displayName = 'PricingVendorIntroSkeleton';

export default PricingVendorIntroSkeleton;
