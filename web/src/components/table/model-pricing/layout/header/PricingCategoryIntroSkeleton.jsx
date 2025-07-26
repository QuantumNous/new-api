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

const PricingCategoryIntroSkeleton = ({
  isAllModels = false
}) => {
  const placeholder = (
    <div className='mb-4'>
      <Card className="!rounded-2xl" bodyStyle={{ padding: '16px' }}>
        <div className="flex items-start space-x-3 md:space-x-4">
          {/* 分类图标骨架 */}
          <div className="flex-shrink-0 min-w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center px-2">
            {isAllModels ? (
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton.Avatar
                    key={index}
                    active
                    size="default"
                    style={{
                      width: 40,
                      height: 40,
                      marginRight: index < 4 ? -10 : 0,
                    }}
                  />
                ))}
              </div>
            ) : (
              <Skeleton.Avatar active size="large" style={{ width: 40, height: 40, borderRadius: 8 }} />
            )}
          </div>

          {/* 分类信息骨架 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <Skeleton.Title active style={{ width: 120, height: 24, marginBottom: 0 }} />
              <Skeleton.Button active size="small" style={{ width: 80, height: 20, borderRadius: 12 }} />
            </div>
            <Skeleton.Paragraph
              active
              rows={2}
              style={{ marginBottom: 0 }}
              title={false}
            />
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <Skeleton loading={true} active placeholder={placeholder}></Skeleton>
  );
};

export default PricingCategoryIntroSkeleton; 