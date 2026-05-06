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
import { Layout, ImagePreview } from '@douyinfe/semi-ui';
import PricingSidebar from './PricingSidebar';
import PricingContent from './content/PricingContent';
import ModelDetailSideSheet from '../modal/ModelDetailSideSheet';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const { Sider, Content } = Layout;
  const isMobile = useIsMobile();
  const [showRatio, setShowRatio] = React.useState(false);
  const [viewMode, setViewMode] = React.useState('card');
  const vendorCount = Object.keys(pricingData.vendorsMap || {}).length;
  const groupCount = Object.keys(pricingData.usableGroup || {}).filter(
    (key) => key !== '',
  ).length;
  const allProps = {
    ...pricingData,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
  };

  return (
    <div className='pricing-page-surface'>
      <div className='pricing-overview'>
        <div className='pricing-overview-copy'>
          <div className='pricing-overview-kicker'>Pricing</div>
          <h1 className='pricing-overview-title'>
            {pricingData.t('模型定价')}
          </h1>
          <p className='pricing-overview-description'>
            {pricingData.t(
              '按供应商、计费方式、端点能力和分组倍率浏览全部可用模型，快速找到最适合当前业务场景的定价组合。',
            )}
          </p>
        </div>

        <div className='pricing-overview-metrics'>
          <div className='pricing-overview-metric'>
            <span>{pricingData.t('当前结果')}</span>
            <strong>{pricingData.filteredModels.length}</strong>
          </div>
          <div className='pricing-overview-metric'>
            <span>{pricingData.t('供应商')}</span>
            <strong>{vendorCount}</strong>
          </div>
          <div className='pricing-overview-metric'>
            <span>{pricingData.t('分组')}</span>
            <strong>{groupCount}</strong>
          </div>
        </div>
      </div>

      <Layout className='pricing-layout pricing-workbench-layout'>
        {!isMobile && (
          <Sider className='pricing-scroll-hide pricing-sidebar pricing-sidebar-column'>
            <PricingSidebar {...allProps} />
          </Sider>
        )}

        <Content className='pricing-scroll-hide pricing-content pricing-content-column'>
          <PricingContent
            {...allProps}
            isMobile={isMobile}
            sidebarProps={allProps}
          />
        </Content>
      </Layout>

      <ImagePreview
        src={pricingData.modalImageUrl}
        visible={pricingData.isModalOpenurl}
        onVisibleChange={(visible) => pricingData.setIsModalOpenurl(visible)}
      />

      <ModelDetailSideSheet
        visible={pricingData.showModelDetail}
        onClose={pricingData.closeModelDetail}
        modelData={pricingData.selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={pricingData.currency}
        siteDisplayType={pricingData.siteDisplayType}
        tokenUnit={pricingData.tokenUnit}
        displayPrice={pricingData.displayPrice}
        showRatio={allProps.showRatio}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={pricingData.t}
      />
    </div>
  );
};

export default PricingPage;
