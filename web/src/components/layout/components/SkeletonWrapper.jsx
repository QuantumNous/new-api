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
  collapsed = false,
  showAdmin = true,
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
            <Skeleton.Avatar size='extra-small' className='shadow-sm' />
          }
        />
        <div className='ml-1.5 mr-1'>
          <Skeleton
            loading={true}
            active
            placeholder={
              <Skeleton.Title
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
        placeholder={<Skeleton.Title style={{ width, height: 24 }} />}
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
          placeholder={<Skeleton.Title style={{ width, height }} />}
        />
      </div>
    );
  };

  // 按钮骨架屏（支持圆角）
  const renderButtonSkeleton = () => {
    return (
      <div className={className}>
        <Skeleton
          loading={true}
          active
          placeholder={
            <Skeleton.Title style={{ width, height, borderRadius: 9999 }} />
          }
        />
      </div>
    );
  };

  // 侧边栏导航项骨架屏 (图标 + 文本)
  const renderSidebarNavItemSkeleton = () => {
    return Array(count)
      .fill(null)
      .map((_, index) => (
        <div
          key={index}
          className={`flex items-center p-2 mb-1 rounded-md ${className}`}
        >
          {/* 图标骨架屏 */}
          <div className='sidebar-icon-container flex-shrink-0'>
            <Skeleton
              loading={true}
              active
              placeholder={
                <Skeleton.Avatar size='extra-small' shape='square' />
              }
            />
          </div>
          {/* 文本骨架屏 */}
          <Skeleton
            loading={true}
            active
            placeholder={
              <Skeleton.Title
                style={{ width: width || 80, height: height || 14 }}
              />
            }
          />
        </div>
      ));
  };

  // 侧边栏组标题骨架屏
  const renderSidebarGroupTitleSkeleton = () => {
    return (
      <div className={`mb-2 ${className}`}>
        <Skeleton
          loading={true}
          active
          placeholder={
            <Skeleton.Title
              style={{ width: width || 60, height: height || 12 }}
            />
          }
        />
      </div>
    );
  };

  // 完整侧边栏骨架屏 - 1:1 还原，去重实现
  const renderSidebarSkeleton = () => {
    const NAV_WIDTH = 164;
    const NAV_HEIGHT = 30;
    const COLLAPSED_WIDTH = 44;
    const COLLAPSED_HEIGHT = 44;
    const ICON_SIZE = 16;
    const TITLE_HEIGHT = 12;
    const TEXT_HEIGHT = 16;

    const renderIcon = () => (
      <Skeleton
        loading={true}
        active
        placeholder={
          <Skeleton.Avatar
            shape='square'
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
          />
        }
      />
    );

    const renderLabel = (labelWidth) => (
      <Skeleton
        loading={true}
        active
        placeholder={
          <Skeleton.Title style={{ width: labelWidth, height: TEXT_HEIGHT }} />
        }
      />
    );

    const NavRow = ({ labelWidth }) => (
      <div
        className='flex items-center p-2 mb-1 rounded-md'
        style={{
          width: `${NAV_WIDTH}px`,
          height: `${NAV_HEIGHT}px`,
          margin: '3px 8px',
        }}
      >
        <div className='sidebar-icon-container flex-shrink-0'>
          {renderIcon()}
        </div>
        {renderLabel(labelWidth)}
      </div>
    );

    const CollapsedRow = ({ keyPrefix, index }) => (
      <div
        key={`${keyPrefix}-${index}`}
        className='flex items-center justify-center'
        style={{
          width: `${COLLAPSED_WIDTH}px`,
          height: `${COLLAPSED_HEIGHT}px`,
          margin: '0 8px 4px 8px',
        }}
      >
        <Skeleton
          loading={true}
          active
          placeholder={
            <Skeleton.Avatar
              shape='square'
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            />
          }
        />
      </div>
    );

    if (collapsed) {
      return (
        <div className={`w-full ${className}`} style={{ paddingTop: '12px' }}>
          {Array(2)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow keyPrefix='c-chat' index={i} />
            ))}
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow keyPrefix='c-console' index={i} />
            ))}
          {Array(2)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow keyPrefix='c-personal' index={i} />
            ))}
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow keyPrefix='c-admin' index={i} />
            ))}
        </div>
      );
    }

    const sections = [
      { key: 'chat', titleWidth: 32, itemWidths: [54, 32], wrapper: 'section' },
      { key: 'console', titleWidth: 48, itemWidths: [64, 64, 64, 64, 64] },
      { key: 'personal', titleWidth: 64, itemWidths: [64, 64] },
      ...(showAdmin
        ? [{ key: 'admin', titleWidth: 48, itemWidths: [64, 64, 80, 64, 64] }]
        : []),
    ];

    return (
      <div className={`w-full ${className}`} style={{ paddingTop: '12px' }}>
        {sections.map((sec, idx) => (
          <React.Fragment key={sec.key}>
            {sec.wrapper === 'section' ? (
              <div className='sidebar-section'>
                <div
                  className='sidebar-group-label'
                  style={{ padding: '4px 15px 8px' }}
                >
                  <Skeleton
                    loading={true}
                    active
                    placeholder={
                      <Skeleton.Title
                        style={{ width: sec.titleWidth, height: TITLE_HEIGHT }}
                      />
                    }
                  />
                </div>
                {sec.itemWidths.map((w, i) => (
                  <NavRow key={`${sec.key}-${i}`} labelWidth={w} />
                ))}
              </div>
            ) : (
              <div>
                <div
                  className='sidebar-group-label'
                  style={{ padding: '4px 15px 8px' }}
                >
                  <Skeleton
                    loading={true}
                    active
                    placeholder={
                      <Skeleton.Title
                        style={{ width: sec.titleWidth, height: TITLE_HEIGHT }}
                      />
                    }
                  />
                </div>
                {sec.itemWidths.map((w, i) => (
                  <NavRow key={`${sec.key}-${i}`} labelWidth={w} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
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
    case 'sidebarNavItem':
      return renderSidebarNavItemSkeleton();
    case 'sidebarGroupTitle':
      return renderSidebarGroupTitleSkeleton();
    case 'sidebar':
      return renderSidebarSkeleton();
    case 'button':
      return renderButtonSkeleton();
    case 'text':
    default:
      return renderTextSkeleton();
  }
};

export default SkeletonWrapper;
