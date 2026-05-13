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
import { Card, Skeleton } from '@douyinfe/semi-ui';

const PricingCardSkeleton = ({ skeletonCount = 12, rowSelection = false }) => {
  const placeholder = (
    <div className='pricing-marketplace-card-view'>
      <div className='pricing-marketplace-card-grid'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card
            key={index}
            className='pricing-marketplace-model-card border border-semi-color-border'
            bodyStyle={{ padding: 0 }}
          >
            <div className='pricing-marketplace-card-cover pricing-marketplace-cover-general'>
              <Skeleton.Image
                className='pricing-marketplace-cover-image-media'
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 0,
                }}
              />
            </div>

            <div className='pricing-marketplace-card-body'>
              <Skeleton.Title
                style={{ width: 88, height: 12, marginBottom: 10 }}
              />
              <Skeleton.Title
                style={{
                  width: `${140 + (index % 3) * 28}px`,
                  height: 22,
                  marginBottom: 12,
                }}
              />
              <Skeleton.Paragraph rows={2} title={false} />

              <div className='flex flex-wrap gap-2 pt-3'>
                {Array.from({ length: 2 + (index % 2) }).map((_, tagIndex) => (
                  <Skeleton.Button
                    key={tagIndex}
                    size='small'
                    style={{
                      width: 64,
                      height: 20,
                      borderRadius: 10,
                    }}
                  />
                ))}
              </div>

              <div className='pricing-marketplace-card-footer'>
                <Skeleton.Title
                  style={{ width: 128, height: 16, marginBottom: 0 }}
                />
                {rowSelection && (
                  <Skeleton.Button
                    size='small'
                    style={{ width: 56, height: 24, borderRadius: 8 }}
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
        <Skeleton.Button style={{ width: 300, height: 32 }} />
      </div>
    </div>
  );

  return <Skeleton loading={true} active placeholder={placeholder} />;
};

export default PricingCardSkeleton;
