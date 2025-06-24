import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import { getFooterHTML, getLogo, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';

const FooterBar = () => {
  const { t } = useTranslation();
  const [footer, setFooter] = useState(getFooterHTML());
  const systemName = getSystemName();
  const logo = getLogo();
  const [statusState] = useContext(StatusContext);
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;

  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(footer_html);
    }
  };

  const currentYear = new Date().getFullYear();

  const customFooter = useMemo(() => (
    <footer className="relative bg-semi-color-bg-2 h-auto py-16 px-6 md:px-24 w-full flex flex-col items-center justify-between overflow-hidden">
      <div className="absolute hidden md:block top-[204px] left-[-100px] w-[151px] h-[151px] rounded-full bg-[#FFD166]"></div>
      <div className="absolute md:hidden bottom-[20px] left-[-50px] w-[80px] h-[80px] rounded-full bg-[#FFD166] opacity-60"></div>

      {isDemoSiteMode && (
        <div className="flex flex-col md:flex-row justify-between w-full max-w-[1110px] mb-10 gap-8">
          <div className="flex-shrink-0">
            <img
              src={logo}
              alt={systemName}
              className="w-16 h-16 rounded-full bg-gray-800 p-1.5 object-contain"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <div className="text-left">
              <p className="!text-semi-color-text-0 font-semibold mb-5">{t('关于我们')}</p>
              <div className="flex flex-col gap-4">
                <a href="https://docs.newapi.pro/wiki/project-introduction/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('关于项目')}</a>
                <a href="https://docs.newapi.pro/support/community-interaction/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('联系我们')}</a>
                <a href="https://docs.newapi.pro/wiki/features-introduction/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('功能特性')}</a>
              </div>
            </div>

            <div className="text-left">
              <p className="!text-semi-color-text-0 font-semibold mb-5">{t('文档')}</p>
              <div className="flex flex-col gap-4">
                <a href="https://docs.newapi.pro/getting-started/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('快速开始')}</a>
                <a href="https://docs.newapi.pro/installation/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('安装指南')}</a>
                <a href="https://docs.newapi.pro/api/" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">{t('API 文档')}</a>
              </div>
            </div>

            <div className="text-left">
              <p className="!text-semi-color-text-0 font-semibold mb-5">{t('相关项目')}</p>
              <div className="flex flex-col gap-4">
                <a href="https://github.com/songquanpeng/one-api" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">One API</a>
                <a href="https://github.com/novicezk/midjourney-proxy" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">Midjourney-Proxy</a>
                <a href="https://github.com/Deeptrain-Community/chatnio" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">chatnio</a>
                <a href="https://github.com/Calcium-Ion/neko-api-key-tool" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">neko-api-key-tool</a>
              </div>
            </div>

            <div className="text-left">
              <p className="!text-semi-color-text-0 font-semibold mb-5">{t('基于New API的项目')}</p>
              <div className="flex flex-col gap-4">
                <a href="https://github.com/Calcium-Ion/new-api-horizon" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">new-api-horizon</a>
                {/* <a href="https://github.com/VoAPI/VoAPI" target="_blank" rel="noopener noreferrer" className="!text-semi-color-text-1">VoAPI</a> */}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-[1110px] gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Typography.Text className="text-sm !text-semi-color-text-1">© {currentYear} {systemName}. {t('版权所有')}</Typography.Text>
        </div>

        <div className="text-sm">
          <span className="!text-semi-color-text-1">{t('设计与开发由')} </span>
          <a href="https://github.com/QuantumNous/new-api" target="_blank" rel="noopener noreferrer" className="!text-semi-color-primary font-medium">New API</a>
          <span className="!text-semi-color-text-1"> & </span>
          <a href="https://github.com/songquanpeng/one-api" target="_blank" rel="noopener noreferrer" className="!text-semi-color-primary font-medium">One API</a>
        </div>
      </div>
    </footer>
  ), [logo, systemName, t, currentYear, isDemoSiteMode]);

  useEffect(() => {
    loadFooter();
  }, []);

  return (
    <div className="w-full">
      {footer ? (
        <div
          className="custom-footer"
          dangerouslySetInnerHTML={{ __html: footer }}
        ></div>
      ) : (
        customFooter
      )}
    </div>
  );
};

export default FooterBar;
