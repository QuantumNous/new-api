import React from 'react';
import { Spin } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const Loading = ({ prompt: name = '', size = 'large' }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-white/80 z-[1000]">
      <div className="flex flex-col items-center">
        <Spin
          size={size}
          spinning={true}
          tip={null}
        />
        <span className="whitespace-nowrap mt-2 text-center" style={{ color: 'var(--semi-color-primary)' }}>
          {name ? t('{{name}}', { name }) : t('加载中...')}
        </span>
      </div>
    </div>
  );
};

export default Loading;
