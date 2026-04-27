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
import { resolveTarget, isLinkCurrent } from './Navigation';

// Mobile-only navigation list rendered into `Navbar.Menu`. Pressing a
// `Navbar.MenuItem` automatically closes the menu, which gives us the same
// "tap a link, see the page" behavior as the desktop nav without extra state.
const MobileNavMenu = ({
  mainNavLinks,
  userState,
  pricingRequireAuth,
  pathname,
}) => {
  return (
    <Navbar.Menu>
      {mainNavLinks.map((link) => {
        const target = resolveTarget(link, userState, pricingRequireAuth);
        const current = isLinkCurrent(link, pathname);
        return (
          <Navbar.MenuItem key={link.itemKey} href={target} isCurrent={current}>
            {link.text}
          </Navbar.MenuItem>
        );
      })}
    </Navbar.Menu>
  );
};

export default MobileNavMenu;
