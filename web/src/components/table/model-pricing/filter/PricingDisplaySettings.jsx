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

const PricingDisplaySettings = ({
  showWithRecharge,
  setShowWithRecharge,
  currency,
  setCurrency,
  showRatio,
  setShowRatio,
  viewMode,
  setViewMode,
  tokenUnit,
  setTokenUnit,
  loading = false,
  t,
}) => {
  const items = [
    {
      value: 'recharge',
      label: t('充值价格显示'),
    },
    {
      value: 'ratio',
      label: t('显示倍率'),
    },
    {
      value: 'tableView',
      label: t('表格视图'),
    },
    {
      value: 'tokenUnit',
      label: t('按K显示单位'),
    },
  ];

  const currencyItems = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'CNY', label: 'CNY (¥)' },
    { value: 'CUSTOM', label: t('自定义货币') },
  ];

  const handleChange = (value) => {
    switch (value) {
      case 'recharge':
        setShowWithRecharge(!showWithRecharge);
        break;
      case 'ratio':
        setShowRatio(!showRatio);
        break;
      case 'tableView':
        setViewMode(viewMode === 'table' ? 'card' : 'table');
        break;
      case 'tokenUnit':
        setTokenUnit(tokenUnit === 'K' ? 'M' : 'K');
        break;
    }
  };

  const getActiveValues = () => {
    const activeValues = [];
    if (showWithRecharge) activeValues.push('recharge');
    if (showRatio) activeValues.push('ratio');
    if (viewMode === 'table') activeValues.push('tableView');
    if (tokenUnit === 'K') activeValues.push('tokenUnit');
    return activeValues;
  };

  return (
    <div>
      <SelectableButtonGroup
        title={t('显示设置')}
        items={items}
        activeValue={getActiveValues()}
        onChange={handleChange}
        withCheckbox
        collapsible={false}
        loading={loading}
        t={t}
      />

      {showWithRecharge && (
        <SelectableButtonGroup
          title={t('货币单位')}
          items={currencyItems}
          activeValue={currency}
          onChange={setCurrency}
          collapsible={false}
          loading={loading}
          t={t}
        />
      )}
    </div>
  );
};

export default PricingDisplaySettings;
