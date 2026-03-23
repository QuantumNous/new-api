import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import { getFooterHTML, getLogo, getSystemName } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { Link, useLocation } from 'react-router-dom';

const FooterBar = () => {
  const { t } = useTranslation();
  const [footer, setFooter] = useState(getFooterHTML());
  const systemName = getSystemName();
  const logo = getLogo();
  const [statusState] = useContext(StatusContext);
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const location = useLocation();
  const isMarketingHome = location.pathname === '/';
  const isMarketingFooterRoute = [
    '/',
    '/about',
    '/login',
    '/register',
    '/reset',
    '/user/reset',
  ].includes(location.pathname);
  const marketingBrandName = 'AI Force';
  const resolvedSystemName =
    systemName === 'New API' ? marketingBrandName : systemName;
  const homeDisplayName = isMarketingHome
    ? marketingBrandName
    : resolvedSystemName;

  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(footer_html);
    }
  };

  const currentYear = new Date().getFullYear();

  const customFooter = useMemo(
    () => (
      <footer className='app-footer-shell relative h-auto py-8 md:py-10 px-6 md:px-20 w-full flex flex-col items-center justify-between overflow-hidden'>
        <div className='absolute hidden md:block top-[204px] left-[-100px] w-[151px] h-[151px] rounded-full bg-[#FFD166]'></div>
        <div className='absolute md:hidden bottom-[20px] left-[-50px] w-[80px] h-[80px] rounded-full bg-[#FFD166] opacity-60'></div>

        {isDemoSiteMode && (
          <div className='app-footer-grid flex flex-col md:flex-row justify-between w-full max-w-[1110px] mb-6 md:mb-8 gap-6 md:gap-8'>
            <div className='flex-shrink-0'>
              <img
                src={logo}
                alt={systemName}
                className='w-16 h-16 rounded-full bg-gray-800 p-1.5 object-contain'
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 w-full'>
              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('关于我们')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://docs.newapi.pro/wiki/project-introduction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('关于项目')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/support/community-interaction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('联系我们')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/wiki/features-introduction/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('功能特性')}
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('文档')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://docs.newapi.pro/getting-started/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('快速开始')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/installation/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('安装指南')}
                  </a>
                  <a
                    href='https://docs.newapi.pro/api/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    {t('API 文档')}
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('相关项目')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://github.com/songquanpeng/one-api'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    One API
                  </a>
                  <a
                    href='https://github.com/novicezk/midjourney-proxy'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    Midjourney-Proxy
                  </a>
                  <a
                    href='https://github.com/Calcium-Ion/neko-api-key-tool'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    neko-api-key-tool
                  </a>
                </div>
              </div>

              <div className='text-left'>
                <p className='!text-semi-color-text-0 font-semibold mb-5'>
                  {t('友情链接')}
                </p>
                <div className='flex flex-col gap-4'>
                  <a
                    href='https://github.com/Calcium-Ion/new-api-horizon'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    new-api-horizon
                  </a>
                  <a
                    href='https://github.com/coaidev/coai'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    CoAI
                  </a>
                  <a
                    href='https://www.gpt-load.com/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='!text-semi-color-text-1'
                  >
                    GPT-Load
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='app-footer-meta flex flex-col md:flex-row items-center justify-between w-full max-w-[1110px] gap-4 md:gap-6'>
          <div className='flex flex-wrap items-center gap-2'>
            <Typography.Text className='text-sm !text-semi-color-text-1'>
              © {currentYear} {homeDisplayName}. {t('版权所有')}
            </Typography.Text>
          </div>

          <div className='text-sm'>
            <span className='!text-semi-color-text-1'>
              {t('设计与开发由')}{' '}
            </span>
            <span
              className='!text-semi-color-primary font-medium'
            >
              {marketingBrandName}
            </span>
          </div>
        </div>
      </footer>
    ),
    [
      currentYear,
      homeDisplayName,
      isDemoSiteMode,
      isMarketingHome,
      logo,
      systemName,
      t,
    ],
  );

  const marketingFooter = useMemo(
    () => (
      <footer className='marketing-site-footer'>
        <div className='marketing-site-footer__inner'>
          <div className='marketing-site-footer__grid'>
            <div className='marketing-site-footer__column'>
              <h3>{t('产品')}</h3>
              <Link to='/'>{t('首页')}</Link>
              <Link to='/pricing'>{t('价格方案')}</Link>
              <Link to='/login'>{t('登录')}</Link>
            </div>

            <div className='marketing-site-footer__column'>
              <h3>{t('资源')}</h3>
              <Link to='/docs'>{t('使用教程')}</Link>
              <Link to='/about'>{t('品牌故事')}</Link>
              {/* <a href='https://github.com/QuantumNous/new-api' target='_blank' rel='noopener noreferrer'>
                GitHub
              </a> */}
            </div>

            <div className='marketing-site-footer__column'>
              <h3>{t('AI 模型')}</h3>
              <span>Claude Code</span>
              <span>Codex</span>
              {/* <span>Gemini CLI</span> */}
            </div>

            <div className='marketing-site-footer__column'>
              <h3>{t('服务承诺')}</h3>
              <span>{t('透明定价')}</span>
              <span>{t('隐私保护')}</span>
              <span>{t('安全合规')}</span>
            </div>

            <div className='marketing-site-footer__column'>
              <h3>{t('解决方案')}</h3>
              <span>{t('AI 编程助手')}</span>
              <span>{t('代码生成')}</span>
              <span>{t('技术支持')}</span>
            </div>

            <div className='marketing-site-footer__column'>
              <h3>{t('关于')}</h3>
              <Link to='/about'>{t('关于项目')}</Link>
              <span>
                support@AIF4
              </span>
            </div>
          </div>

          <div className='marketing-site-footer__meta marketing-site-footer__meta--centered'>
            <Typography.Text className='marketing-site-footer__meta-text'>
              © {currentYear} {marketingBrandName}. {t('保留所有权利。')}
            </Typography.Text>
            <div className='marketing-site-footer__meta-links'>
              <span>{t('项目维护')}</span>
              <span>
                AIF4 / AI Force
              </span>
            </div>
          </div>
        </div>
      </footer>
    ),
    [currentYear, marketingBrandName, t],
  );

  useEffect(() => {
    loadFooter();
  }, []);

  return (
    <div className='w-full app-footer-shell'>
      {footer ? (
        <div className='relative app-footer-custom'>
          <div
            className='custom-footer'
            dangerouslySetInnerHTML={{ __html: footer }}
          ></div>
          <div className='absolute bottom-2 right-4 text-xs !text-semi-color-text-2 opacity-70'>
            <span>{t('设计与开发由')} </span>
            <a
              href=''
              target=''
              rel='noopener noreferrer'
              className='!text-semi-color-primary font-medium'
            >
              {marketingBrandName}
            </a>
          </div>
        </div>
      ) : (
        isMarketingFooterRoute ? marketingFooter : customFooter
      )}
    </div>
  );
};

export default FooterBar;
