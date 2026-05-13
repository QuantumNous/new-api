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
import { Link, useLocation } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const location = useLocation();
  const isActiveLink = (itemKey) => {
    if (itemKey === 'pricing') {
      return location.pathname === '/pricing';
    }
    if (itemKey === 'console') {
      return (
        location.pathname === '/console' ||
        location.pathname.startsWith('/console/')
      );
    }
    return false;
  };

  const renderNavLinks = () => {
    const baseClasses =
      'headerbar-nav-link flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out';
    const spacingClasses = isMobile ? 'px-2 py-1.5' : 'px-3 py-2';

    return mainNavLinks.map((link) => {
      const linkContent = <span>{link.text}</span>;
      const active = isActiveLink(link.itemKey);
      const commonLinkClasses = `${baseClasses} ${spacingClasses} ${active ? 'headerbar-nav-link-active' : ''}`;

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={commonLinkClasses}
            aria-current={active ? 'page' : undefined}
          >
            {linkContent}
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
        <Link
          key={link.itemKey}
          to={targetPath}
          className={commonLinkClasses}
          aria-current={active ? 'page' : undefined}
        >
          {linkContent}
        </Link>
      );
    });
  };

  return (
    <nav className='headerbar-nav'>
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
