import React from 'react';
import PricingTable from '../../view/table/PricingTable';
import PricingCardView from '../../view/card/PricingCardView';

const PricingView = ({ viewMode = 'table', ...props }) => {
  return viewMode === 'card' ? (
    <PricingCardView {...props} />
  ) : (
    <PricingTable {...props} />
  );
};

export default PricingView;
