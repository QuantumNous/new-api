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
import { Button } from '@heroui/react';
import { useSidebar } from '@heroui-pro/react';
import { Menu, X } from 'lucide-react';

// Mobile-only sidebar drawer toggle. Reads / writes the mobile-sheet open
// state from the surrounding `Sidebar.Provider` (mounted in PageLayout) so
// the button stays in sync with the actual sheet rather than tracking a
// separate piece of local state.
const MobileMenuButton = ({ isConsoleRoute, isMobile, t }) => {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  if (!isConsoleRoute || !isMobile) {
    return null;
  }

  return (
    <Button
      isIconOnly
      size='sm'
      variant='tertiary'
      aria-label={isMobileOpen ? t('关闭侧边栏') : t('打开侧边栏')}
      onPress={() => setMobileOpen(!isMobileOpen)}
      className='rounded-full text-foreground hover:bg-surface-secondary'
    >
      {isMobileOpen ? (
        <X size={19} strokeWidth={2.4} />
      ) : (
        <Menu size={19} strokeWidth={2.4} />
      )}
    </Button>
  );
};

export default MobileMenuButton;
