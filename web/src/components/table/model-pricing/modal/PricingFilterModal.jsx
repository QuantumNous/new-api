import React from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { resetPricingFilters } from '../../../../helpers/utils';
import FilterModalContent from './components/FilterModalContent';
import FilterModalFooter from './components/FilterModalFooter';

const PricingFilterModal = ({ visible, onClose, sidebarProps, t }) => {
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
    <FilterModalFooter onReset={handleResetFilters} onConfirm={onClose} t={t} />
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
        msOverflowStyle: 'none',
      }}
    >
      <FilterModalContent sidebarProps={sidebarProps} t={t} />
    </Modal>
  );
};

export default PricingFilterModal;
