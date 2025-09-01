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
import { Skeleton } from '@douyinfe/semi-ui';

const SkeletonWrapper = ({
  loading = false,
  type = 'text',
  count = 1,
  width = 60,
  height = 16,
  isMobile = false,
  className = '',
  children,
  ...props
}) => {
  if (!loading) {
    return children;
  }

  // 导航链接骨架屏
  const renderNavigationSkeleton = () => {
    const skeletonLinkClasses = isMobile
      ? 'flex items-center gap-1 p-1 w-full rounded-md'
      : 'flex items-center gap-1 p-2 rounded-md';

    return Array(count)
      .fill(null)
      .map((_, index) => (
        <div key={index} className={skeletonLinkClasses}>
          <Skeleton
            loading={true}
            active
            placeholder={
              <Skeleton.Title
                active
                style={{ width: isMobile ? 40 : width, height }}
              />
            }
          />
        </div>
      ));
  };

  // 用户区域骨架屏 (头像 + 文本)
  const renderUserAreaSkeleton = () => {
    return (
      <div
        className={`flex items-center p-1 rounded-full bg-semi-color-fill-0 dark:bg-semi-color-fill-1 ${className}`}
      >
        <Skeleton
          loading={true}
          active
          placeholder={
            <Skeleton.Avatar active size='extra-small' className='shadow-sm' />
          }
        />
        <div className='ml-1.5 mr-1'>
          <Skeleton
            loading={true}
            active
            placeholder={
              <Skeleton.Title
                active
                style={{ width: isMobile ? 15 : width, height: 12 }}
              />
            }
          />
        </div>
      </div>
    );
  };

  // Logo图片骨架屏
  const renderImageSkeleton = () => {
    return (
      <Skeleton
        loading={true}
        active
        placeholder={
          <Skeleton.Image
            active
            className={`absolute inset-0 !rounded-full ${className}`}
            style={{ width: '100%', height: '100%' }}
          />
        }
      />
    );
  };

  // 系统名称骨架屏
  const renderTitleSkeleton = () => {
    return (
      <Skeleton
        loading={true}
        active
        placeholder={<Skeleton.Title active style={{ width, height: 24 }} />}
      />
    );
  };

  // 通用文本骨架屏
  const renderTextSkeleton = () => {
    return (
      <div className={className}>
        <Skeleton
          loading={true}
          active
          placeholder={<Skeleton.Title active style={{ width, height }} />}
        />
      </div>
    );
  };

  // 根据类型渲染不同的骨架屏
  switch (type) {
    case 'navigation':
      return renderNavigationSkeleton();
    case 'userArea':
      return renderUserAreaSkeleton();
    case 'image':
      return renderImageSkeleton();
    case 'title':
      return renderTitleSkeleton();
    case 'text':
    default:
      return renderTextSkeleton();
  }
};

export default SkeletonWrapper;
