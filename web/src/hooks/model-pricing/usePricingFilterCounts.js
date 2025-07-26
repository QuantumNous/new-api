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

/*
  统一计算模型筛选后的各种集合与动态计数，供多个组件复用
*/
import { useMemo } from 'react';

export const usePricingFilterCounts = ({
  models = [],
  modelCategories = {},
  activeKey = 'all',
  filterGroup = 'all',
  filterQuotaType = 'all',
  filterEndpointType = 'all',
  searchValue = '',
}) => {
  // 根据分类过滤后的模型
  const modelsAfterCategory = useMemo(() => {
    if (activeKey === 'all') return models;
    const category = modelCategories[activeKey];
    if (category && typeof category.filter === 'function') {
      return models.filter(category.filter);
    }
    return models;
  }, [models, activeKey, modelCategories]);

  // 根据除分类外其它过滤条件后的模型 (用于动态分类计数)
  const modelsAfterOtherFilters = useMemo(() => {
    let result = models;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    if (searchValue && searchValue.length > 0) {
      const term = searchValue.toLowerCase();
      result = result.filter(m => m.model_name.toLowerCase().includes(term));
    }
    return result;
  }, [models, filterGroup, filterQuotaType, filterEndpointType, searchValue]);

  // 动态分类计数
  const dynamicCategoryCounts = useMemo(() => {
    const counts = { all: modelsAfterOtherFilters.length };
    Object.entries(modelCategories).forEach(([key, category]) => {
      if (key === 'all') return;
      if (typeof category.filter === 'function') {
        counts[key] = modelsAfterOtherFilters.filter(category.filter).length;
      } else {
        counts[key] = 0;
      }
    });
    return counts;
  }, [modelsAfterOtherFilters, modelCategories]);

  // 针对计费类型按钮计数
  const quotaTypeModels = useMemo(() => {
    let result = modelsAfterCategory;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    return result;
  }, [modelsAfterCategory, filterGroup, filterEndpointType]);

  // 针对端点类型按钮计数
  const endpointTypeModels = useMemo(() => {
    let result = modelsAfterCategory;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    return result;
  }, [modelsAfterCategory, filterGroup, filterQuotaType]);

  // === 可用令牌分组计数模型（排除 group 过滤，保留其余过滤） ===
  const groupCountModels = useMemo(() => {
    let result = modelsAfterCategory; // 已包含分类筛选

    // 不应用 filterGroup 本身
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    if (searchValue && searchValue.length > 0) {
      const term = searchValue.toLowerCase();
      result = result.filter(m => m.model_name.toLowerCase().includes(term));
    }
    return result;
  }, [modelsAfterCategory, filterQuotaType, filterEndpointType, searchValue]);

  return {
    quotaTypeModels,
    endpointTypeModels,
    dynamicCategoryCounts,
    groupCountModels,
  };
}; 