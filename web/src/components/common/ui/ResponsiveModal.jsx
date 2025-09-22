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
import { Modal, Typography } from '@douyinfe/semi-ui';
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const { Title } = Typography;

/**
 * ResponsiveModal 响应式模态框组件
 *
 * 特性：
 * - 响应式布局：移动端和桌面端不同的宽度和布局
 * - 自定义头部：标题左对齐，操作按钮右对齐，移动端自动换行
 * - Tailwind CSS 样式支持
 * - 保持原 Modal 组件的所有功能
 */
const ResponsiveModal = ({
  visible,
  onCancel,
  title,
  headerActions = [],
  children,
  width = { mobile: '95%', desktop: 600 },
  className = '',
  footer = null,
  titleProps = {},
  headerClassName = '',
  actionsClassName = '',
  ...props
}) => {
  const isMobile = useIsMobile();

  // 自定义 Header 组件
  const CustomHeader = () => {
    if (!title && (!headerActions || headerActions.length === 0)) return null;

    return (
      <div
        className={`flex w-full gap-3 justify-between ${
          isMobile ? 'flex-col items-start' : 'flex-row items-center'
        } ${headerClassName}`}
      >
        {title && (
          <Title heading={5} className='m-0 min-w-fit' {...titleProps}>
            {title}
          </Title>
        )}
        {headerActions && headerActions.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 items-center ${
              isMobile ? 'w-full justify-start' : 'w-auto justify-end'
            } ${actionsClassName}`}
          >
            {headerActions.map((action, index) => (
              <React.Fragment key={index}>{action}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 计算模态框宽度
  const getModalWidth = () => {
    if (typeof width === 'object') {
      return isMobile ? width.mobile : width.desktop;
    }
    return width;
  };

  return (
    <Modal
      visible={visible}
      title={<CustomHeader />}
      onCancel={onCancel}
      footer={footer}
      width={getModalWidth()}
      className={`!top-12 ${className}`}
      {...props}
    >
      {children}
    </Modal>
  );
};

ResponsiveModal.propTypes = {
  // Modal 基础属性
  visible: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  children: PropTypes.node,

  // 自定义头部
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  headerActions: PropTypes.arrayOf(PropTypes.node),

  // 样式和布局
  width: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.shape({
      mobile: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      desktop: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  ]),
  className: PropTypes.string,
  footer: PropTypes.node,

  // 标题自定义属性
  titleProps: PropTypes.object,

  // 自定义 CSS 类
  headerClassName: PropTypes.string,
  actionsClassName: PropTypes.string,
};

export default ResponsiveModal;
