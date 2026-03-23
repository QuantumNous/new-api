import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentRenderer from '../../components/common/DocumentRenderer';

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <DocumentRenderer
      apiEndpoint='/api/privacy-policy'
      title={t('隐私政策')}
      cacheKey='privacy_policy'
      emptyMessage={t('加载隐私政策内容失败...')}
    />
  );
};

export default PrivacyPolicy;
