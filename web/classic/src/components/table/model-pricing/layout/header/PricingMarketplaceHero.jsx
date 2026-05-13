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

import React, { memo } from 'react';
import { Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const PricingMarketplaceHero = memo(
  ({
    searchValue = '',
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    t,
  }) => {
    return (
      <section className='pricing-marketplace-hero'>
        <div className='pricing-marketplace-hero-copy'>
          <h1>{t('AI 模型库')}</h1>
          <p>
            {t(
              '一站式探索当前站点可用 AI 模型，统一查看能力、供应商与配置摘要。',
            )}
          </p>

          <div className='pricing-marketplace-hero-search'>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索模型...')}
              value={searchValue}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onChange={handleChange}
              showClear
              size='large'
              className='pricing-marketplace-hero-input'
              aria-label={t('搜索模型')}
            />
          </div>
        </div>
      </section>
    );
  },
);

PricingMarketplaceHero.displayName = 'PricingMarketplaceHero';

export default PricingMarketplaceHero;
