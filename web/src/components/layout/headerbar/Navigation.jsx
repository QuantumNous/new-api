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
import { Navbar } from '@heroui-pro/react';
import SkeletonWrapper from '../components/SkeletonWrapper';

// Resolve the actual destination href for a nav link, applying auth-required
// redirects (`console`, gated `pricing`) without mutating the link config.
const resolveTarget = (link, userState, pricingRequireAuth) => {
  if (link.isExternal) {
    return link.externalLink;
  }
  if (link.itemKey === 'console' && !userState?.user) {
    return '/login';
  }
  if (link.itemKey === 'pricing' && pricingRequireAuth && !userState?.user) {
    return '/login';
  }
  return link.to;
};

// Match nav-link "is current" against the current pathname. Treat `/` as an
// exact match so the home link doesn't stay highlighted on every route.
const isLinkCurrent = (link, pathname) => {
  if (link.isExternal) {
    return false;
  }
  const target = link.to;
  if (!target) return false;
  if (target === '/') {
    return pathname === '/';
  }
  return pathname === target || pathname.startsWith(`${target}/`);
};

// Desktop-only navigation rendered inside `Navbar.Content`. Hidden on mobile;
// the mobile equivalent lives in `MobileNavMenu` (Navbar.Menu).
const Navigation = ({
  mainNavLinks,
  isLoading,
  userState,
  pricingRequireAuth,
  pathname,
}) => {
  return (
    <Navbar.Content className='hidden md:flex'>
      <SkeletonWrapper
        loading={isLoading}
        type='navigation'
        count={4}
        width={60}
        height={16}
      >
        {mainNavLinks.map((link) => {
          const target = resolveTarget(link, userState, pricingRequireAuth);
          const current = isLinkCurrent(link, pathname);
          return (
            <Navbar.Item
              key={link.itemKey}
              href={target}
              isCurrent={current}
              className='text-foreground hover:text-primary'
            >
              {link.text}
            </Navbar.Item>
          );
        })}
      </SkeletonWrapper>
    </Navbar.Content>
  );
};

export { resolveTarget, isLinkCurrent };
export default Navigation;
