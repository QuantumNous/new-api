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
import { Skeleton } from '@douyinfe/semi-ui';
import { Boxes, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { ALL_MODEL_TYPE_OPTION, MODEL_TYPES } from '../utils/modelType';

const MODEL_TYPE_FILTER_LABELS = {
  text: '文本生成',
  image: '图像生成',
  video: '视频生成',
  audio: '音频生成',
  code: '编码',
  general: '通用',
};

export const PricingFilterOptionPanel = ({
  title,
  icon: Icon = Boxes,
  items = [],
  activeValue,
  onChange,
  loading = false,
  defaultOpen = true,
  className = '',
  optionsClassName = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const isActiveValue = (value) =>
    Array.isArray(activeValue)
      ? activeValue.includes(value)
      : activeValue === value;

  return (
    <section className={`pricing-marketplace-filter-panel ${className}`}>
      <button
        type='button'
        className='pricing-marketplace-filter-panel-head'
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className='pricing-marketplace-filter-panel-title'>
          <Icon size={16} strokeWidth={1.8} />
          <span>{title}</span>
        </span>
        {isOpen ? (
          <ChevronUp size={16} strokeWidth={1.8} />
        ) : (
          <ChevronDown size={16} strokeWidth={1.8} />
        )}
      </button>

      {isOpen && (
        <div
          className={`pricing-marketplace-filter-options ${optionsClassName}`}
        >
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className='pricing-marketplace-filter-option'>
                  <Skeleton.Title active style={{ width: 16, height: 16 }} />
                  <Skeleton.Title active style={{ flex: 1, height: 14 }} />
                  <Skeleton.Title active style={{ width: 28, height: 18 }} />
                </div>
              ))
            : items.map((item) => {
                const isActive = isActiveValue(item.value);
                return (
                  <button
                    key={item.value}
                    type='button'
                    className={`pricing-marketplace-filter-option ${
                      isActive ? 'is-active' : ''
                    }`}
                    onClick={() => onChange(item.value)}
                  >
                    <span className='pricing-marketplace-filter-check'>
                      {isActive && <Check size={12} strokeWidth={2.4} />}
                    </span>
                    {item.icon && (
                      <span className='pricing-marketplace-filter-option-icon'>
                        {item.icon}
                      </span>
                    )}
                    <span className='pricing-marketplace-filter-option-label'>
                      {item.label}
                    </span>
                    {item.tagCount !== undefined && (
                      <span className='pricing-marketplace-filter-count'>
                        {item.tagCount}
                      </span>
                    )}
                  </button>
                );
              })}
        </div>
      )}
    </section>
  );
};

const PricingModelTypes = ({
  filterModelType,
  setFilterModelType,
  modelTypeCounts = {},
  loading = false,
  defaultOpen = true,
  t,
}) => {
  const items = React.useMemo(
    () => [
      {
        value: ALL_MODEL_TYPE_OPTION.value,
        label: t('所有模型'),
        tagCount: modelTypeCounts.all || 0,
      },
      ...MODEL_TYPES.map((type) => ({
        value: type.value,
        label: t(MODEL_TYPE_FILTER_LABELS[type.value] || type.label),
        tagCount: modelTypeCounts[type.value] || 0,
      })),
    ],
    [modelTypeCounts, t],
  );

  return (
    <PricingFilterOptionPanel
      title={t('模型类型 / Model Type')}
      icon={Boxes}
      items={items}
      activeValue={filterModelType}
      onChange={setFilterModelType}
      loading={loading}
      defaultOpen={defaultOpen}
    />
  );
};

export default PricingModelTypes;
