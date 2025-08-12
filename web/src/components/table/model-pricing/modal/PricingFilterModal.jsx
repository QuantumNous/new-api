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
import { Modal } from '@douyinfe/semi-ui';
import { resetPricingFilters } from '../../../../helpers/utils';
import FilterModalContent from './components/FilterModalContent';
import FilterModalFooter from './components/FilterModalFooter';

const PricingFilterModal = ({
  visible,
  onClose,
  sidebarProps,
  t
}) => {
  const handleResetFilters = () =>
    resetPricingFilters({
      handleChange: sidebarProps.handleChange,
      setShowWithRecharge: sidebarProps.setShowWithRecharge,
      setCurrency: sidebarProps.setCurrency,
      setShowRatio: sidebarProps.setShowRatio,
      setViewMode: sidebarProps.setViewMode,
      setFilterGroup: sidebarProps.setFilterGroup,
      setFilterQuotaType: sidebarProps.setFilterQuotaType,
      setFilterEndpointType: sidebarProps.setFilterEndpointType,
      setFilterVendor: sidebarProps.setFilterVendor,
      setFilterTag: sidebarProps.setFilterTag,
      setCurrentPage: sidebarProps.setCurrentPage,
      setTokenUnit: sidebarProps.setTokenUnit,
    });

  const footer = (
    <FilterModalFooter
      onReset={handleResetFilters}
      onConfirm={onClose}
      t={t}
    />
  );

  return (
    <Modal
      title={t('筛选')}
      visible={visible}
      onCancel={onClose}
      footer={footer}
      style={{ width: '100%', height: '100%', margin: 0 }}
      bodyStyle={{
        padding: 0,
        height: 'calc(100vh - 160px)',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      <FilterModalContent sidebarProps={sidebarProps} t={t} />
    </Modal>
  );
};

export default PricingFilterModal; 