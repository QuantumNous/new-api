import { useMemo } from 'react';

// 工具函数：将 tags 字符串转为小写去重数组
const normalizeTags = (tags = '') =>
  tags
    .toLowerCase()
    .split(/[,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * 统一计算模型筛选后的各种集合与动态计数，供多个组件复用
 */
export const usePricingFilterCounts = ({
  models = [],
  filterGroup = 'all',
  filterQuotaType = 'all',
  filterEndpointType = 'all',
  filterVendor = 'all',
  filterTag = 'all',
  searchValue = '',
}) => {
  // 均使用同一份模型列表，避免创建新引用
  const allModels = models;

  /**
   * 通用过滤函数
   * @param {Object} model
   * @param {Array<string>} ignore 需要忽略的过滤条件 key
   * @returns {boolean}
   */
  const matchesFilters = (model, ignore = []) => {
    // 分组
    if (!ignore.includes('group') && filterGroup !== 'all') {
      if (!model.enable_groups || !model.enable_groups.includes(filterGroup))
        return false;
    }

    // 计费类型
    if (!ignore.includes('quota') && filterQuotaType !== 'all') {
      if (model.quota_type !== filterQuotaType) return false;
    }

    // 端点类型
    if (!ignore.includes('endpoint') && filterEndpointType !== 'all') {
      if (
        !model.supported_endpoint_types ||
        !model.supported_endpoint_types.includes(filterEndpointType)
      )
        return false;
    }

    // 供应商
    if (!ignore.includes('vendor') && filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        if (model.vendor_name) return false;
      } else if (model.vendor_name !== filterVendor) {
        return false;
      }
    }

    // 标签
    if (!ignore.includes('tag') && filterTag !== 'all') {
      const tagsArr = normalizeTags(model.tags);
      if (!tagsArr.includes(filterTag.toLowerCase())) return false;
    }

    // 搜索
    if (!ignore.includes('search') && searchValue) {
      const term = searchValue.toLowerCase();
      const tags = model.tags ? model.tags.toLowerCase() : '';
      if (
        !(
          model.model_name.toLowerCase().includes(term) ||
          (model.description &&
            model.description.toLowerCase().includes(term)) ||
          tags.includes(term) ||
          (model.vendor_name && model.vendor_name.toLowerCase().includes(term))
        )
      )
        return false;
    }

    return true;
  };

  // 生成不同视图所需的模型集合
  const quotaTypeModels = useMemo(
    () => allModels.filter((m) => matchesFilters(m, ['quota'])),
    [
      allModels,
      filterGroup,
      filterEndpointType,
      filterVendor,
      filterTag,
      searchValue,
    ],
  );

  const endpointTypeModels = useMemo(
    () => allModels.filter((m) => matchesFilters(m, ['endpoint'])),
    [
      allModels,
      filterGroup,
      filterQuotaType,
      filterVendor,
      filterTag,
      searchValue,
    ],
  );

  const vendorModels = useMemo(
    () => allModels.filter((m) => matchesFilters(m, ['vendor'])),
    [
      allModels,
      filterGroup,
      filterQuotaType,
      filterEndpointType,
      filterTag,
      searchValue,
    ],
  );

  const tagModels = useMemo(
    () => allModels.filter((m) => matchesFilters(m, ['tag'])),
    [
      allModels,
      filterGroup,
      filterQuotaType,
      filterEndpointType,
      filterVendor,
      searchValue,
    ],
  );

  const groupCountModels = useMemo(
    () => allModels.filter((m) => matchesFilters(m, ['group'])),
    [
      allModels,
      filterQuotaType,
      filterEndpointType,
      filterVendor,
      filterTag,
      searchValue,
    ],
  );

  return {
    quotaTypeModels,
    endpointTypeModels,
    vendorModels,
    groupCountModels,
    tagModels,
  };
};
