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
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

/**
 * 紧凑模式切换按钮组件
 * 用于在自适应列表和紧凑列表之间切换
 * 在移动端时自动隐藏，因为移动端使用"显示操作项"按钮来控制内容显示
 */
const CompactModeToggle = ({
  compactMode,
  setCompactMode,
  t,
  size = 'small',
  type = 'tertiary',
  className = '',
  ...props
}) => {
  const isMobile = useIsMobile();

  // 在移动端隐藏紧凑列表切换按钮
  if (isMobile) {
    return null;
  }

  return (
    <Button
      type={type}
      size={size}
      className={`w-full md:w-auto ${className}`}
      onClick={() => setCompactMode(!compactMode)}
      {...props}
    >
      {compactMode ? t('自适应列表') : t('紧凑列表')}
    </Button>
  );
};

CompactModeToggle.propTypes = {
  compactMode: PropTypes.bool.isRequired,
  setCompactMode: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  size: PropTypes.string,
  type: PropTypes.string,
  className: PropTypes.string,
};

export default CompactModeToggle; 