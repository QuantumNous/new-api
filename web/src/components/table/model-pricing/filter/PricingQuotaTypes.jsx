import React from 'react';
import SelectableButtonGroup from '../../../common/ui/SelectableButtonGroup';

/**
 * 计费类型筛选组件
 * @param {string|'all'|0|1} filterQuotaType 当前值
 * @param {Function} setFilterQuotaType setter
 * @param {Array} models 模型列表
 * @param {boolean} loading 是否加载中
 * @param {Function} t i18n
 */
const PricingQuotaTypes = ({
  filterQuotaType,
  setFilterQuotaType,
  models = [],
  loading = false,
  t,
}) => {
  const qtyCount = (type) =>
    models.filter((m) => (type === 'all' ? true : m.quota_type === type))
      .length;

  const items = [
    { value: 'all', label: t('全部类型'), tagCount: qtyCount('all') },
    { value: 0, label: t('按量计费'), tagCount: qtyCount(0) },
    { value: 1, label: t('按次计费'), tagCount: qtyCount(1) },
  ];

  return (
    <SelectableButtonGroup
      title={t('计费类型')}
      items={items}
      activeValue={filterQuotaType}
      onChange={setFilterQuotaType}
      loading={loading}
      variant='amber'
      t={t}
    />
  );
};

export default PricingQuotaTypes;
