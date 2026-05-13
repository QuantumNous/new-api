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
import { getLobeHubIcon } from '../../../../helpers';
import { Tag } from 'lucide-react';
import { PricingFilterOptionPanel } from './PricingModelTypes';

const PricingVendors = ({
  filterVendor,
  setFilterVendor,
  models = [],
  allModels = [],
  loading = false,
  compact = false,
  defaultOpen = false,
  t,
}) => {
  const allVendors = React.useMemo(() => {
    const vendors = new Set();
    const vendorIcons = new Map();
    let hasUnknownVendor = false;

    (allModels.length > 0 ? allModels : models).forEach((model) => {
      if (model.vendor_name) {
        vendors.add(model.vendor_name);
        if (model.vendor_icon && !vendorIcons.has(model.vendor_name)) {
          vendorIcons.set(model.vendor_name, model.vendor_icon);
        }
      } else {
        hasUnknownVendor = true;
      }
    });

    return {
      vendors: Array.from(vendors).sort(),
      vendorIcons,
      hasUnknownVendor,
    };
  }, [allModels, models]);

  const getVendorCount = React.useCallback(
    (vendor) => {
      if (vendor === 'all') return models.length;
      if (vendor === 'unknown') {
        return models.filter((model) => !model.vendor_name).length;
      }
      return models.filter((model) => model.vendor_name === vendor).length;
    },
    [models],
  );

  const items = React.useMemo(() => {
    const result = [
      {
        value: 'all',
        label: t('全部提供商'),
        tagCount: getVendorCount('all'),
      },
    ];

    allVendors.vendors.forEach((vendor) => {
      const icon = allVendors.vendorIcons.get(vendor);
      result.push({
        value: vendor,
        label: vendor,
        icon: icon ? getLobeHubIcon(icon, 16) : null,
        tagCount: getVendorCount(vendor),
      });
    });

    if (allVendors.hasUnknownVendor) {
      result.push({
        value: 'unknown',
        label: t('未知供应商'),
        tagCount: getVendorCount('unknown'),
      });
    }

    return result;
  }, [allVendors, getVendorCount, t]);

  if (compact) {
    return (
      <PricingFilterOptionPanel
        title={t('提供商 / Provider')}
        icon={Tag}
        items={items}
        activeValue={filterVendor}
        onChange={setFilterVendor}
        loading={loading}
        defaultOpen={defaultOpen}
        optionsClassName='pricing-marketplace-filter-options-scroll'
      />
    );
  }

  return (
    <SelectableButtonGroup
      title={t('供应商')}
      items={items}
      activeValue={filterVendor}
      onChange={setFilterVendor}
      loading={loading}
      variant='violet'
      t={t}
    />
  );
};

export default PricingVendors;
