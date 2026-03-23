import React from 'react';
import { useTranslation } from 'react-i18next';
import DocumentRenderer from '../../components/common/DocumentRenderer';

const UserAgreement = () => {
  const { t } = useTranslation();

  return (
    <DocumentRenderer
      apiEndpoint='/api/user-agreement'
      title={t('用户协议')}
      cacheKey='user_agreement'
      emptyMessage={t('加载用户协议内容失败...')}
    />
  );
};

export default UserAgreement;
