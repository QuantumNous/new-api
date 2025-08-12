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
  skeletonCount = 10,
  rowSelection = false,
  showRatio = false
}) => {
  const placeholder = (
    <div className="px-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card
            key={index}
            className="!rounded-2xl border border-gray-200"
            bodyStyle={{ padding: '24px' }}
          >
            {/* 头部：图标 + 模型名称 + 操作按钮 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                {/* 模型图标骨架 */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-sm">
                  <Skeleton.Avatar
                    size="large"
                    style={{ width: 48, height: 48, borderRadius: 16 }}
                  />
                </div>
                {/* 模型名称和价格区域 */}
                <div className="flex-1 min-w-0">
                  {/* 模型名称骨架 */}
                  <Skeleton.Title
                    style={{
                      width: `${120 + (index % 3) * 30}px`,
                      height: 20,
                      marginBottom: 8
                    }}
                  />
                  {/* 价格信息骨架 */}
                  <Skeleton.Title
                    style={{
                      width: `${160 + (index % 4) * 20}px`,
                      height: 20,
                      marginBottom: 0
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-3">
                {/* 复制按钮骨架 */}
                <Skeleton.Button size="small" style={{ width: 16, height: 16, borderRadius: 4 }} />
                {/* 勾选框骨架 */}
                {rowSelection && (
                  <Skeleton.Button size="small" style={{ width: 16, height: 16, borderRadius: 2 }} />
                )}
              </div>
            </div>

            {/* 模型描述骨架 */}
            <div className="mb-4">
              <Skeleton.Paragraph
                rows={2}
                style={{ marginBottom: 0 }}
                title={false}
              />
            </div>

            {/* 标签区域骨架 */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 2 + (index % 3) }).map((_, tagIndex) => (
                <Skeleton.Button
                  key={tagIndex}
                  size="small"
                  style={{
                    width: 64,
                    height: 20,
                    borderRadius: 10
                  }}
                />
              ))}
            </div>

            {/* 倍率信息骨架（可选） */}
            {showRatio && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-1 mb-2">
                  <Skeleton.Title
                    style={{ width: 60, height: 12, marginBottom: 0 }}
                  />
                  <Skeleton.Button size="small" style={{ width: 14, height: 14, borderRadius: 7 }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, ratioIndex) => (
                    <Skeleton.Title
                      key={ratioIndex}
                      style={{ width: '100%', height: 12, marginBottom: 0 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className="flex justify-center mt-6 py-4 border-t pricing-pagination-divider">
        <Skeleton.Button style={{ width: 300, height: 32 }} />
      </div>
    </div>
  );

  return (
    <Skeleton loading={true} active placeholder={placeholder}></Skeleton>
  );
};

export default PricingCardSkeleton; 