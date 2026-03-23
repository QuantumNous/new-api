import React from 'react';
import { SideSheet, Typography, Button } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';

import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ModelHeader from './components/ModelHeader';
import ModelBasicInfo from './components/ModelBasicInfo';
import ModelEndpoints from './components/ModelEndpoints';
import ModelPricingTable from './components/ModelPricingTable';

const { Text } = Typography;

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

  return (
    <SideSheet
      placement='right'
      title={
        <ModelHeader modelData={modelData} vendorsMap={vendorsMap} t={t} />
      }
      bodyStyle={{
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--semi-color-border)',
      }}
      visible={visible}
      width={isMobile ? '100%' : 600}
      closeIcon={
        <Button
          className='semi-button-tertiary semi-button-size-small semi-button-borderless'
          type='button'
          icon={<IconClose />}
          onClick={onClose}
        />
      }
      onCancel={onClose}
    >
      <div className='p-2'>
        {!modelData && (
          <div className='flex justify-center items-center py-10'>
            <Text type='secondary'>{t('加载中...')}</Text>
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
    </SideSheet>
  );
};

export default ModelDetailSideSheet;
