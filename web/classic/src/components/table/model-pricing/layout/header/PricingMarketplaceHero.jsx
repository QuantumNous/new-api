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

import React, { memo, useMemo } from 'react';
import { Tag } from '@douyinfe/semi-ui';
import { getModelType, MODEL_TYPES } from '../../utils/modelType';

const PricingMarketplaceHero = memo(
  ({
    models = [],
    filteredModels = [],
    vendorsMap = {},
    loading = false,
    t,
  }) => {
    const summary = useMemo(() => {
      const modelCount = Array.isArray(models) ? models.length : 0;
      const filteredCount = Array.isArray(filteredModels)
        ? filteredModels.length
        : 0;
      const vendorNames = new Set();
      const endpointTypes = new Set();
      const capabilities = MODEL_TYPES.filter(
        (type) => type.value !== 'general',
      ).map((capability) => ({
        ...capability,
        count: 0,
      }));

      (Array.isArray(models) ? models : []).forEach((model) => {
        if (model?.vendor_name) {
          vendorNames.add(model.vendor_name);
        }
        if (Array.isArray(model?.supported_endpoint_types)) {
          model.supported_endpoint_types.forEach((endpoint) => {
            if (endpoint) endpointTypes.add(endpoint);
          });
        }
        const modelType = getModelType(model);
        const capability = capabilities.find(
          (item) => item.value === modelType.value,
        );
        if (capability) capability.count += 1;
      });

      Object.values(vendorsMap || {}).forEach((vendor) => {
        if (vendor?.name) vendorNames.add(vendor.name);
      });

      return {
        modelCount,
        filteredCount,
        vendorCount: vendorNames.size,
        endpointCount: endpointTypes.size,
        capabilities,
      };
    }, [filteredModels, models, vendorsMap]);

    const metrics = [
      {
        label: t('可用模型'),
        value: loading ? '-' : summary.modelCount || '-',
      },
      {
        label: t('当前结果'),
        value: loading ? '-' : summary.filteredCount || '-',
      },
      {
        label: t('供应商'),
        value: loading ? '-' : summary.vendorCount || '-',
      },
      {
        label: t('能力类型'),
        value: loading ? '-' : summary.endpointCount || '-',
      },
    ];

    return (
      <section className='pricing-marketplace-hero'>
        <div className='pricing-marketplace-hero-copy'>
          <div className='pricing-marketplace-eyebrow'>{t('模型广场')}</div>
          <h1>{t('探索当前站点可用模型')}</h1>
          <p>
            {t(
              '集中查看多供应商模型能力、端点类型和计费提示，具体可用范围以账号与分组配置为准。',
            )}
          </p>
        </div>

        <div className='pricing-marketplace-metrics'>
          {metrics.map((metric) => (
            <div key={metric.label} className='pricing-marketplace-metric'>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>

        <div
          className='pricing-marketplace-capabilities'
          aria-label={t('能力摘要')}
        >
          {summary.capabilities.map((capability) => (
            <Tag
              key={capability.value}
              shape='circle'
              color={capability.count > 0 ? 'blue' : 'white'}
            >
              {t(capability.label)}
              {capability.count > 0 ? ` ${capability.count}` : ''}
            </Tag>
          ))}
        </div>
      </section>
    );
  },
);

PricingMarketplaceHero.displayName = 'PricingMarketplaceHero';

export default PricingMarketplaceHero;
