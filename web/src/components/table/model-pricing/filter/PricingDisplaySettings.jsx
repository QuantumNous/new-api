import React from 'react';
import SelectableButtonGroup from '../../../common/ui/SelectableButtonGroup';

const PricingDisplaySettings = ({
  showWithRecharge,
  setShowWithRecharge,
  currency,
  setCurrency,
  siteDisplayType,
  showRatio,
  setShowRatio,
  viewMode,
  setViewMode,
  tokenUnit,
  setTokenUnit,
  loading = false,
  t,
}) => {
  const supportsCurrencyDisplay = siteDisplayType !== 'TOKENS';

  const items = [
    ...(supportsCurrencyDisplay
      ? [
          {
            value: 'recharge',
            label: t('充值价格显示'),
          },
        ]
      : []),
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
    if (supportsCurrencyDisplay && showWithRecharge) activeValues.push('recharge');
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

      {supportsCurrencyDisplay && showWithRecharge && (
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
