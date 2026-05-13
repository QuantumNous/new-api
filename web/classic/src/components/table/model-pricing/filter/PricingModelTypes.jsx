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
import { ALL_MODEL_TYPE_OPTION, MODEL_TYPES } from '../utils/modelType';

const PricingModelTypes = ({
  filterModelType,
  setFilterModelType,
  modelTypeCounts = {},
  loading = false,
  t,
}) => {
  const items = React.useMemo(
    () => [
      {
        value: ALL_MODEL_TYPE_OPTION.value,
        label: t(ALL_MODEL_TYPE_OPTION.label),
        tagCount: modelTypeCounts.all || 0,
      },
      ...MODEL_TYPES.map((type) => ({
        value: type.value,
        label: t(type.label),
        tagCount: modelTypeCounts[type.value] || 0,
      })),
    ],
    [modelTypeCounts, t],
  );

  return (
    <SelectableButtonGroup
      title={t('模型类型')}
      items={items}
      activeValue={filterModelType}
      onChange={setFilterModelType}
      loading={loading}
      variant='teal'
      t={t}
    />
  );
};

export default PricingModelTypes;
