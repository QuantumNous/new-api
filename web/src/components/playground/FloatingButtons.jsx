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
import { Button } from '@douyinfe/semi-ui';
import { Settings, Eye, EyeOff } from 'lucide-react';

const FloatingButtons = ({
  styleState,
  showSettings,
  showDebugPanel,
  onToggleSettings,
  onToggleDebugPanel,
}) => {
  if (!styleState.isMobile) return null;

  return (
    <>
      {/* 设置按钮 */}
      {!showSettings && (
        <Button
          icon={<Settings size={18} />}
          onClick={onToggleSettings}
          theme='solid'
          type='primary'
          className='na-playground-floating-button na-playground-floating-settings lg:hidden'
        />
      )}

      {/* 调试按钮 */}
      {!showSettings && (
        <Button
          icon={showDebugPanel ? <EyeOff size={18} /> : <Eye size={18} />}
          onClick={onToggleDebugPanel}
          theme='solid'
          type={showDebugPanel ? 'danger' : 'primary'}
          className={`na-playground-floating-button na-playground-floating-debug ${
            showDebugPanel ? 'na-playground-floating-danger' : ''
          } lg:hidden`}
        />
      )}
    </>
  );
};

export default FloatingButtons;
