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

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const [hoveredItemKey, setHoveredItemKey] = useState(null);

  const renderNavLinks = () => {
    const baseClasses =
      'flex-shrink-0 flex items-center gap-2 font-semibold rounded-full transition-all duration-200 ease-in-out';
    const hoverClasses =
      'hover:text-semi-color-primary hover:bg-semi-color-primary-light-default';
    const spacingClasses = isMobile ? 'pl-6 pr-2 py-1' : 'pl-8 pr-4 py-2.5';
    const activeClasses =
      'text-semi-color-primary bg-semi-color-primary-light-default';

    const commonLinkClasses = `${baseClasses} ${spacingClasses} ${hoverClasses}`;

    return mainNavLinks.map((link) => {
      const renderLinkContent = (isActive = false) => {
        const showDot = isActive || hoveredItemKey === link.itemKey;

        return (
          <>
            <span
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full bg-semi-color-primary transition-opacity duration-200 ${
                showDot ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <span>{link.text}</span>
          </>
        );
      };

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={commonLinkClasses}
            onMouseEnter={() => setHoveredItemKey(link.itemKey)}
            onMouseLeave={() => setHoveredItemKey(null)}
          >
            {renderLinkContent()}
          </a>
        );
      }

      let targetPath = link.to;
      if (link.itemKey === 'console' && !userState.user) {
        targetPath = '/login';
      }
      if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
        targetPath = '/login';
      }

      return (
        <NavLink
          key={link.itemKey}
          to={targetPath}
          end={link.itemKey === 'home'}
          onMouseEnter={() => setHoveredItemKey(link.itemKey)}
          onMouseLeave={() => setHoveredItemKey(null)}
          className={({ isActive }) =>
            isActive
              ? `${commonLinkClasses} ${activeClasses}`
              : commonLinkClasses
          }
        >
          {({ isActive }) => renderLinkContent(isActive)}
        </NavLink>
      );
    });
  };

  return (
    <nav className='flex flex-1 items-center gap-1 lg:gap-2 mx-2 md:mx-4 overflow-x-auto whitespace-nowrap scrollbar-hide'>
      <SkeletonWrapper
        loading={isLoading}
        type='navigation'
        count={4}
        width={60}
        height={16}
        isMobile={isMobile}
      >
        {renderNavLinks()}
      </SkeletonWrapper>
    </nav>
  );
};

export default Navigation;
