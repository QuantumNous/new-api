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
import SelectableButtonGroup from '../../../common/ui/SelectableButtonGroup';
import { getLobeHubIcon } from '../../../../helpers';

/**
 * 供应商筛选组件
 * @param {string|'all'} filterVendor 当前值
 * @param {Function} setFilterVendor setter
 * @param {Array} models 模型列表
 * @param {Array} allModels 所有模型列表（用于获取全部供应商）
 * @param {boolean} loading 是否加载中
 * @param {Function} t i18n
 */
const PricingVendors = ({ filterVendor, setFilterVendor, models = [], allModels = [], loading = false, t }) => {
  // 获取系统中所有供应商（基于 allModels，如果未提供则退化为 models）
  const getAllVendors = React.useMemo(() => {
    const vendors = new Set();
    const vendorIcons = new Map();
    let hasUnknownVendor = false;

    (allModels.length > 0 ? allModels : models).forEach(model => {
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
      hasUnknownVendor
    };
  }, [allModels, models]);

  // 计算每个供应商的模型数量（基于当前过滤后的 models）
  const getVendorCount = React.useCallback((vendor) => {
    if (vendor === 'all') {
      return models.length;
    }
    if (vendor === 'unknown') {
      return models.filter(model => !model.vendor_name).length;
    }
    return models.filter(model => model.vendor_name === vendor).length;
  }, [models]);

  // 生成供应商选项
  const items = React.useMemo(() => {
    const result = [
      {
        value: 'all',
        label: t('全部供应商'),
        tagCount: getVendorCount('all'),
        disabled: models.length === 0
      }
    ];

    // 添加所有已知供应商
    getAllVendors.vendors.forEach(vendor => {
      const count = getVendorCount(vendor);
      const icon = getAllVendors.vendorIcons.get(vendor);
      result.push({
        value: vendor,
        label: vendor,
        icon: icon ? getLobeHubIcon(icon, 16) : null,
        tagCount: count,
        disabled: count === 0
      });
    });

    // 如果系统中存在未知供应商，添加"未知供应商"选项
    if (getAllVendors.hasUnknownVendor) {
      const count = getVendorCount('unknown');
      result.push({
        value: 'unknown',
        label: t('未知供应商'),
        tagCount: count,
        disabled: count === 0
      });
    }

    return result;
  }, [getAllVendors, getVendorCount, t]);

  return (
    <SelectableButtonGroup
      title={t('供应商')}
      items={items}
      activeValue={filterVendor}
      onChange={setFilterVendor}
      loading={loading}
      t={t}
    />
  );
};

export default PricingVendors;