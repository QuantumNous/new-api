import React from 'react';
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationNotFound, IllustrationNotFoundDark } from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center items-center h-screen p-8">
      <Empty
        image={<IllustrationNotFound style={{ width: 250, height: 250 }} />}
        darkModeImage={<IllustrationNotFoundDark style={{ width: 250, height: 250 }} />}
        description={t('页面未找到，请检查您的浏览器地址是否正确')}
      />
    </div>
  );
};

export default NotFound;
