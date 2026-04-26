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
import { Link as LinkIcon } from 'lucide-react';

const ModelEndpoints = ({ modelData, endpointMap = {}, t }) => {
  const renderAPIEndpoints = () => {
    if (!modelData) return null;
    const mapping = endpointMap;
    const types = modelData.supported_endpoint_types || [];

    return types.map((type) => {
      const info = mapping[type] || {};
      let path = info.path || '';
      if (path.includes('{model}')) {
        const modelName = modelData.model_name || modelData.modelName || '';
        path = path.replaceAll('{model}', modelName);
      }
      const method = info.method || 'POST';
      return (
        <div
          key={type}
          className='flex items-start justify-between gap-3 border-b border-dashed border-[color:var(--app-border)] py-2 last:border-0 last:pb-0'
        >
          <span className='flex min-w-0 flex-1 items-center gap-1.5 text-sm text-foreground'>
            <span className='inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500' />
            <span className='shrink-0 font-medium'>{type}</span>
            {path && (
              <>
                <span className='shrink-0 text-muted'>：</span>
                <span className='min-w-0 break-all text-xs text-muted'>
                  {path}
                </span>
              </>
            )}
          </span>
          {path && (
            <span className='shrink-0 text-xs uppercase tracking-wide text-muted'>
              {method}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <Card className='!rounded-2xl mb-6 border border-[color:var(--app-border)] shadow-sm'>
      <Card.Content className='space-y-3 p-5'>
        <div className='flex items-center gap-2'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300'>
            <LinkIcon size={16} />
          </div>
          <div>
            <div className='text-base font-semibold text-foreground'>
              {t('API端点')}
            </div>
            <div className='text-xs text-muted'>
              {t('模型支持的接口端点信息')}
            </div>
          </div>
        </div>
        <div className='space-y-1'>{renderAPIEndpoints()}</div>
      </Card.Content>
    </Card>
  );
};

export default ModelEndpoints;
