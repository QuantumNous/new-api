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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Collapsible } from '@douyinfe/semi-ui';
import { API } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconMinus, IconBolt, IconExternalOpen } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';

const { Title, Text, Paragraph } = Typography;
const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

const btnSolid = {
  height: 52,
  paddingLeft: 24,
  paddingRight: 24,
  borderRadius: 9999,
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  textDecoration: 'none',
  lineHeight: 1,
  transition: `transform 260ms ${easing}, box-shadow 260ms ${easing}, background 260ms ${easing}, border-color 260ms ${easing}, color 260ms ${easing}`,
};

const btnContained = {
  ...btnSolid,
  background: 'var(--semi-color-text-0)',
  color: 'var(--semi-color-bg-0)',
  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.16)',
};

const btnOutlined = {
  ...btnSolid,
  background: 'transparent',
  border: '1px solid var(--semi-color-text-0)',
  color: 'var(--semi-color-text-0)',
};

const btnPrimary = {
  ...btnSolid,
  height: 48,
  paddingLeft: 28,
  paddingRight: 28,
  background: 'var(--semi-color-primary)',
  color: '#fff',
  boxShadow: '0 12px 32px rgba(99, 102, 241, 0.28), 0 4px 12px rgba(99, 102, 241, 0.16)',
};

const btnWhiteOutline = {
  ...btnSolid,
  height: 48,
  paddingLeft: 28,
  paddingRight: 28,
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  color: '#fff',
};

const useScrollY = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let ticking = false;

    const update = () => {
      setScrollY(window.scrollY || window.pageYOffset || 0);
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frameId = window.requestAnimationFrame(update);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return scrollY;
};

const Reveal = ({
  children,
  delay = 0,
  distance = 24,
  initialScale = 0.98,
  threshold = 0.18,
  style = {},
  as: Component = 'div',
}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -10% 0px',
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Component
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translate3d(0, 0, 0) scale(1)'
          : `translate3d(0, ${distance}px, 0) scale(${initialScale})`,
        transition: `opacity 780ms ${easing} ${delay}ms, transform 780ms ${easing} ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </Component>
  );
};

const FaqItem = ({ question, answer, isOpen, onClick }) => (
  <div
    className='uni-home-faq-item'
    style={{
      borderRadius: 16,
      overflow: 'hidden',
      transition: `background 0.24s ${easing}, transform 0.24s ${easing}`,
      background: isOpen ? 'rgba(145, 158, 171, 0.08)' : 'transparent',
      border: '1px solid var(--semi-color-border)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}
  >
    <div
      style={{
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        gap: 16,
      }}
      onClick={onClick}
    >
      <Title heading={6} style={{ flex: 1, margin: 0 }}>
        {question}
      </Title>
      {isOpen ? (
        <IconMinus
          style={{
            color: 'var(--semi-color-text-2)',
            fontSize: 20,
            flexShrink: 0,
          }}
        />
      ) : (
        <IconPlus
          style={{
            color: 'var(--semi-color-text-2)',
            fontSize: 20,
            flexShrink: 0,
          }}
        />
      )}
    </div>
    <Collapsible isOpen={isOpen}>
      <div style={{ padding: '0 20px 24px' }}>
        <Paragraph
          type='secondary'
          style={{ fontSize: 14, lineHeight: '24px', margin: 0 }}
        >
          {answer}
        </Paragraph>
      </div>
    </Collapsible>
  </div>
);

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const docsLink = statusState?.status?.docs_link || '';
  const primaryEntryPath = userState?.user ? '/console' : '/register';
  const [openFaq, setOpenFaq] = useState(0);
  const scrollY = useScrollY();

  const heroLift = Math.min(scrollY * 0.14, 92);
  const heroOpacity = Math.max(0.34, 1 - scrollY / 760);
  const heroScale = Math.max(0.97, 1 - scrollY / 9000);
  const heroGridShift = Math.min(scrollY * 0.08, 72);
  const heroGlowShift = Math.min(scrollY * 0.18, 120);
  const integrationShift = Math.min(scrollY * 0.04, 28);
  const ctaRocketShift = Math.min(scrollY * 0.05, 24);

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    try {
      const res = await API.get('/api/home_page_content');
      const { success, data } = res.data;
      if (success) {
        let content = data;
        if (!data.startsWith('https://')) {
          content = marked.parse(data);
        }
        setHomePageContent(content);
        localStorage.setItem('home_page_content', content);
        if (data.startsWith('https://')) {
          const iframe = document.querySelector('iframe');
          if (iframe) {
            iframe.onload = () => {
              iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
              iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
            };
          }
        }
      } else {
        setHomePageContent('');
      }
    } catch {
      setHomePageContent('');
    }
    setHomePageContentLoaded(true);
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };
    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  const features = useMemo(
    () => [
      {
        icon: '/assets/icons/cards/speed.svg',
        title: t('高速 & 稳定'),
        desc: t('Cloudflare Enterprise 全球加速，无论你在哪里，都能得到快速且稳定的响应。'),
      },
      {
        icon: '/assets/icons/cards/security.svg',
        title: t('安全'),
        desc: t('严格保护信息和交互数据，仅转发数据不保存数据，数据传输全程加密，同时受业界领先安全解决方案保护，保障服务安全性。'),
      },
      {
        icon: '/assets/icons/cards/price.svg',
        title: t('优惠价格'),
        desc: t('价格远低于官方，请详见文档。*企业专享商业定价和专用服务器!以极低的成本使用最新的AI科技，创造价值、提高生产力。'),
      },
      {
        icon: '/assets/icons/cards/compatible.svg',
        title: t('全面兼容'),
        desc: t('支持OpenAI/Claude/Gemini全模型和大量AI应用及框架，无论开发AI产品、训练自有模型，都能为您提供全面的支持。'),
      },
      {
        icon: '/assets/icons/cards/quantity.svg',
        title: t('按量付费'),
        desc: t('即刻注册，畅享免费测试额度！无需为各种风控问题而烦恼，按量付费，再无费用焦虑，充值更便捷，余额、用量实时掌握。'),
      },
      {
        icon: '/assets/icons/cards/customer_service.svg',
        title: t('专业服务'),
        desc: t('售前客服与售后服务兼顾，提供简洁明了的界面和易于操作的流程，无论开发者还是非技术人员，都能轻松使用我们的服务。'),
      },
    ],
    [t],
  );

  const faqs = useMemo(
    () => [
      {
        q: t('我该如何使用?'),
        a: t('你只需替换你使用应用程序/项目中的API地址和KEY即可。如果你有任何问题，请随时联系我们。'),
      },
      {
        q: t('我的信息会被泄漏吗?'),
        a: t('不会，我们的接口只负责转发请求，不会存储任何用户信息。'),
      },
      {
        q: t('连接你们的API失败或者中断怎么办?'),
        a: t('api访问不稳定的因素很多：1、部分用户受dns污染、公司环境、网络运营商、教育网环境等影响会造成访问API不稳定。2、区域限制，部分地区可能会屏蔽海外未备案网站，被列为不受信任的站点。3、使用不稳定的网络代理或VPN。若问题持续，可根据我们控制台页面提供的API信息，更换至其他可用的访问地址。也可联系我们的客服。'),
      },
      {
        q: t('你们是怎么计算费用的?'),
        a: t('我们是通过你请求的字符/图片数量来计算费用的，计算规则和各大AI供应商一致。'),
      },
      {
        q: t('可以开发票吗?'),
        a: t('可以，累计支付金额达到1000CNY后，您可以联系我们的客服，支付税点，提供开票信息，我们会为您开具发票。'),
      },
    ],
    [t],
  );

  const serviceCards = useMemo(
    () => [
      {
        icon: '/assets/icons/service/doc.svg',
        title: t('文档'),
        subTitle: t('首次使用时，请确保仔细阅读详细教程'),
        desc: t('首先注册账户，接着进行充值，然后在令牌管理中使用聊天功能或复制API地址及KEY以便使用。'),
        btnText: t('查看教程'),
        link: docsLink || null,
        external: true,
      },
      {
        icon: '/assets/icons/service/price.svg',
        title: t('价格'),
        subTitle: t('按需付费，透明无隐形费用，帮助你控制成本'),
        desc: t('官方、Azure或逆向渠道，总能找到您想要的服务和价格。我们承诺渠道绝不混用，价格透明，并且调整价格时会提前公告。'),
        btnText: t('查看价格'),
        link: '/pricing',
        external: false,
      },
      {
        icon: '/assets/icons/service/model.svg',
        title: t('模型'),
        subTitle: t('文本/图像/音频/视频大模型，为你提供最全面的选择'),
        desc: t('支持OpenAI、Gemini、Claude、智谱等多达几十种模型，支持Midjourney/Suno等服务。'),
        btnText: t('查看所有模型'),
        link: '/pricing',
        external: false,
      },
    ],
    [docsLink, t],
  );

  const supportAction = docsLink
    ? {
        label: t('查看文档'),
        desc: t('你可以先查阅接入文档与使用说明，快速解决大多数常见问题。'),
        link: docsLink,
        external: true,
      }
    : {
        label: t('了解更多'),
        desc: t('你可以查看平台介绍与使用说明，了解更多服务能力与接入方式。'),
        link: '/about',
        external: false,
      };

  const providerKeys = useMemo(
    () => ['openai', 'claude', 'bard', 'mistral', 'qwen', 'stability-ai', 'suno'],
    [],
  );

  const heroContainerStyle = {
    transform: `translate3d(0, ${-heroLift}px, 0) scale(${heroScale})`,
    opacity: heroOpacity,
    transition: 'transform 120ms linear, opacity 120ms linear',
  };

  return (
    <div className='uni-homepage' style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .uni-homepage * {
          box-sizing: border-box;
        }

        .uni-homepage a {
          text-decoration: none;
        }

        .uni-homepage button {
          font-family: inherit;
        }

        .uni-home-gradient-text {
          background-image: linear-gradient(300deg, var(--semi-color-primary) 0%, var(--semi-color-warning) 25%, var(--semi-color-primary) 50%, var(--semi-color-warning) 75%, var(--semi-color-primary) 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: uni-home-gradient 14s linear infinite;
        }

        .uni-home-watermark {
          animation: uni-home-marquee 64s linear infinite;
        }

        .uni-home-float-dot {
          animation: uni-home-float-y 7.5s ease-in-out infinite;
        }

        .uni-home-float-dot:nth-child(2n) {
          animation-duration: 9s;
        }

        .uni-home-provider-icon {
          transition: transform 260ms ${easing}, opacity 260ms ${easing}, filter 260ms ${easing};
          animation: uni-home-provider-breathe 4.2s ease-in-out infinite;
        }

        .uni-home-provider-icon:hover {
          transform: translate3d(0, -4px, 0) scale(1.08);
          filter: saturate(1.1);
        }

        .uni-home-hover-card {
          transition: transform 280ms ${easing}, box-shadow 280ms ${easing}, border-color 280ms ${easing}, background 280ms ${easing};
        }

        .uni-home-hover-card:hover {
          transform: translate3d(0, -10px, 0);
          border-color: rgba(99, 102, 241, 0.18);
          box-shadow: 0 30px 70px rgba(15, 23, 42, 0.10);
        }

        .uni-home-hover-button:hover,
        .uni-home-faq-item:hover {
          transform: translate3d(0, -2px, 0);
        }

        .uni-home-rocket {
          animation: uni-home-rocket-float 6.8s ease-in-out infinite;
          transform-origin: center center;
        }

        .uni-home-grid-mask {
          will-change: transform, opacity;
        }

        .uni-home-glow {
          animation: uni-home-pulse 7s ease-in-out infinite;
        }

        @keyframes uni-home-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes uni-home-marquee {
          0% { transform: translate3d(0%, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes uni-home-float-y {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -14px, 0); }
        }

        @keyframes uni-home-provider-breathe {
          0%, 100% { opacity: 0.82; transform: translate3d(0, 0, 0); }
          50% { opacity: 1; transform: translate3d(0, -2px, 0); }
        }

        @keyframes uni-home-rocket-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50% { transform: translate3d(0, -14px, 0) rotate(-2deg); }
        }

        @keyframes uni-home-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }

        @media (prefers-reduced-motion: reduce) {
          .uni-homepage *,
          .uni-home-gradient-text,
          .uni-home-watermark,
          .uni-home-float-dot,
          .uni-home-provider-icon,
          .uni-home-rocket,
          .uni-home-glow {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0ms !important;
          }
        }
      `}</style>

      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      {homePageContentLoaded && homePageContent === '' ? (
        <div
          style={{
            width: '100%',
            overflowX: 'hidden',
            background: 'var(--semi-color-bg-0)',
            position: 'relative',
          }}
        >

          <section
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'hidden',
              minHeight: isMobile ? 'auto' : '100vh',
              paddingBottom: isMobile ? 20 : 0,
            }}
          >
            <div
              className='uni-home-grid-mask'
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                backgroundImage:
                  'linear-gradient(var(--semi-color-border) 1px, transparent 1px), linear-gradient(90deg, var(--semi-color-border) 1px, transparent 1px)',
                backgroundSize: '80px 80px',
                maskImage:
                  'radial-gradient(ellipse 52% 38% at 50% 50%, white 0%, transparent 100%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 52% 38% at 50% 50%, white 0%, transparent 100%)',
                opacity: 0.3,
                transform: `translate3d(0, ${heroGridShift}px, 0)`,
                transition: 'transform 120ms linear',
              }}
            />

            <div
              className='uni-home-glow'
              style={{
                position: 'absolute',
                left: '50%',
                top: isMobile ? 140 : 180,
                width: isMobile ? 300 : 560,
                height: isMobile ? 300 : 560,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(139, 92, 246, 0.14) 42%, rgba(255,255,255,0) 76%)',
                filter: 'blur(40px)',
                transform: `translate3d(-50%, ${heroGlowShift}px, 0)`,
                transition: 'transform 120ms linear',
                zIndex: 0,
              }}
            />

            {!isMobile && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 200,
                  overflow: 'hidden',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              >
                <svg width='110%' height='100%' style={{ overflow: 'visible' }}>
                  <text
                    className='uni-home-watermark'
                    x='0'
                    y='12'
                    dominantBaseline='hanging'
                    style={{
                      fill: 'none',
                      fontSize: 200,
                      fontWeight: 800,
                      strokeDasharray: 4,
                      textTransform: 'uppercase',
                      stroke: 'var(--semi-color-border)',
                      strokeWidth: 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {Array(10).fill('OneDayAI').join(' ')}
                  </text>
                </svg>
              </div>
            )}

            <div
              className='uni-home-float-dot'
              style={{
                position: 'absolute',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--semi-color-danger)',
                top: 'calc(50% - 259px)',
                left: 'calc(50% - 457px)',
                opacity: 0.6,
                transform: `translate3d(0, ${heroGridShift * 0.7}px, 0)`,
              }}
            />
            <div
              className='uni-home-float-dot'
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--semi-color-warning)',
                top: 'calc(50% + 37px)',
                left: 'calc(50% - 356px)',
                opacity: 0.6,
                transform: `translate3d(0, ${heroGridShift * 0.45}px, 0)`,
              }}
            />
            <div
              className='uni-home-float-dot'
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--semi-color-primary)',
                top: 'calc(50% + 135px)',
                left: 'calc(50% + 332px)',
                opacity: 0.6,
                transform: `translate3d(0, ${heroGridShift * -0.5}px, 0)`,
              }}
            />
            <div
              className='uni-home-float-dot'
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--semi-color-tertiary)',
                top: 'calc(50% - 160px)',
                left: 'calc(50% + 430px)',
                opacity: 0.6,
                transform: `translate3d(0, ${heroGridShift * -0.7}px, 0)`,
              }}
            />
            <div
              className='uni-home-float-dot'
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--semi-color-success)',
                top: 'calc(50% + 332px)',
                left: 'calc(50% + 136px)',
                opacity: 0.6,
                transform: `translate3d(0, ${heroGridShift * -0.3}px, 0)`,
              }}
            />

            <div
              style={{
                maxWidth: 680,
                margin: '0 auto',
                padding: isMobile ? '132px 24px 84px' : '176px 24px 112px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 9,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                ...heroContainerStyle,
              }}
            >
              <Reveal delay={40}>
                <h2
                  style={{
                    margin: 0,
                    maxWidth: 680,
                    fontWeight: 700,
                    fontSize: isMobile ? 30 : 70,
                    lineHeight: isMobile ? 1.26 : '90px',
                  }}
                >
                  {t('高效且稳定地')}
                  <br />
                  {t('访问所有AI模型')}
                </h2>
              </Reveal>

              <Reveal delay={120}>
                <h1
                  className='uni-home-gradient-text'
                  style={{
                    padding: 0,
                    marginTop: 8,
                    marginBottom: 24,
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: isMobile ? 5 : 8,
                    fontSize: isMobile ? 64 : 96,
                    display: 'block',
                    width: '100%',
                  }}
                >
                  OneDayAI
                </h1>
              </Reveal>

              <Reveal delay={180}>
                <p
                  style={{
                    color: 'var(--semi-color-text-1)',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    maxWidth: 640,
                    fontSize: isMobile ? 14 : 16,
                    lineHeight: '28px',
                  }}
                >
                  {t('高性价比的Enterprise企业级API转发服务，AI模型All In One！')}
                  {'\n'}
                  {t('完全兼容各平台接口协议，零开发基础无缝对接各种应用。')}
                  {'\n'}
                  {t('无忧风控问题、卓越性能保障、资源高效整合，为您提供专业的技术保障!')}
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                    marginTop: 32,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <Link
                      to={primaryEntryPath}
                      className='uni-home-hover-button'
                      style={btnContained}
                    >
                      <IconBolt style={{ fontSize: 18 }} />
                      {t('立即开始')}
                    </Link>
                    {docsLink && (
                      <button
                        type='button'
                        className='uni-home-hover-button'
                        style={btnOutlined}
                        onClick={() => window.open(docsLink, '_blank', 'noopener,noreferrer')}
                      >
                        <IconExternalOpen style={{ fontSize: 16 }} />
                        {t('查看文档')}
                      </button>
                    )}
                  </div>
                  <Text
                    style={{
                      fontSize: 13,
                      marginTop: 8,
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: 'rgba(var(--semi-amber-4), 0.18)',
                      color: 'var(--semi-color-warning)',
                      fontWeight: 500,
                    }}
                  >
                    {t('注册可领取 $1 体验金')}
                  </Text>
                </div>
              </Reveal>

              <Reveal delay={300}>
                <div
                  style={{
                    marginTop: 40,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                  }}
                >
                  <Text
                    type='tertiary'
                    style={{
                      fontSize: 12,
                      opacity: 0.4,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {t('支持以下供应商 (更多供应商登录查看)')}
                  </Text>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 20,
                    }}
                  >
                    {providerKeys.map((name, index) => (
                      <img
                        key={name}
                        className='uni-home-provider-icon'
                        alt={name}
                        src={`/assets/icons/ai/${name}.svg`}
                        style={{
                          width: 24,
                          height: 24,
                          animationDelay: `${index * 120}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section style={{ background: 'var(--semi-color-bg-0)' }}>
            <div
              style={{
                maxWidth: 1152,
                margin: '0 auto',
                padding: isMobile ? '80px 24px' : '120px 24px',
              }}
            >
              <Reveal>
                <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 80 }}>
                  <h2 style={{ fontSize: isMobile ? 30 : 48, fontWeight: 700, margin: 0 }}>
                    {t('为您的应用赋能')}
                    <span
                      className='uni-home-gradient-text'
                      style={{ WebkitTextFillColor: 'transparent' }}
                    >
                      {t('AI智能化')}
                    </span>
                    {t('服务')}
                  </h2>
                </div>
              </Reveal>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: isMobile ? 16 : 24,
                }}
              >
                {features.map((feature, index) => (
                  <Reveal key={feature.title} delay={index * 70} distance={34} style={{ height: '100%' }}>
                    <div
                      className='uni-home-hover-card'
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: isMobile ? '32px 20px' : '40px 28px',
                        background: 'var(--semi-color-bg-1)',
                        borderRadius: 16,
                        border: '1px solid var(--semi-color-border)',
                        height: '100%',
                      }}
                    >
                      <img
                        src={feature.icon}
                        alt={feature.title}
                        style={{ width: 48, height: 48 }}
                      />
                      <Title heading={5} style={{ marginTop: 24, marginBottom: 12 }}>
                        {feature.title}
                      </Title>
                      <Paragraph
                        type='secondary'
                        style={{ fontSize: 14, lineHeight: '24px', margin: 0 }}
                      >
                        {feature.desc}
                      </Paragraph>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section style={{ paddingTop: 80, position: 'relative' }}>
            {!isMobile && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: 64,
                    bottom: 64,
                    left: 80,
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 32,
                    transform: 'translateX(-7px)',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.12,
                    }}
                  />
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.24,
                    }}
                  />
                  <div style={{ flexGrow: 1 }} />
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.24,
                    }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.12,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 80,
                    width: 1,
                    height: '100%',
                    background: 'var(--semi-color-border)',
                    opacity: 0.5,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
            <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: 'center',
                  gap: isMobile ? 40 : 64,
                }}
              >
                <Reveal
                  style={{
                    flex: isMobile ? 'none' : '0 0 41.67%',
                    width: isMobile ? '100%' : 'auto',
                    textAlign: isMobile ? 'center' : 'left',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      display: 'block',
                      color: 'var(--semi-color-text-3)',
                      marginBottom: 12,
                    }}
                  >
                    {t('AI服务集成')}
                  </Text>
                  <h2 style={{ fontSize: isMobile ? 30 : 48, fontWeight: 700, margin: 0 }}>
                    <span>{t('你想要的都在这里')}</span>{' '}
                    <span
                      style={{
                        opacity: 0.4,
                        display: 'inline-block',
                        background:
                          'linear-gradient(to right, var(--semi-color-text-0), transparent)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      ALL IN ONE
                    </span>
                  </h2>
                  <div style={{ marginTop: 24 }}>
                    <Paragraph
                      type='secondary'
                      style={{ fontSize: 14, lineHeight: '24px', marginBottom: 8 }}
                    >
                      {t('一个接口，即可使用OpenAI、Claude、Gemini、LLaMA 3、Stable Diffusion、Midjourney、Suno 等 100+ AI模型。')}
                    </Paragraph>
                    <Text type='tertiary' style={{ fontSize: 12, fontStyle: 'italic' }}>
                      {t('* 不同模型可能调用方法不一样，具体请参考文档。')}
                    </Text>
                  </div>
                </Reveal>

                <Reveal
                  delay={120}
                  style={{
                    flex: 1,
                    textAlign: isMobile ? 'center' : 'right',
                    transform: `translate3d(0, ${-integrationShift}px, 0)`,
                    opacity: 1,
                  }}
                >
                  <img
                    alt='Integration'
                    src='/assets/illustrations/illustration-integration.webp'
                    style={{
                      width: '100%',
                      maxWidth: 720,
                      objectFit: 'cover',
                      aspectRatio: '1/1',
                    }}
                  />
                </Reveal>
              </div>
            </div>
          </section>

          <section style={{ paddingTop: 80, paddingBottom: 80, position: 'relative' }}>
            {!isMobile && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 80,
                  width: 1,
                  height: '100%',
                  background: 'var(--semi-color-border)',
                  opacity: 0.24,
                  pointerEvents: 'none',
                }}
              />
            )}
            <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
              <Reveal>
                <div style={{ textAlign: 'center', marginBottom: 64 }}>
                  <h2
                    style={{
                      fontSize: isMobile ? 30 : 48,
                      fontWeight: 700,
                      margin: 0,
                      marginBottom: 24,
                    }}
                  >
                    <span>
                      {t('完善的')}{' '}
                    </span>
                    <span
                      style={{
                        opacity: 0.4,
                        display: 'inline',
                        background:
                          'linear-gradient(to right, var(--semi-color-text-0), transparent)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {t('服务体系')}
                    </span>
                  </h2>
                  <Paragraph
                    type='secondary'
                    style={{ fontSize: 14, maxWidth: 672, margin: '0 auto' }}
                  >
                    {t('将复杂的模型集成工作交给我们，您只需注册账号、进行充值，并绑定应用即可轻松使用。')}
                  </Paragraph>
                </div>
              </Reveal>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: isMobile ? 24 : 24,
                  position: 'relative',
                  zIndex: 9,
                }}
              >
                {serviceCards.map((card, index) => (
                  <Reveal key={card.title} delay={index * 90} distance={30} style={{ height: '100%' }}>
                    <div
                      className='uni-home-hover-card'
                      style={{
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--semi-color-bg-1)',
                        border: '1px solid var(--semi-color-border)',
                        borderRadius: 16,
                        height: '100%',
                      }}
                    >
                      <div
                        style={{
                          padding: 24,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 16,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                          }}
                        >
                          <img
                            src={card.icon}
                            alt={card.title}
                            style={{ width: 48, height: 48, flexShrink: 0 }}
                          />
                          <div
                            style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
                          >
                            <Text strong style={{ fontSize: 16 }}>
                              {card.title}
                            </Text>
                            <Text
                              type='tertiary'
                              style={{ fontSize: 12, marginTop: 4 }}
                            >
                              {card.subTitle}
                            </Text>
                          </div>
                        </div>
                        <Paragraph
                          type='secondary'
                          style={{
                            fontSize: 14,
                            lineHeight: '24px',
                            margin: 0,
                            flex: 1,
                          }}
                        >
                          {card.desc}
                        </Paragraph>
                      </div>
                      <div
                        style={{
                          borderTop: '1px dashed var(--semi-color-border)',
                          padding: '16px 24px',
                          display: 'flex',
                          gap: 16,
                        }}
                      >
                        {card.external ? (
                          card.link ? (
                            <button
                              type='button'
                              className='uni-home-hover-button'
                              style={{
                                ...btnContained,
                                width: '100%',
                                height: 44,
                                borderRadius: 8,
                                fontSize: 14,
                                background: 'var(--semi-color-text-0)',
                                color: 'var(--semi-color-bg-0)',
                                boxShadow: 'none',
                              }}
                              onClick={() =>
                                window.open(card.link, '_blank', 'noopener,noreferrer')
                              }
                            >
                              {card.btnText}
                            </button>
                          ) : (
                            <button
                              type='button'
                              style={{
                                ...btnContained,
                                width: '100%',
                                height: 44,
                                borderRadius: 8,
                                fontSize: 14,
                                opacity: 0.5,
                                cursor: 'not-allowed',
                              }}
                              disabled
                            >
                              {card.btnText}
                            </button>
                          )
                        ) : (
                          <Link
                            to={card.link}
                            className='uni-home-hover-button'
                            style={{
                              ...btnContained,
                              width: '100%',
                              height: 44,
                              borderRadius: 8,
                              fontSize: 14,
                              background: 'var(--semi-color-text-0)',
                              color: 'var(--semi-color-bg-0)',
                              boxShadow: 'none',
                            }}
                          >
                            {card.btnText}
                          </Link>
                        )}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section style={{ paddingTop: 64, paddingBottom: 48, position: 'relative' }}>
            {!isMobile && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: 56,
                    left: 80,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    transform: 'translateX(-12px)',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 8,
                      background: 'var(--semi-color-text-0)',
                      opacity: 0.10,
                      clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    }}
                  />
                  <div
                    style={{
                      width: 24,
                      height: 12,
                      background: 'var(--semi-color-text-0)',
                      opacity: 0.20,
                      clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 80,
                    width: 1,
                    height: '100%',
                    background: 'var(--semi-color-border)',
                    opacity: 0.20,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
            <div
              style={{
                maxWidth: 720,
                margin: '0 auto',
                padding: '0 16px',
                position: 'relative',
              }}
            >
              <Reveal>
                <div style={{ textAlign: 'center' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      display: 'block',
                      color: 'var(--semi-color-text-3)',
                      marginBottom: 8,
                    }}
                  >
                    FAQs
                  </Text>
                  <h2 style={{ fontSize: isMobile ? 30 : 36, fontWeight: 700, margin: 0 }}>
                    {t('常见问题')}
                  </h2>
                </div>
              </Reveal>

              <Reveal delay={60}>
                <div
                  style={{
                    marginTop: isMobile ? 48 : 56,
                    marginBottom: isMobile ? 32 : 48,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {faqs.map((faq, index) => (
                    <FaqItem
                      key={faq.q}
                      question={faq.q}
                      answer={faq.a}
                      isOpen={openFaq === index}
                      onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    />
                  ))}
                </div>
              </Reveal>

              <Reveal delay={120}>
                <div
                  style={{
                    position: 'relative',
                    marginTop: isMobile ? 0 : 4,
                  }}
                >
                  {!isMobile && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: 1,
                          background: 'var(--semi-color-border)',
                          opacity: 0.20,
                          pointerEvents: 'none',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%',
                          height: 1,
                          background: 'var(--semi-color-border)',
                          opacity: 0.20,
                          pointerEvents: 'none',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: -6,
                          left: 74,
                          width: 12,
                          height: 12,
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            width: 1,
                            height: '100%',
                            transform: 'translateX(-50%)',
                            background: 'currentColor',
                            color: 'var(--semi-color-text-0)',
                            opacity: 0.20,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            width: '100%',
                            height: 1,
                            transform: 'translateY(-50%)',
                            background: 'currentColor',
                            color: 'var(--semi-color-text-0)',
                            opacity: 0.20,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: -6,
                          left: 74,
                          width: 12,
                          height: 12,
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            width: 1,
                            height: '100%',
                            transform: 'translateX(-50%)',
                            background: 'currentColor',
                            color: 'var(--semi-color-text-0)',
                            opacity: 0.20,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            width: '100%',
                            height: 1,
                            transform: 'translateY(-50%)',
                            background: 'currentColor',
                            color: 'var(--semi-color-text-0)',
                            opacity: 0.20,
                          }}
                        />
                      </div>
                    </>
                  )}
                  <div
                    style={{
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: isMobile ? '48px 20px' : '56px 24px',
                      background:
                        'linear-gradient(270deg, rgba(145, 158, 171, 0.06), rgba(145, 158, 171, 0))',
                    }}
                  >
                    <Title heading={4} style={{ margin: 0 }}>
                      {t('还有更多疑问?')}
                    </Title>
                    <Paragraph
                      type='secondary'
                      style={{
                        fontSize: 14,
                        lineHeight: '24px',
                        marginTop: 16,
                        marginBottom: 24,
                        maxWidth: 420,
                      }}
                    >
                      {supportAction.desc}
                    </Paragraph>
                    {supportAction.external ? (
                      <button
                        type='button'
                        className='uni-home-hover-button'
                        style={btnContained}
                        onClick={() =>
                          window.open(supportAction.link, '_blank', 'noopener,noreferrer')
                        }
                      >
                        {supportAction.label}
                      </button>
                    ) : (
                      <Link
                        to={supportAction.link}
                        className='uni-home-hover-button'
                        style={btnContained}
                      >
                        {supportAction.label}
                      </Link>
                    )}
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section
            style={{
              position: 'relative',
              paddingTop: isMobile ? 8 : 32,
              paddingBottom: 80,
            }}
          >
            {!isMobile && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: 73,
                    top: '50%',
                    width: 14,
                    height: 14,
                    marginTop: -7,
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      width: 1,
                      height: '100%',
                      transform: 'translateX(-50%)',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.28,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      width: '100%',
                      height: 1,
                      transform: 'translateY(-50%)',
                      background: 'currentColor',
                      color: 'var(--semi-color-text-0)',
                      opacity: 0.28,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 80,
                    width: 1,
                    height: 'calc(50% + 48px)',
                    background:
                      'repeating-linear-gradient(to bottom, var(--semi-color-text-2) 0 3px, transparent 3px 7px)',
                    opacity: 0.20,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: 80,
                    height: 1,
                    background:
                      'repeating-linear-gradient(to right, var(--semi-color-text-2) 0 3px, transparent 3px 7px)',
                    opacity: 0.20,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
            <div
              style={{
                maxWidth: 1152,
                margin: '0 auto',
                padding: '0 24px',
                position: 'relative',
                zIndex: 9,
              }}
            >
              <Reveal>
                <div
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'linear-gradient(180deg, #1a2029 0%, #131820 100%)',
                    border: '1px solid rgba(145, 158, 171, 0.12)',
                    borderRadius: 20,
                    padding: isMobile ? '44px 20px' : '56px 36px',
                    textAlign: isMobile ? 'center' : 'left',
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 8,
                      opacity: 0.08,
                      color: 'rgba(145, 158, 171, 0.5)',
                      maskImage: 'url(/assets/background/shape-grid.svg)',
                      WebkitMaskImage: 'url(/assets/background/shape-grid.svg)',
                      maskSize: 'auto 100%',
                      WebkitMaskSize: 'auto 100%',
                      background: 'currentColor',
                    }}
                  />
                  <div
                    className='uni-home-glow'
                    style={{
                      position: 'absolute',
                      top: -40,
                      right: -40,
                      width: isMobile ? 140 : 180,
                      height: isMobile ? 140 : 180,
                      zIndex: 7,
                      background: 'rgba(145, 158, 171, 0.28)',
                      filter: 'blur(120px)',
                    }}
                  />

                  <div
                    style={{
                      position: 'relative',
                      zIndex: 9,
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'center',
                      gap: isMobile ? 28 : 32,
                    }}
                  >
                    {!isMobile && (
                      <div
                        className='uni-home-rocket'
                        style={{
                          flexShrink: 0,
                          flexBasis: 280,
                          width: 280,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 9,
                          transform: `translate3d(0, ${-ctaRocketShift}px, 0)`,
                        }}
                      >
                        <img
                          alt='rocket'
                          src='/assets/illustrations/illustration-rocket-large.svg'
                          style={{ width: 260, maxWidth: '100%', aspectRatio: '1/1' }}
                        />
                      </div>
                    )}

                    <div style={{ flex: 1, zIndex: 9, maxWidth: isMobile ? '100%' : 520 }}>
                      <h2
                        style={{
                          margin: 0,
                          color: '#fff',
                          fontSize: isMobile ? 28 : 40,
                          fontWeight: 700,
                          lineHeight: isMobile ? 1.25 : 1.2,
                          maxWidth: isMobile ? '100%' : 480,
                        }}
                      >
                        {t('准备好了吗？')}
                        <br />
                        {t('即刻开始')}
                        <span
                          style={{
                            background:
                              'linear-gradient(to right, #ffffff, rgba(255,255,255,0.36))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginLeft: 6,
                          }}
                        >
                          {t('体验')}
                        </span>
                      </h2>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginTop: isMobile ? 28 : 32,
                          justifyContent: isMobile ? 'center' : 'flex-start',
                        }}
                      >
                        <Link
                          to={primaryEntryPath}
                          className='uni-home-hover-button'
                          style={btnPrimary}
                        >
                          {t('立即试用')}
                        </Link>
                        {docsLink && (
                          <button
                            type='button'
                            className='uni-home-hover-button'
                            style={btnWhiteOutline}
                            onClick={() =>
                              window.open(docsLink, '_blank', 'noopener,noreferrer')
                            }
                          >
                            {t('查看文档')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        </div>
      ) : (
        <div style={{ overflow: 'hidden', width: '100%' }}>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              style={{ width: '100%', height: '100vh', border: 'none' }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: homePageContent }} />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
