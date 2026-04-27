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

import React, { useEffect } from 'react';
import { Button } from '@heroui/react';
import { X } from 'lucide-react';

import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ModelHeader from './components/ModelHeader';
import ModelBasicInfo from './components/ModelBasicInfo';
import ModelEndpoints from './components/ModelEndpoints';
import ModelPricingTable from './components/ModelPricingTable';
import DynamicPricingBreakdown from './components/DynamicPricingBreakdown';

const ModelDetailSideSheet = ({
  visible,
  onClose,
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  vendorsMap,
  endpointMap,
  autoGroups,
  t,
}) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!visible}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`fixed bottom-0 right-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='min-w-0 flex-1'>
            {modelData ? (
              <ModelHeader
                modelData={modelData}
                vendorsMap={vendorsMap}
                t={t}
              />
            ) : (
              <span className='text-sm text-muted'>{t('加载中...')}</span>
            )}
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={onClose}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex-1 overflow-y-auto p-3'>
          {!modelData && (
            <div className='flex items-center justify-center py-10 text-sm text-muted'>
              {t('加载中...')}
            </div>
          )}
          {modelData && (
            <>
              <ModelBasicInfo
                modelData={modelData}
                vendorsMap={vendorsMap}
                t={t}
              />
              <ModelEndpoints
                modelData={modelData}
                endpointMap={endpointMap}
                t={t}
              />
              {modelData.billing_mode === 'tiered_expr' &&
                modelData.billing_expr && (
                  <DynamicPricingBreakdown
                    billingExpr={modelData.billing_expr}
                    t={t}
                  />
                )}
              <ModelPricingTable
                modelData={modelData}
                groupRatio={groupRatio}
                currency={currency}
                siteDisplayType={siteDisplayType}
                tokenUnit={tokenUnit}
                displayPrice={displayPrice}
                showRatio={showRatio}
                usableGroup={usableGroup}
                autoGroups={autoGroups}
                t={t}
              />
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default ModelDetailSideSheet;
