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
import { Card } from '@heroui/react';
import { Info } from 'lucide-react';
import { stringToColor } from '../../../../../helpers';

const ModelBasicInfo = ({ modelData, vendorsMap = {}, t }) => {
  const getModelDescription = () => {
    if (!modelData) return t('暂无模型描述');
    if (modelData.description) return modelData.description;
    if (modelData.vendor_description)
      return t('供应商信息：') + modelData.vendor_description;
    return t('暂无模型描述');
  };

  const getModelTags = () => {
    const tags = [];
    if (modelData?.tags) {
      const customTags = modelData.tags.split(',').filter((tag) => tag.trim());
      customTags.forEach((tag) => {
        const tagText = tag.trim();
        tags.push({ text: tagText, color: stringToColor(tagText) });
      });
    }
    return tags;
  };

  const tags = getModelTags();

  return (
    <Card className='!rounded-2xl mb-6 border border-[color:var(--app-border)] shadow-sm'>
      <Card.Content className='space-y-4 p-5'>
        <div className='flex items-center gap-2'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'>
            <Info size={16} />
          </div>
          <div>
            <div className='text-base font-semibold text-foreground'>
              {t('基本信息')}
            </div>
            <div className='text-xs text-muted'>
              {t('模型的详细描述和基本特性')}
            </div>
          </div>
        </div>

        <div className='text-sm text-muted'>
          <p className='mb-3 leading-relaxed'>{getModelDescription()}</p>
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className='inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'
                  style={{
                    backgroundColor: `${tag.color}1A`,
                    color: tag.color,
                  }}
                >
                  {tag.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
};

export default ModelBasicInfo;
