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

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Button,
  Chip,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { getLobeHubIcon } from '../../../../../helpers';
import SearchActions from './SearchActions';

const CONFIG = {
  CAROUSEL_INTERVAL: 2000,
  ICON_SIZE: 28,
  UNKNOWN_VENDOR: 'unknown',
};

const CONTENT_TEXTS = {
  unknown: {
    displayName: (t) => t('未知供应商'),
    description: (t) =>
      t(
        '包含来自未知或未标明供应商的AI模型，这些模型可能来自小型供应商或开源项目。',
      ),
  },
  all: {
    description: (t) =>
      t('查看所有可用的AI模型供应商，包括众多知名供应商的模型。'),
  },
  fallback: {
    description: (t) => t('该供应商提供多种AI模型，适用于不同的应用场景。'),
  },
};

const getVendorDisplayName = (vendorName, t) =>
  vendorName === CONFIG.UNKNOWN_VENDOR
    ? CONTENT_TEXTS.unknown.displayName(t)
    : vendorName;

// Avatar swatch — uses the vendor's brand icon when available, otherwise
// falls back to a neutral letter chip. Sized to read as a section glyph,
// not a hero badge (12 × 12 vs the original 64 × 64) so the description
// next to it keeps line dominance.
const VendorAvatar = ({ vendor, t }) => {
  if (!vendor) {
    return (
      <div
        className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-sm font-semibold text-muted'
        aria-hidden='true'
      >
        AI
      </div>
    );
  }

  const displayName = getVendorDisplayName(vendor.name, t);
  const letter =
    vendor.name === CONFIG.UNKNOWN_VENDOR
      ? '?'
      : vendor.name.charAt(0).toUpperCase();

  return (
    <div
      className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-sm font-semibold text-foreground'
      title={displayName}
    >
      {vendor.icon
        ? getLobeHubIcon(vendor.icon, CONFIG.ICON_SIZE)
        : letter}
    </div>
  );
};

const PricingVendorIntro = memo(
  ({
    filterVendor,
    models = [],
    allModels = [],
    t,
    selectedRowKeys = [],
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile = false,
    searchValue = '',
    setShowFilterModal,
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
  }) => {
    const [currentOffset, setCurrentOffset] = useState(0);
    const [descModalVisible, setDescModalVisible] = useState(false);
    const [descModalContent, setDescModalContent] = useState('');

    const handleCloseDescModal = useCallback(() => {
      setDescModalVisible(false);
    }, []);

    const descModalState = useOverlayState({
      isOpen: descModalVisible,
      onOpenChange: (isOpen) => {
        if (!isOpen) handleCloseDescModal();
      },
    });

    const handleOpenDescModal = useCallback((content) => {
      setDescModalContent(content || '');
      setDescModalVisible(true);
    }, []);

    const vendorInfo = useMemo(() => {
      const vendors = new Map();
      let unknownCount = 0;

      const sourceModels =
        Array.isArray(allModels) && allModels.length > 0 ? allModels : models;

      sourceModels.forEach((model) => {
        if (model.vendor_name) {
          const existing = vendors.get(model.vendor_name);
          if (existing) {
            existing.count++;
          } else {
            vendors.set(model.vendor_name, {
              name: model.vendor_name,
              icon: model.vendor_icon,
              description: model.vendor_description,
              count: 1,
            });
          }
        } else {
          unknownCount++;
        }
      });

      const vendorList = Array.from(vendors.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      if (unknownCount > 0) {
        vendorList.push({
          name: CONFIG.UNKNOWN_VENDOR,
          icon: null,
          description: CONTENT_TEXTS.unknown.description(t),
          count: unknownCount,
        });
      }

      return vendorList;
    }, [allModels, models, t]);

    const currentModelCount = models.length;

    // When viewing "All vendors", cycle the avatar through known vendors
    // so the section reads as a brand showcase. For a single selected
    // vendor we lock the avatar so it doesn't flicker.
    useEffect(() => {
      if (filterVendor !== 'all' || vendorInfo.length <= 1) {
        setCurrentOffset(0);
        return;
      }
      const interval = setInterval(() => {
        setCurrentOffset((prev) => (prev + 1) % vendorInfo.length);
      }, CONFIG.CAROUSEL_INTERVAL);
      return () => clearInterval(interval);
    }, [filterVendor, vendorInfo.length]);

    const getVendorDescription = useCallback(
      (vendorKey) => {
        if (vendorKey === 'all') return CONTENT_TEXTS.all.description(t);
        if (vendorKey === CONFIG.UNKNOWN_VENDOR)
          return CONTENT_TEXTS.unknown.description(t);
        const vendor = vendorInfo.find((v) => v.name === vendorKey);
        return vendor?.description || CONTENT_TEXTS.fallback.description(t);
      },
      [vendorInfo, t],
    );

    // Resolve the avatar + meta data for the current view
    const headerVendor = useMemo(() => {
      if (filterVendor === 'all') {
        return {
          title: t('全部供应商'),
          description: getVendorDescription('all'),
          avatarVendor:
            vendorInfo.length > 0
              ? vendorInfo[currentOffset % vendorInfo.length]
              : null,
        };
      }
      const current = vendorInfo.find((v) => v.name === filterVendor);
      if (!current) return null;
      return {
        title: getVendorDisplayName(current.name, t),
        description: current.description || getVendorDescription(current.name),
        avatarVendor: current,
      };
    }, [filterVendor, vendorInfo, currentOffset, getVendorDescription, t]);

    if (!headerVendor) return null;

    return (
      <>
        {/*
          Flat header strip — the previous design rendered a heavy blue/
          green gradient cover image with white-on-tinted text, which
          fought every other surface on the page for attention. Now we
          render a plain row inside the page background: avatar on the
          left, title + count + description on the right, and the search
          actions sit underneath as a normal sibling. No card chrome, no
          cover image, no theme-specific gradients — keeps the focus on
          the actual model list below.
        */}
        <div className='flex flex-col gap-3 pb-3'>
          <div className='flex items-start gap-3'>
            <VendorAvatar vendor={headerVendor.avatarVendor} t={t} />
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='truncate text-lg font-semibold text-foreground'>
                  {headerVendor.title}
                </h2>
                <Chip size='sm' variant='secondary'>
                  {t('共 {{count}} 个模型', { count: currentModelCount })}
                </Chip>
              </div>
              <button
                type='button'
                onClick={() => handleOpenDescModal(headerVendor.description)}
                className='mt-1 line-clamp-2 text-left text-xs leading-relaxed text-muted hover:text-foreground'
              >
                {headerVendor.description}
              </button>
            </div>
          </div>

          <SearchActions
            selectedRowKeys={selectedRowKeys}
            copyText={copyText}
            handleChange={handleChange}
            handleCompositionStart={handleCompositionStart}
            handleCompositionEnd={handleCompositionEnd}
            isMobile={isMobile}
            searchValue={searchValue}
            setShowFilterModal={setShowFilterModal}
            showWithRecharge={showWithRecharge}
            setShowWithRecharge={setShowWithRecharge}
            currency={currency}
            setCurrency={setCurrency}
            siteDisplayType={siteDisplayType}
            showRatio={showRatio}
            setShowRatio={setShowRatio}
            viewMode={viewMode}
            setViewMode={setViewMode}
            tokenUnit={tokenUnit}
            setTokenUnit={setTokenUnit}
            t={t}
          />
        </div>

        <Modal state={descModalState}>
          <ModalBackdrop variant='blur'>
            <ModalContainer size={isMobile ? 'full' : 'lg'} placement='center'>
              <ModalDialog className='bg-background/95 backdrop-blur'>
                <ModalHeader className='border-b border-border'>
                  {t('供应商介绍')}
                </ModalHeader>
                <ModalBody className='max-h-[70vh] overflow-y-auto text-sm'>
                  {descModalContent}
                </ModalBody>
                <ModalFooter className='border-t border-border'>
                  <Button variant='primary' onPress={handleCloseDescModal}>
                    {t('确定')}
                  </Button>
                </ModalFooter>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      </>
    );
  },
);

PricingVendorIntro.displayName = 'PricingVendorIntro';

export default PricingVendorIntro;
