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
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
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

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='full' placement='center'>
          <ModalDialog className='flex h-full max-h-[100vh] flex-col bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('筛选')}
            </ModalHeader>
            <ModalBody
              className='flex-1 overflow-y-auto p-0'
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <FilterModalContent sidebarProps={sidebarProps} t={t} />
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <FilterModalFooter
                onReset={handleResetFilters}
                onConfirm={onClose}
                t={t}
              />
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default PricingFilterModal;
