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
 * 模型标签 / 能力筛选组件（两个独立筛选维度）
 * @param {string|'all'} filterTag 当前选中的标签
 * @param {Function} setFilterTag 标签 setter
 * @param {string|'all'} filterCapability 当前选中的能力
 * @param {Function} setFilterCapability 能力 setter
 * @param {Array} models 标签维度过滤后模型列表（用于标签计数）
 * @param {Array} capabilityModels 能力维度过滤后模型列表（用于能力计数）
 * @param {Array} allModels 所有模型列表（用于获取全部标签/能力）
 * @param {boolean} loading 是否加载中
 * @param {Function} t i18n
 */
const PricingTags = ({
  filterTag,
  setFilterTag,
  filterCapability = 'all',
  setFilterCapability = () => {},
  models = [],
  capabilityModels = [],
  allModels = [],
  loading = false,
  t,
}) => {
  // 能力词表（用于把命中能力词的标签从「标签」分类里排除，只在「模型能力」里出现一次）
  const capabilityVocab = React.useMemo(() => {
    const set = new Set();
    (allModels.length > 0 ? allModels : models).forEach((model) => {
      (model.capability_tags || []).forEach((c) => {
        const v = String(c).trim().toLowerCase();
        if (v) set.add(v);
      });
    });
    return set;
  }, [allModels, models]);

  // 提取系统所有标签（排除能力词，避免与「模型能力」分类重复）
  const getAllTags = React.useMemo(() => {
    const tagSet = new Set();

    (allModels.length > 0 ? allModels : models).forEach((model) => {
      if (model.tags) {
        model.tags
          .split(/[,;|]+/) // 逗号、分号或竖线（保留空格，允许多词标签如 "open weights"）
          .map((tag) => tag.trim())
          .filter(Boolean)
          .forEach((tag) => {
            const lower = tag.toLowerCase();
            if (!capabilityVocab.has(lower)) tagSet.add(lower);
          });
      }
    });

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [allModels, models, capabilityVocab]);

  // 计算标签对应的模型数量
  const getTagCount = React.useCallback(
    (tag) => {
      if (tag === 'all') return models.length;

      const tagLower = tag.toLowerCase();
      return models.filter((model) => {
        if (!model.tags) return false;
        return model.tags
          .toLowerCase()
          .split(/[,;|]+/)
          .map((tg) => tg.trim())
          .includes(tagLower);
      }).length;
    },
    [models],
  );

  const items = React.useMemo(() => {
    const result = [
      {
        value: 'all',
        label: t('全部标签'),
        tagCount: getTagCount('all'),
      },
    ];

    getAllTags.forEach((tag) => {
      const count = getTagCount(tag);
      result.push({
        value: tag,
        label: tag,
        tagCount: count,
      });
    });

    return result;
  }, [getAllTags, getTagCount, t, models.length]);

  // 能力标签（独立分类）：来自各模型的 capability_tags
  const getCapabilityTags = React.useMemo(() => {
    const set = new Set();
    (allModels.length > 0 ? allModels : models).forEach((model) => {
      (model.capability_tags || []).forEach((c) => {
        const v = String(c).trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allModels, models]);

  // 能力计数使用能力维度的模型集合（capabilityModels）
  const getCapabilityCount = React.useCallback(
    (tag) => {
      if (tag === 'all') return capabilityModels.length;
      return capabilityModels.filter((model) =>
        (model.capability_tags || []).some((c) => String(c).trim() === tag),
      ).length;
    },
    [capabilityModels],
  );

  const capabilityItems = React.useMemo(() => {
    const result = [
      {
        value: 'all',
        label: t('全部能力'),
        tagCount: getCapabilityCount('all'),
      },
    ];

    getCapabilityTags.forEach((tag) => {
      result.push({
        value: tag,
        label: t(tag),
        tagCount: getCapabilityCount(tag),
      });
    });

    return result;
  }, [getCapabilityTags, getCapabilityCount, t]);

  return (
    <>
      {getCapabilityTags.length > 0 && (
        <SelectableButtonGroup
          title={t('模型能力')}
          items={capabilityItems}
          activeValue={filterCapability}
          onChange={setFilterCapability}
          loading={loading}
          variant='rose'
          t={t}
        />
      )}
      <SelectableButtonGroup
        title={t('标签')}
        items={items}
        activeValue={filterTag}
        onChange={setFilterTag}
        loading={loading}
        variant='rose'
        t={t}
      />
    </>
  );
};

export default PricingTags;
