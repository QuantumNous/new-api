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

import React, { useContext, useEffect, useState } from 'react';
import { Button, Typography, Input } from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconGithubLogo,
  IconPlay,
  IconFile,
  IconCopy,
} from '@douyinfe/semi-icons';
import { Link, useNavigate } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  Activity,
  BookOpen,
  Boxes,
  ClipboardList,
  Gauge,
  KeyRound,
  Network,
  Route,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const { Text } = Typography;

const providerItems = [
  { name: 'OpenAI', Icon: OpenAI },
  { name: 'Claude', Icon: Claude.Color },
  { name: 'Gemini', Icon: Gemini.Color },
  { name: 'xAI', Icon: XAI },
  { name: 'DeepSeek', Icon: DeepSeek.Color },
  { name: 'Qwen', Icon: Qwen.Color },
  { name: 'Moonshot', Icon: Moonshot },
  { name: 'Azure AI', Icon: AzureAI.Color },
  { name: 'Grok', Icon: Grok },
  { name: 'Zhipu', Icon: Zhipu.Color },
  { name: 'Volcengine', Icon: Volcengine.Color },
  { name: 'Cohere', Icon: Cohere.Color },
  { name: 'Suno', Icon: Suno },
  { name: 'Minimax', Icon: Minimax.Color },
  { name: 'Wenxin', Icon: Wenxin.Color },
  { name: 'Spark', Icon: Spark.Color },
  { name: 'Qingyan', Icon: Qingyan.Color },
  { name: 'Midjourney', Icon: Midjourney },
  { name: 'Hunyuan', Icon: Hunyuan.Color },
  { name: 'Xinference', Icon: Xinference.Color },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const normalizedDocsLink = docsLink.trim();
  const useLocalDocs =
    !normalizedDocsLink ||
    normalizedDocsLink.replace(/\/$/, '').startsWith('https://docs.newapi.pro');
  const docLinkTarget = useLocalDocs ? '/docs' : normalizedDocsLink;
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const activeEndpoint =
    endpointItems[endpointIndex]?.value || API_ENDPOINTS[0];
  const valueItems = [
    {
      icon: Route,
      label: t('统一接入'),
      title: t('一个基址接入多家模型'),
      description: t(
        '把 OpenAI、Claude、Gemini、DeepSeek 等上游统一到同一套兼容接口。',
      ),
    },
    {
      icon: Network,
      label: t('稳定路由'),
      title: t('按渠道状态自动调度'),
      description: t(
        '渠道、模型、分组和优先级集中管理，异常时更容易切换和回退。',
      ),
    },
    {
      icon: WalletCards,
      label: t('成本优化'),
      title: t('费用、倍率和额度可追踪'),
      description: t(
        '面向团队的余额、消耗、倍率、订阅和兑换码体系，账务更清楚。',
      ),
    },
    {
      icon: Gauge,
      label: t('运营级控制'),
      title: t('把日志、监控和权限放进同一个后台'),
      description: t(
        '从密钥到请求日志，从渠道到模型部署，日常运营有证据可查。',
      ),
    },
  ];
  const trustItems = [
    {
      icon: Boxes,
      title: t('供应商矩阵'),
      description: t('覆盖 30+ 上游供应商，适合把模型能力统一成团队内部服务。'),
    },
    {
      icon: KeyRound,
      title: t('统一密钥'),
      description: t('用户、令牌、分组和额度统一管理，减少多平台密钥散落。'),
    },
    {
      icon: Activity,
      title: t('请求可观测'),
      description: t(
        '使用日志、绘图日志、任务日志和调试信息都能回到同一条运营线。',
      ),
    },
  ];
  const handleOpenDocs = () => {
    if (docLinkTarget.startsWith('/')) {
      navigate(docLinkTarget);
      return;
    }
    window.open(docLinkTarget, '_blank', 'noopener,noreferrer');
  };

  const roleItems = [
    {
      icon: TerminalSquare,
      title: t('开发者'),
      description: t('复制基址，替换 SDK endpoint，即可把调用迁到统一入口。'),
      action: t('查看接入文档'),
      onClick: handleOpenDocs,
    },
    {
      icon: ClipboardList,
      title: t('运营者'),
      description: t(
        '查看消耗、余额、请求量、渠道健康和用户额度，及时处理异常。',
      ),
      action: t('进入控制台'),
      to: '/console',
    },
    {
      icon: Settings2,
      title: t('团队管理员'),
      description: t('统一维护渠道、模型、倍率、部署、兑换码和系统策略。'),
      action: t('管理系统'),
      to: '/console/setting',
    },
  ];

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      // 如果内容是 URL，则发送主题模式
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
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  const handleEndpointCycle = () => {
    setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='na-public-page'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <main className='na-home'>
          <section className='na-home-hero'>
            <div className='na-home-hero-stage'>
              <div className='na-home-hero-grid'>
                <div className='na-home-copy'>
                  <p className='na-home-kicker'>
                    {t('统一接入')} / {t('稳定路由')} / {t('成本优化')}
                  </p>
                  <h1 className='na-home-title'>
                    <span>MO API</span>
                    <span className='na-home-title-subline'>
                      {t('面向团队的统一 API')}
                    </span>
                  </h1>
                  <p className='na-home-subtitle'>
                    {t(
                      '一个基址，接入多家模型；统一密钥、计费、路由与监控，让团队把 AI 能力当作稳定的基础设施来运营。',
                    )}
                  </p>
                  <div className='na-home-actions'>
                    <Link to='/console'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='na-home-button na-home-button-primary'
                        icon={<IconPlay />}
                      >
                        {t('进入控制台')}
                      </Button>
                    </Link>
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='na-home-button'
                      icon={<IconFile />}
                      onClick={handleOpenDocs}
                    >
                      {t('查看接入文档')}
                    </Button>
                    {isDemoSiteMode && statusState?.status?.version && (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='na-home-button na-home-version-button'
                        icon={<IconGithubLogo />}
                        onClick={() =>
                          window.open(
                            'https://github.com/QuantumNous/new-api',
                            '_blank',
                          )
                        }
                      >
                        {statusState.status.version}
                      </Button>
                    )}
                  </div>
                  <div className='na-home-proof-row' aria-label={t('产品能力')}>
                    <span>{t('OpenAI 兼容')}</span>
                    <span>{t('多模型调度')}</span>
                    <span>{t('账单可追踪')}</span>
                  </div>
                </div>

                <aside className='na-home-access-card'>
                  <div className='na-home-access-card-header'>
                    <div>
                      <p className='na-home-card-eyebrow'>{t('接入卡')}</p>
                      <h2>{t('把模型调用接到统一入口')}</h2>
                    </div>
                    <ShieldCheck className='na-home-card-icon' aria-hidden />
                  </div>
                  <div className='na-home-base-url'>
                    <label className='na-home-field-label'>
                      {t('基础 URL')}
                    </label>
                    <Input
                      readOnly
                      value={serverAddress}
                      className='na-home-input'
                      size={isMobile ? 'default' : 'large'}
                      suffix={
                        <Button
                          type='primary'
                          onClick={handleCopyBaseURL}
                          icon={<IconCopy />}
                          className='na-home-copy-button'
                          aria-label={t('复制基础 URL')}
                        />
                      }
                    />
                  </div>
                  <div className='na-home-endpoint-row'>
                    <Text className='na-home-field-label'>{t('兼容端点')}</Text>
                    <Button
                      theme='borderless'
                      className='na-home-endpoint-button'
                      onClick={handleEndpointCycle}
                    >
                      {activeEndpoint}
                    </Button>
                  </div>
                  <div className='na-home-code-card'>
                    <div className='na-home-code-line'>
                      <span>base_url</span>
                      <strong>{serverAddress}</strong>
                    </div>
                    <div className='na-home-code-line'>
                      <span>endpoint</span>
                      <strong>{activeEndpoint}</strong>
                    </div>
                  </div>
                  <p className='na-home-access-note'>
                    {t('替换 SDK 的 base_url，原有请求结构可以继续沿用。')}
                  </p>
                </aside>
              </div>

              <div className='na-home-value-band'>
                {valueItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article className='na-home-value-item' key={item.title}>
                      <Icon className='na-home-card-icon' aria-hidden />
                      <p>{item.label}</p>
                      <h3>{item.title}</h3>
                      <span>{item.description}</span>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className='na-home-section na-home-trust-section'>
            <div className='na-home-section-copy'>
              <p className='na-home-kicker'>{t('供应商与能力')}</p>
              <h2>{t('不是图标墙，是可运营的模型供应链')}</h2>
              <p>
                {t(
                  'MO API 把上游供应商、密钥、倍率、日志和权限整理进同一套控制面板，适合长期运营而不是临时拼接口。',
                )}
              </p>
            </div>
            <div className='na-provider-matrix'>
              {providerItems.map((provider) => {
                const ProviderIcon = provider.Icon;
                return (
                  <div className='na-provider-icon-wrap' key={provider.name}>
                    <ProviderIcon />
                    <span>{provider.name}</span>
                  </div>
                );
              })}
              <div className='na-provider-icon-wrap na-provider-count'>
                <strong>30+</strong>
                <span>{t('上游供应商')}</span>
              </div>
            </div>
          </section>

          <section className='na-home-section na-home-compare-section'>
            <div className='na-home-section-copy'>
              <p className='na-home-kicker'>{t('为什么需要中转站')}</p>
              <h2>{t('从多处直连，变成一个可管理的入口')}</h2>
            </div>
            <div className='na-home-compare-grid'>
              <div className='na-home-compare-column'>
                <h3>{t('多供应商直连')}</h3>
                <p>{t('密钥分散，费用分散，故障定位依赖人工排查。')}</p>
                <p>{t('每个团队成员都可能保留一份不同的接入配置。')}</p>
              </div>
              <div className='na-home-compare-column na-home-compare-column-strong'>
                <h3>{t('MO API 统一入口')}</h3>
                <p>{t('统一密钥、统一分组、统一倍率和统一日志。')}</p>
                <p>{t('把稳定回退、费用透明和运营控制放到同一处。')}</p>
              </div>
            </div>
          </section>

          <section className='na-home-section na-home-roles-section'>
            <div className='na-home-section-copy'>
              <p className='na-home-kicker'>{t('团队入口')}</p>
              <h2>{t('不同角色进入同一套 AI 基础设施')}</h2>
            </div>
            <div className='na-home-role-grid'>
              {roleItems.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon className='na-home-card-icon' aria-hidden />
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span>{item.action}</span>
                  </>
                );

                return item.to ? (
                  <Link
                    className='na-home-role-card'
                    to={item.to}
                    key={item.title}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type='button'
                    className='na-home-role-card'
                    onClick={item.onClick}
                    key={item.title}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        <div className='na-home-custom-content'>
          {homePageContent.startsWith('https://') ? (
            <iframe src={homePageContent} className='na-home-iframe' />
          ) : (
            <div
              className='na-home-custom-content'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
