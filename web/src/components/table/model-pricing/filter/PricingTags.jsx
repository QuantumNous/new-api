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
import { Tag, Typography } from '@douyinfe/semi-ui';

/**
 * PricingTags Component
 * Refactored to match OpenRouter's tag cloud/list style
 */
const PricingTags = ({
  filterTag,
  setFilterTag,
  models = [],
  allModels = [],
  loading = false,
  t,
}) => {
  // Extract all tags
  const getAllTags = React.useMemo(() => {
    const tagSet = new Set();
    (allModels.length > 0 ? allModels : models).forEach((model) => {
      if (model.tags) {
        model.tags
          .split(/[,;|]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .forEach((tag) => tagSet.add(tag.toLowerCase()));
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [allModels, models]);

  // Count models per tag
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
        label: t('All Models'),
        tagCount: getTagCount('all'),
        disabled: models.length === 0,
      },
    ];

    getAllTags.forEach((tag) => {
      const count = getTagCount(tag);
      result.push({
        value: tag,
        label: tag,
        tagCount: count,
        disabled: count === 0,
      });
    });

    return result;
  }, [getAllTags, getTagCount, t, models.length]);

  return (
    <div className="w-full">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
        {t('Modality')}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
            const isActive = filterTag === item.value;
            return (
                <Tag
                    key={item.value}
                    onClick={() => !item.disabled && setFilterTag(item.value)}
                    type={isActive ? 'solid' : 'ghost'}
                    color={isActive ? 'blue' : 'secondary'}
                    size="large"
                    style={{ 
                        cursor: item.disabled ? 'not-allowed' : 'pointer', 
                        opacity: item.disabled ? 0.5 : 1,
                        userSelect: 'none'
                    }}
                >
                    <span className="font-medium">{item.label}</span>
                    {item.tagCount > 0 && (
                        <span className={`
                            ml-2 text-xs px-1.5 py-0.5 rounded-md
                            ${isActive 
                                ? 'bg-white bg-opacity-20 text-white' 
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }
                        `}>
                            {item.tagCount}
                        </span>
                    )}
                </Tag>
            )
        })}
      </div>
    </div>
  );
};

export default PricingTags;
