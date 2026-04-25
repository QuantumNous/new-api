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
import { Menu, X } from 'lucide-react';

const MobileMenuButton = ({
  isConsoleRoute,
  isMobile,
  drawerOpen,
  collapsed,
  onToggle,
  t,
}) => {
  if (!isConsoleRoute || !isMobile) {
    return null;
  }

  return (
    <Button
      isIconOnly
      size='sm'
      radius='full'
      variant='light'
      aria-label={
        (isMobile ? drawerOpen : collapsed) ? t('关闭侧边栏') : t('打开侧边栏')
      }
      onPress={onToggle}
      className='text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10'
    >
      {(isMobile ? drawerOpen : collapsed) ? (
        <X size={19} strokeWidth={2.4} />
      ) : (
        <Menu size={19} strokeWidth={2.4} />
      )}
    </Button>
  );
};

export default MobileMenuButton;
