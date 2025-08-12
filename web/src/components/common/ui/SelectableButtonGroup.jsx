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

import React, { useState } from 'react';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';
import { Divider, Button, Tag, Row, Col, Collapsible, Checkbox, Skeleton, Tooltip } from '@douyinfe/semi-ui';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';

/**
 * 通用可选择按钮组组件
 *
 * @param {string} title 标题
 * @param {Array<{value:any,label:string,icon?:React.ReactNode,tagCount?:number}>} items 按钮项
 * @param {*|Array} activeValue 当前激活的值，可以是单个值或数组（多选）
 * @param {(value:any)=>void} onChange 选择改变回调
 * @param {function} t i18n
 * @param {object} style 额外样式
 * @param {boolean} collapsible 是否支持折叠，默认true
 * @param {number} collapseHeight 折叠时的高度，默认200
 * @param {boolean} withCheckbox 是否启用前缀 Checkbox 来控制激活状态
 * @param {boolean} loading 是否处于加载状态
 */
const SelectableButtonGroup = ({
  title,
  items = [],
  activeValue,
  onChange,
  t = (v) => v,
  style = {},
  collapsible = true,
  collapseHeight = 200,
  withCheckbox = false,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [skeletonCount] = useState(6);
  const isMobile = useIsMobile();
  const perRow = 3;
  const maxVisibleRows = Math.max(1, Math.floor(collapseHeight / 32)); // Approx row height 32
  const needCollapse = collapsible && items.length > perRow * maxVisibleRows;
  const showSkeleton = useMinimumLoadingTime(loading);

  const maskStyle = isOpen
    ? {}
    : {
      WebkitMaskImage:
        'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0.2) 80%, transparent 100%)',
    };

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  const linkStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    bottom: -10,
    fontWeight: 400,
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--semi-color-text-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  };

  const renderSkeletonButtons = () => {

    const placeholder = (
      <Row gutter={[8, 8]} style={{ lineHeight: '32px', ...style }}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Col
            {...(isMobile
              ? { span: 12 }
              : { span: 8 }
            )}
            key={index}
          >
            <div style={{
              width: '100%',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              border: '1px solid var(--semi-color-border)',
              borderRadius: 'var(--semi-border-radius-medium)',
              padding: '0 12px',
              gap: '8px'
            }}>
              {withCheckbox && (
                <Skeleton.Title active style={{ width: 14, height: 14 }} />
              )}
              <Skeleton.Title
                active
                style={{
                  width: `${60 + (index % 3) * 20}px`,
                  height: 14
                }}
              />
            </div>
          </Col>
        ))}
      </Row>
    );

    return (
      <Skeleton loading={true} active placeholder={placeholder}></Skeleton>
    );
  };

  const contentElement = showSkeleton ? renderSkeletonButtons() : (
    <Row gutter={[8, 8]} style={{ lineHeight: '32px', ...style }}>
      {items.map((item) => {
        const isDisabled = item.disabled || (typeof item.tagCount === 'number' && item.tagCount === 0);
        const isActive = Array.isArray(activeValue)
          ? activeValue.includes(item.value)
          : activeValue === item.value;

        if (withCheckbox) {
          return (
            <Col
              {...(isMobile
                ? { span: 12 }
                : { span: 8 }
              )}
              key={item.value}
            >
              <Button
                onClick={() => { /* disabled */ }}
                theme={isActive ? 'light' : 'outline'}
                type={isActive ? 'primary' : 'tertiary'}
                disabled={isDisabled}
                className="sbg-button"
                icon={
                  <Checkbox
                    checked={isActive}
                    onChange={() => onChange(item.value)}
                    disabled={isDisabled}
                    style={{ pointerEvents: 'auto' }}
                  />
                }
                style={{ width: '100%', cursor: 'default' }}
              >
                <div className="sbg-content">
                  {item.icon && (<span className="sbg-icon">{item.icon}</span>)}
                  <Tooltip content={item.label}>
                    <span className="sbg-ellipsis">{item.label}</span>
                  </Tooltip>
                  {item.tagCount !== undefined && (
                    <Tag className="sbg-tag" color='white' shape="circle" size="small">{item.tagCount}</Tag>
                  )}
                </div>
              </Button>
            </Col>
          );
        }

        return (
          <Col
            {...(isMobile
              ? { span: 12 }
              : { span: 8 }
            )}
            key={item.value}
          >
            <Button
              onClick={() => onChange(item.value)}
              theme={isActive ? 'light' : 'outline'}
              type={isActive ? 'primary' : 'tertiary'}
              disabled={isDisabled}
              className="sbg-button"
              style={{ width: '100%' }}
            >
              <div className="sbg-content">
                {item.icon && (<span className="sbg-icon">{item.icon}</span>)}
                <Tooltip content={item.label}>
                  <span className="sbg-ellipsis">{item.label}</span>
                </Tooltip>
                {item.tagCount !== undefined && (
                  <Tag className="sbg-tag" color='white' shape="circle" size="small">{item.tagCount}</Tag>
                )}
              </div>
            </Button>
          </Col>
        );
      })}
    </Row>
  );

  return (
    <div className="mb-8">
      {title && (
        <Divider margin="12px" align="left">
          {showSkeleton ? (
            <Skeleton.Title active style={{ width: 80, height: 14 }} />
          ) : (
            title
          )}
        </Divider>
      )}
      {needCollapse && !showSkeleton ? (
        <div style={{ position: 'relative' }}>
          <Collapsible isOpen={isOpen} collapseHeight={collapseHeight} style={{ ...maskStyle }}>
            {contentElement}
          </Collapsible>
          {isOpen ? null : (
            <div onClick={toggle} style={{ ...linkStyle }}>
              <IconChevronDown size="small" />
              <span>{t('展开更多')}</span>
            </div>
          )}
          {isOpen && (
            <div onClick={toggle} style={{
              ...linkStyle,
              position: 'static',
              marginTop: 8,
              bottom: 'auto'
            }}>
              <IconChevronUp size="small" />
              <span>{t('收起')}</span>
            </div>
          )}
        </div>
      ) : (
        contentElement
      )}
    </div>
  );
};

export default SelectableButtonGroup; 