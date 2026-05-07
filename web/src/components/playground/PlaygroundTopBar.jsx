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
import { Avatar, Badge, Button } from '@douyinfe/semi-ui';
import {
  Bell,
  BookOpenCheck,
  Bug,
  Globe2,
  Monitor,
  PanelLeftOpen,
  SlidersHorizontal,
} from 'lucide-react';

const PlaygroundTopBar = ({
  username,
  showDebugPanel,
  sidebarCollapsed,
  onToggleDebugPanel,
  onOpenSettings,
  onToggleSidebar,
}) => {
  const initial = username ? username[0].toUpperCase() : 'U';

  return (
    <header className='new-playground-topbar'>
      <div className='topbar-left'>
        {sidebarCollapsed && (
          <Button
            icon={<PanelLeftOpen size={19} />}
            theme='borderless'
            type='tertiary'
            onClick={onToggleSidebar}
            className='topbar-icon-button'
          />
        )}
      </div>
      <div className='topbar-actions'>
        <Button
          icon={<BookOpenCheck size={20} />}
          theme='borderless'
          type='tertiary'
          className='topbar-icon-button'
        />
        <Badge dot position='rightTop'>
          <Button
            icon={<Bell size={20} />}
            theme='borderless'
            type='tertiary'
            className='topbar-icon-button'
          />
        </Badge>
        <Button
          icon={<Globe2 size={21} />}
          theme='borderless'
          type='tertiary'
          className='topbar-icon-button'
        />
        <Button
          icon={<Monitor size={21} />}
          theme='borderless'
          type='tertiary'
          className='topbar-icon-button'
        />
        <Button
          icon={<SlidersHorizontal size={20} />}
          theme='borderless'
          type='tertiary'
          className='topbar-icon-button'
          onClick={onOpenSettings}
        />
        <Button
          icon={<Bug size={19} />}
          theme={showDebugPanel ? 'solid' : 'borderless'}
          type={showDebugPanel ? 'primary' : 'tertiary'}
          className='topbar-icon-button'
          onClick={onToggleDebugPanel}
        />
        <Avatar size='small' className='topbar-avatar'>
          {initial}
        </Avatar>
      </div>
    </header>
  );
};

export default PlaygroundTopBar;
