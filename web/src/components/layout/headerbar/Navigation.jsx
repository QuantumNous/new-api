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
import { Link } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const renderNavLinks = () =>
    mainNavLinks.map((link) => {
      const commonLinkClasses =
        'transition-colors hover:text-indigo-600 whitespace-nowrap';
      const linkClasses =
        link.itemKey === 'partners'
          ? 'inline-flex items-center gap-1.5 font-bold text-[#4f46e5] transition-colors hover:text-emerald-500 whitespace-nowrap'
          : commonLinkClasses;
      const linkContent = (
        <>
          {link.itemKey === 'partners' ? (
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.2'
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'
            >
              <path d='M4 13a8 8 0 0 1 8-8' />
              <path d='M4 13v6h6' />
              <path d='M20 11a8 8 0 0 1-8 8' />
              <path d='M20 11V5h-6' />
            </svg>
          ) : null}
          {link.text}
        </>
      );

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={linkClasses}
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
        <Link key={link.itemKey} to={targetPath} className={linkClasses}>
          {linkContent}
        </Link>
      );
    });

  return (
    <nav
      data-header-nav='true'
      className='hidden xl:flex items-center gap-6 font-medium text-sm text-gray-500 whitespace-nowrap'
    >
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
