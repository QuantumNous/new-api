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

/**
 * 分组筛选组件
 * @param {string} filterGroup 当前选中的分组，'all' 表示不过滤
 * @param {Function} setFilterGroup 设置选中分组
 * @param {Record<string, any>} usableGroup 后端返回的可用分组对象
 * @param {Record<string, number>} groupRatio 分组倍率对象
 * @param {Array} models 模型列表
 * @param {boolean} loading 是否加载中
 * @param {Function} t i18n
 */
const PricingGroups = ({ filterGroup, setFilterGroup, usableGroup = {}, groupRatio = {}, models = [], loading = false, t }) => {
  const groups = ['all', ...Object.keys(usableGroup).filter(key => key !== '')];

  const items = groups.map((g) => {
    const modelCount = g === 'all'
      ? models.length
      : models.filter(m => m.enable_groups && m.enable_groups.includes(g)).length;
    let ratioDisplay = '';
    if (g === 'all') {
      ratioDisplay = t('全部');
    } else {
      const ratio = groupRatio[g];
      if (ratio !== undefined && ratio !== null) {
        ratioDisplay = `x${ratio}`;
      } else {
        ratioDisplay = 'x1';
      }
    }
    return {
      value: g,
      label: g === 'all' ? t('全部分组') : g,
      tagCount: ratioDisplay,
      disabled: modelCount === 0
    };
  });

  return (
    <SelectableButtonGroup
      title={t('可用令牌分组')}
      items={items}
      activeValue={filterGroup}
      onChange={setFilterGroup}
      loading={loading}
      t={t}
    />
  );
};

export default PricingGroups; 