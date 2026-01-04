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
import { IconSearch } from '@douyinfe/semi-icons';
import { getLobeHubIcon } from '../../../../helpers';

/**
 * 供应商筛选组件
 * Refactored to match OpenRouter style
 */
const PricingVendors = ({
  filterVendor,
  setFilterVendor,
  models = [],
  allModels = [],
  loading = false,
  t,
}) => {
  const [search, setSearch] = React.useState('');
  const [showAll, setShowAll] = React.useState(false);

  // 获取系统中所有供应商
  const getAllVendors = React.useMemo(() => {
    const vendors = new Set();
    const vendorIcons = new Map();
    let hasUnknownVendor = false;

    (allModels.length > 0 ? allModels : models).forEach((model) => {
      if (model.vendor_name) {
        vendors.add(model.vendor_name);
        if (model.vendor_icon && !vendorIcons.has(model.vendor_name)) {
          vendorIcons.set(model.vendor_name, model.vendor_icon);
        }
      } else {
        hasUnknownVendor = true;
      }
    });

    return {
      vendors: Array.from(vendors).sort(),
      vendorIcons,
      hasUnknownVendor,
    };
  }, [allModels, models]);

  // 计算每个供应商的模型数量
  const getVendorCount = React.useCallback(
    (vendor) => {
      if (vendor === 'all') return models.length;
      if (vendor === 'unknown') return models.filter((model) => !model.vendor_name).length;
      return models.filter((model) => model.vendor_name === vendor).length;
    },
    [models],
  );

  const items = React.useMemo(() => {
    const result = [];
    
    // Filter vendors by search
    const filteredVendors = getAllVendors.vendors.filter(v => 
      v.toLowerCase().includes(search.toLowerCase())
    );

    filteredVendors.forEach((vendor) => {
      const count = getVendorCount(vendor);
      const icon = getAllVendors.vendorIcons.get(vendor);
      result.push({
        value: vendor,
        label: vendor,
        icon: icon ? getLobeHubIcon(icon, 16) : null,
        tagCount: count,
        disabled: count === 0,
      });
    });

    if (getAllVendors.hasUnknownVendor && 'unknown'.includes(search.toLowerCase())) {
      const count = getVendorCount('unknown');
      result.push({
        value: 'unknown',
        label: t('未知供应商'),
        tagCount: count,
        disabled: count === 0,
      });
    }

    return result;
  }, [getAllVendors, getVendorCount, t, search]);

  const displayedItems = showAll ? items : items.slice(0, 10);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('Providers')}
        </div>
      </div>

      <div className="relative mb-3">
        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs" />
        <input 
          type="text" 
          placeholder={t('Search providers...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-none rounded-md py-1.5 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="space-y-1">
        <button
            onClick={() => setFilterVendor('all')}
            className={`
                w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors
                ${filterVendor === 'all' 
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                }
            `}
        >
            <span>{t('All Providers')}</span>
            <span className="text-xs opacity-60">{getVendorCount('all')}</span>
        </button>

        {displayedItems.map((item) => {
            const isActive = filterVendor === item.value;
            return (
                <button
                    key={item.value}
                    onClick={() => setFilterVendor(item.value)}
                    disabled={item.disabled}
                    className={`
                        w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors group
                        ${isActive 
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' 
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                        }
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {item.icon && <span className="flex-shrink-0 opacity-80">{item.icon}</span>}
                        <span className="truncate">{item.label}</span>
                    </div>
                    {item.tagCount > 0 && (
                        <span className={`text-xs ${isActive ? 'opacity-80' : 'opacity-40 group-hover:opacity-60'}`}>
                            {item.tagCount}
                        </span>
                    )}
                </button>
            )
        })}
      </div>
      
      {items.length > 10 && (
        <button 
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline px-2"
        >
            {showAll ? t('Show Less') : t('Show More') + ` (${items.length - 10})`}
        </button>
      )}
    </div>
  );
};

export default PricingVendors;
