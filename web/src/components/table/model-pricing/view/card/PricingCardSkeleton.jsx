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

const PricingCardSkeleton = ({
  skeletonCount = 100,
  rowSelection = false,
  showRatio = false,
}) => {
  const placeholder = (
    <div className='pricing-card-view px-2 pt-2'>
      <div className='pricing-card-grid grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card
            key={index}
            className='pricing-model-card pricing-model-card-default !rounded-2xl'
            bodyStyle={{ padding: '24px' }}
          >
            {/* 头部：图标 + 模型名称 + 操作按钮 */}
            <div className='pricing-model-card-head flex items-start justify-between mb-3'>
              <div className='pricing-model-card-main flex items-start space-x-3 flex-1 min-w-0'>
                {/* 模型图标骨架 */}
                <div className='pricing-model-card-icon-shell'>
                  <Skeleton.Avatar
                    size='large'
                    style={{ width: 48, height: 48, borderRadius: 16 }}
                  />
                </div>
                {/* 模型名称和价格区域 */}
                <div className='flex-1 min-w-0'>
                  <Skeleton.Title
                    style={{
                      width: `${120 + (index % 3) * 30}px`,
                      height: 20,
                      marginBottom: 8,
                    }}
                  />
                  <div className='pricing-model-card-meta mt-2 flex gap-2'>
                    <Skeleton.Button
                      size='small'
                      style={{ width: 72, height: 24, borderRadius: 999 }}
                    />
                    <Skeleton.Button
                      size='small'
                      style={{ width: 64, height: 24, borderRadius: 999 }}
                    />
                  </div>
                </div>
              </div>

              <div className='pricing-model-card-actions flex items-center space-x-2 ml-3'>
                <Skeleton.Button
                  size='small'
                  style={{ width: 30, height: 30, borderRadius: 12 }}
                />
                {rowSelection && (
                  <Skeleton.Button
                    size='small'
                    style={{ width: 16, height: 16, borderRadius: 2 }}
                  />
                )}
              </div>
            </div>

            <div className='pricing-model-card-body'>
              <div className='pricing-model-card-price-section mb-4'>
                <div className='pricing-model-card-price-section-head'>
                  <Skeleton.Title
                    style={{ width: 72, height: 12, marginBottom: 0 }}
                  />
                  <Skeleton.Title
                    style={{ width: 84, height: 12, marginBottom: 0 }}
                  />
                </div>
                <div className='pricing-model-card-price-grid'>
                  {Array.from({ length: 3 }).map((_, priceIndex) => (
                    <div
                      key={priceIndex}
                      className='pricing-model-card-price-item'
                    >
                      <Skeleton.Title
                        style={{ width: 52, height: 10, marginBottom: 0 }}
                      />
                      <Skeleton.Title
                        style={{ width: 110, height: 14, marginBottom: 0 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className='mb-4'>
                <Skeleton.Paragraph
                  rows={2}
                  style={{ marginBottom: 0 }}
                  title={false}
                />
              </div>
            </div>

            {/* 标签区域骨架 */}
            <div className='pricing-model-card-footbar flex flex-wrap gap-2'>
              {Array.from({ length: 3 }).map((_, tagIndex) => (
                <Skeleton.Button
                  key={tagIndex}
                  size='small'
                  style={{
                    width: 64,
                    height: 18,
                    borderRadius: 10,
                  }}
                />
              ))}
            </div>

            {/* 倍率信息骨架（可选） */}
            {showRatio && (
              <div className='pricing-model-card-ratio-panel mt-4 pt-3'>
                <div className='pricing-model-card-ratio-head flex items-center space-x-1 mb-2'>
                  <Skeleton.Title
                    style={{ width: 60, height: 12, marginBottom: 0 }}
                  />
                  <Skeleton.Button
                    size='small'
                    style={{ width: 14, height: 14, borderRadius: 7 }}
                  />
                </div>
                <div className='pricing-model-card-ratio grid grid-cols-3 gap-2'>
                  {Array.from({ length: 3 }).map((_, ratioIndex) => (
                    <div
                      key={ratioIndex}
                      className='pricing-model-card-ratio-item'
                    >
                      <Skeleton.Title
                        style={{ width: '60%', height: 10, marginBottom: 8 }}
                      />
                      <Skeleton.Title
                        style={{ width: '70%', height: 14, marginBottom: 0 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
        <Skeleton.Button style={{ width: 300, height: 32 }} />
      </div>
    </div>
  );

  return <Skeleton loading={true} active placeholder={placeholder}></Skeleton>;
};

export default PricingCardSkeleton;
