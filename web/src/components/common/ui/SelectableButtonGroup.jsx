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

import React, { useState, useRef, useEffect } from 'react';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';
import { useContainerWidth } from '../../../hooks/common/useContainerWidth';
import { Button, Checkbox, Skeleton, Tooltip } from '@heroui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
 * @param {string} variant 颜色变体: 'violet' | 'teal' | 'amber' | 'rose' | 'green'，不传则使用默认蓝色
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
  loading = false,
  variant,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [skeletonCount] = useState(12);
  const [containerRef, containerWidth] = useContainerWidth();

  const ConditionalTooltipText = ({ text }) => {
    const textRef = useRef(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
      const el = textRef.current;
      if (!el) return;
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }, [text, containerWidth]);

    const textElement = (
      <span ref={textRef} className='min-w-0 truncate text-left text-sm'>
        {text}
      </span>
    );

    return isOverflowing ? (
      <Tooltip content={text}>{textElement}</Tooltip>
    ) : (
      textElement
    );
  };

  // 基于容器宽度计算响应式列数和标签显示策略
  const getResponsiveConfig = () => {
    if (containerWidth <= 280) return { columns: 1, showTags: true }; // 极窄：1列+标签
    if (containerWidth <= 380) return { columns: 2, showTags: true }; // 窄屏：2列+标签
    if (containerWidth <= 460) return { columns: 3, showTags: false }; // 中等：3列不加标签
    return { columns: 3, showTags: true }; // 最宽：3列+标签
  };

  const { columns: perRow, showTags: shouldShowTags } = getResponsiveConfig();
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

  const gridClass =
    perRow === 1
      ? 'grid-cols-1'
      : perRow === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  const renderSkeletonButtons = () => {
    return (
      <div
        className={`grid ${gridClass} gap-1`}
        style={style}
        aria-busy='true'
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            className='flex h-8 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-800'
            key={index}
          >
            {withCheckbox ? <Skeleton className='h-3.5 w-3.5 rounded' /> : null}
            <Skeleton
              className='h-3.5 rounded-full'
              style={{ width: `${60 + (index % 3) * 20}px` }}
            />
          </div>
        ))}
      </div>
    );
  };

  const contentElement = showSkeleton ? (
    renderSkeletonButtons()
  ) : (
    <div className={`grid ${gridClass} gap-1`} style={style}>
      {items.map((item) => {
        const isActive = Array.isArray(activeValue)
          ? activeValue.includes(item.value)
          : activeValue === item.value;

        if (withCheckbox) {
          return (
            <div key={item.value}>
              <Button
                onPress={() => onChange(item.value)}
                variant={isActive ? 'secondary' : 'outline'}
                className='h-8 w-full justify-start rounded-xl px-2'
              >
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                  <Checkbox
                    isSelected={isActive}
                    className='pointer-events-none shrink-0'
                    aria-hidden='true'
                  />
                  {item.icon && <span className='shrink-0'>{item.icon}</span>}
                  <ConditionalTooltipText text={item.label} />
                  {item.tagCount !== undefined && shouldShowTags && (
                    <span
                      className={`ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.tagCount}
                    </span>
                  )}
                </div>
              </Button>
            </div>
          );
        }

        return (
          <div key={item.value}>
            <Button
              onPress={() => onChange(item.value)}
              variant={isActive ? 'secondary' : 'outline'}
              className='h-8 w-full justify-start rounded-xl px-2'
            >
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                {item.icon && <span className='shrink-0'>{item.icon}</span>}
                <ConditionalTooltipText text={item.label} />
                {item.tagCount !== undefined && shouldShowTags && item.tagCount !== '' && (
                  <span
                    className={`ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {item.tagCount}
                  </span>
                )}
              </div>
            </Button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`mb-8 ${containerWidth <= 400 ? 'sbg-compact' : ''}${variant ? ` sbg-variant-${variant}` : ''}`}
      ref={containerRef}
    >
      {title && (
        <div className='mb-3 flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200'>
          <span className='h-px flex-1 bg-slate-200 dark:bg-slate-800' />
          {showSkeleton ? (
            <Skeleton className='h-3.5 w-20 rounded-full' />
          ) : (
            <span className='shrink-0'>{title}</span>
          )}
          <span className='h-px flex-1 bg-slate-200 dark:bg-slate-800' />
        </div>
      )}
      {needCollapse && !showSkeleton ? (
        <div className='relative'>
          <div
            style={{
              ...maskStyle,
              maxHeight: isOpen ? 'none' : collapseHeight,
              overflow: isOpen ? 'visible' : 'hidden',
            }}
          >
            {contentElement}
          </div>
          {isOpen ? null : (
            <button
              type='button'
              onClick={toggle}
              className='absolute -bottom-3 left-0 right-0 mx-auto flex w-fit cursor-pointer items-center justify-center gap-1 rounded-full bg-white/90 px-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur hover:text-slate-900 dark:bg-slate-950/90 dark:text-slate-400 dark:ring-slate-800 dark:hover:text-slate-100'
            >
              <ChevronDown size={14} />
              <span>{t('展开更多')}</span>
            </button>
          )}
          {isOpen && (
            <button
              type='button'
              onClick={toggle}
              className='mx-auto mt-2 flex cursor-pointer items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            >
              <ChevronUp size={14} />
              <span>{t('收起')}</span>
            </button>
          )}
        </div>
      ) : (
        contentElement
      )}
    </div>
  );
};

export default SelectableButtonGroup;
