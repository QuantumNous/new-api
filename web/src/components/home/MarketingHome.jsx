import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  FileText,
  Layers3,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { OpenAI, Claude, Gemini } from '../../helpers/lobeIcons';

const ScrollReveal = ({
  as = 'div',
  children,
  className = '',
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);
  const Component = as;

  useEffect(() => {
    const element = elementRef.current;

    if (!element || isVisible || typeof window === 'undefined') {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          window.requestAnimationFrame(() => {
            setIsVisible(true);
          });
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -10% 0px',
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  const revealClassName = [
    'marketing-home__reveal',
    isVisible ? 'marketing-home__reveal--visible' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      ref={elementRef}
      className={revealClassName}
      style={{ '--marketing-home-reveal-delay': `${delay}ms` }}
    >
      {children}
    </Component>
  );
};

const MarketingHome = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const version = statusState?.status?.version;

  const primaryActionTo = userState?.user
    ? '/console'
    : isSelfUseMode
      ? '/login'
      : '/register';
  const primaryActionLabel = userState?.user
    ? t('进入控制台')
    : isSelfUseMode
      ? t('登录')
      : t('免费使用');
  const plansActionTo = userState?.user ? '/console/topup' : '/login';

  const heroMetrics = useMemo(
    () => [
      { value: t('门槛更低'), label: t('国内直充') },
      { value: t('性能更优'), label: t('专项优化') },
      { value: t('管理更简单'), label: t('统一账单') },
    ],
    [t],
  );

  const providerItems = useMemo(
    () => [
      { name: 'Claude Code', icon: <Claude.Color size={32} /> },
      { name: 'Codex', icon: <OpenAI size={32} /> },
      // { name: 'Gemini CLI', icon: <Gemini.Color size={32} /> },
      // { name: 'OpenClaw', icon: <TerminalSquare size={20} /> },
    ],
    [],
  );

  const deploymentActions = useMemo(
    () => [
      {
        label: 'macOS',
        to: '/console/install/claude-code/macos-linux',
        icon: '/home/macos.svg',
      },
      {
        label: 'Windows',
        to: '/console/install/claude-code/windows',
        icon: '/home/Windows.svg',
      },
      {
        label: 'Linux',
        to: '/console/install/claude-code/macos-linux',
        icon: '/home/linux.svg',
      },
    ],
    [],
  );

  const valueCards = useMemo(
    () => [
      {
        icon: <ShieldCheck size={28} />,
        title: t('稳定可靠'),
        description: t(
          '多网络节点和容灾备份，确保服务流畅可用。技术专家贴身支持，使用无忧',
        ),
      },
      {
        icon: <Layers3 size={28} />,
        title: t('产品多元'),
        description: t(
          '包月订阅和按量付费两种模式，定价透明，适用于不同规模的开发团队',
        ),
      },
      {
        icon: <FileText size={28} />,
        title: t('报销合规'),
        description: t(
          '丰富的企业/高校合作经验，快速开具发票/合同/采购单，解决采购报销难题',
        ),
      },
    ],
    [t],
  );

  const capabilityLayers = useMemo(
    () => [
      {
        eyebrow: t('轻便&快速'),
        title: t('Haiku 俳句'),
        description: t(
          '我们最快的模型，可以执行轻量级动作，速度业界领先。',
        ),
        toneClassName: 'marketing-architecture-card--left',
      },
      {
        eyebrow: t('努力工作'),
        title: t('Sonnet 十四行诗'),
        description: t(
          '我们将性能和速度的最佳组合，用于高效、高吞吐量的任务。',
        ),
        toneClassName: 'marketing-architecture-card--center',
      },
      {
        eyebrow: t('强大'),
        title: t('Opus 作品'),
        description: t(
          '我们性能最高的模型，可以处理复杂的分析、包含许多步骤的较长任务以及更高阶的数学和编码任务。',
        ),
        toneClassName: 'marketing-architecture-card--right',
      },
    ],
    [t],
  );

  const integrationPoints = useMemo(
    () => [
      {
        icon: <Workflow size={18} />,
        text: t(
          '查看整个代码库，而不仅仅是孤立的代码片段。',
        ),
      },
      {
        icon: <TerminalSquare size={18} />,
        text: t(
          '理解项目结构和现有模式，提出真正适合的建议。',
        ),
      },
      {
        icon: <BadgeCheck size={18} />,
        text: t(
          '无需复制粘贴，建议可以直接落到代码文件和工作流里。',
        ),
      },
    ],
    [t],
  );

  const trustItems = useMemo(
    () => [
      { name: t('阿里巴巴') },
      { name: t('支付宝') },
      { name: t('安利') },
    ],
    [t],
  );

  const heroPreviewLines = useMemo(
    () => [
      t('分析这个仓库并总结首页结构'),
      t('实现订阅计划卡片并保持响应式'),
      t('对齐 Hero、Footer 与文案层级'),
    ],
    [t],
  );

  const pricingPlans = useMemo(
    () => [
      {
        name: 'PAYGO',
        price: t('按量付费'),
        subtitle: t('永不过期'),
        buttonLabel: t('立即充值'),
        toneClassName: 'marketing-pricing-card--default',
        buttonClassName: 'marketing-pricing-card__button--default',
        features: [
          {
            prefix: t('充值金额，获得'),
            accent: t('等价人民币'),
            suffix: t('额度'),
          },
          { prefix: t('按实际使用付费') },
          { prefix: t('标准价格') },
          { prefix: t('永不过期'), accentOnly: true },
        ],
      },
      {
        name: 'PRO',
        price: '¥259',
        buttonLabel: t('选择 PRO'),
        toneClassName: 'marketing-pricing-card--pro',
        buttonClassName: 'marketing-pricing-card__button--outline',
        features: [
          { prefix: t('立即获得'), accent: '￥305.00', suffix: t('额度') },
          { prefix: t('折合'), accent: t('8.5折'), suffix: t('优惠') },
          { prefix: t('额度有效期30天') },
          { prefix: t('基本速率支持') },
        ],
      },
      {
        name: 'MAX',
        price: '¥559',
        badge: t('推荐'),
        buttonLabel: t('选择 MAX'),
        toneClassName: 'marketing-pricing-card--max',
        buttonClassName: 'marketing-pricing-card__button--accent',
        features: [
          { prefix: t('立即获得'), accent: '￥699.00', suffix: t('额度') },
          { prefix: t('折合'), accent: t('8折'), suffix: t('优惠') },
          { prefix: t('额度有效期30天') },
          { prefix: t('高级速率支持') },
        ],
      },
      {
        name: 'ULTRA',
        price: '¥1259',
        badge: t('顶级'),
        buttonLabel: t('选择 ULTRA'),
        toneClassName: 'marketing-pricing-card--ultra',
        buttonClassName: 'marketing-pricing-card__button--orange',
        features: [
          { prefix: t('立即获得'), accent: '￥1,678.00', suffix: t('额度') },
          { prefix: t('折合'), accent: t('7.5折'), suffix: t('优惠') },
          { prefix: t('额度有效期30天') },
          { prefix: t('最高速率支持') },
        ],
      },
    ],
    [t],
  );

  return (
    <div className='marketing-home'>
      <section id='hero' className='marketing-section-shell marketing-hero'>
        <div className='marketing-hero__grid'>
          <div className='marketing-hero__copy'>

            <h1 className='marketing-hero__title'>
              <span className='marketing-hero__headline'>
                {t('企业级')}
                <span className='marketing-hero__ticket'>
                  GPT-5.4
                </span>
              </span>
              <br />
              <span className='marketing-hero__accent'>
                {t('一站式Vibe Coding')}
              </span>
            </h1>

            <p className='marketing-hero__description'>
              {t(
                '无需编程基础，仅依靠自然语言，就能将您的想法变为现实！用最简单的配置即刻使用稳定、安全、优惠的 Claude Code和Codex，体验当前全球最顶级的 AI 编程工具。为企业和开发者提效300%。',
              )}
            </p>

            <div className='marketing-hero__actions'>
              <Link to={primaryActionTo}>
                <Button
                  theme='solid'
                  type='primary'
                  size='large'
                  className='marketing-hero__button marketing-hero__button--primary'
                >
                  {primaryActionLabel}
                </Button>
              </Link>

              <div className='marketing-hero__secondary-cta'>
                <Link to='/docs'>
                  <Button
                    size='large'
                    className='marketing-hero__button marketing-hero__button--outline'
                  >
                    {t('查看使用教程')}
                  </Button>
                </Link>
                <span className='marketing-hero__badge'>
                  <span className='marketing-hero__badge-dot' />
                  {t('领取8元永久额度')}
                </span>
              </div>
            </div>

            <div className='marketing-hero__stats'>
              {heroMetrics.map((metric) => (
                <div key={metric.label} className='marketing-hero-stat'>
                  <h3>{metric.value}</h3>
                  <p>{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='marketing-hero__visual'>
            <div className='marketing-hero-preview'>
              <div className='marketing-hero-preview__toolbar'>
                <div className='marketing-hero-preview__dots'>
                  <span />
                  <span />
                  <span />
                </div>
                <div className='marketing-hero-preview__label'>
                  {version ? `AI Force · ${version}` : 'AI Force · Workspace'}
                </div>
              </div>

              <div className='marketing-hero-preview__body'>
                <div className='marketing-hero-preview__pills'>
                  {providerItems.slice(0, 3).map((provider) => (
                    <span key={provider.name} className='marketing-hero-preview__pill'>
                      {provider.name}
                    </span>
                  ))}
                </div>

                <div className='marketing-hero-preview__prompt'>
                  <div className='marketing-hero-preview__prompt-title'>
                    <Sparkles size={16} />
                    <span>{t('AI 编程工作区')}</span>
                  </div>
                  <p>{t('让想法直接进入代码、评审与交付流程。')}</p>
                </div>

                <div className='marketing-hero-preview__code'>
                  {heroPreviewLines.map((line) => (
                    <div key={line} className='marketing-hero-preview__line'>
                      <span className='marketing-hero-preview__line-mark'>&gt;</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <div className='marketing-hero-preview__footer'>
                  <div className='marketing-hero-preview__status'>
                    <span>{t('上下文')}</span>
                    <strong>{t('完整代码库')}</strong>
                  </div>
                  <div className='marketing-hero-preview__status'>
                    <span>{t('协作')}</span>
                    <strong>{t('IDE / CLI / 评审')}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className='marketing-divider' />

      <section className='marketing-section-shell'>
        <ScrollReveal as='div' className='marketing-platform-card'>
          <div className='marketing-platform-card__copy'>
            <h2>
              {t('一站汇聚全球顶尖模型，解锁AI应用的无限可能，')}
              <span className='marketing-platform-card__headline-accent'>
                {t('让复杂的底层交给我们，把简单的体验留给你')}
              </span>
            </h2>
          </div>

          <div className='marketing-platform-row'>
            <span className='marketing-platform-row__label'>{t('同时支持')}</span>
            <div className='marketing-platform-providers'>
              {providerItems.map((provider) => (
                <div key={provider.name} className='marketing-provider-inline'>
                  <span className='marketing-provider-inline__icon'>
                    {provider.icon}
                  </span>
                  <span>{provider.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='marketing-platform-row marketing-platform-row--stacked'>
            <span className='marketing-platform-row__label'>
              {t('一键轻松在以下平台体验:')}
            </span>
            <div className='marketing-platform-actions'>
              {deploymentActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className='marketing-platform-action'
                >
                  <img
                    src={action.icon}
                    alt=''
                    aria-hidden='true'
                    className='marketing-platform-action__icon'
                  />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <div className='marketing-divider' />

      <section className='marketing-section-shell'>
        <div className='marketing-value-grid'>
          {valueCards.map((item, index) => (
            <ScrollReveal
              key={item.title}
              as='article'
              className='marketing-value-card'
              delay={index * 90}
            >
              <div className='marketing-value-card__icon'>{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <div className='marketing-divider' />

      <section className='marketing-section-shell'>
        <div className='marketing-section-heading marketing-section-heading--centered'>
          <h2>{t('Claude 模型系列')}</h2>
          <p>
            {t(
              'Claude 系列型号的尺寸适合任何任务，提供速度和性能的最佳组合。',
            )}
          </p>
        </div>

        <div className='marketing-architecture-stage'>
          {capabilityLayers.map((layer) => (
            <article
              key={layer.title}
              className={`marketing-architecture-card ${layer.toneClassName}`}
            >
              <span className='marketing-architecture-card__eyebrow'>
                {layer.eyebrow}
              </span>
              <h3>{layer.title}</h3>
              <p>{layer.description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className='marketing-divider' />

      <section className='marketing-section-shell'>
        <div className='marketing-integration-grid'>
          <div className='marketing-workbench'>
            <img
              src='/ide集成.webp'
              alt={t('IDE 集成预览')}
              className='marketing-workbench__image'
              loading='lazy'
            />
          </div>

          <div className='marketing-integration-copy'>
            <div className='marketing-section-heading'>
              <h2>{t('与您的 IDE 协同工作')}</h2>
              <p>
                {t(
                  'Claude 可直接在 VS Code 和 JetBrains 中运行，查看您的整个代码库，而不仅仅是孤立的代码片段。它理解您的项目结构和现有模式，提出真正适合的建议，并直接在您的代码文件中呈现这些建议。无需复制粘贴，只需专注构建。',
                )}
              </p>
            </div>

            <div className='marketing-ide-badges'>
              <div className='marketing-ide-badge'>
                <span className='marketing-ide-badge__logo marketing-ide-badge__logo--vscode'>
                  VS
                </span>
                <span>VS Code</span>
              </div>
              <div className='marketing-ide-badge'>
                <span className='marketing-ide-badge__logo marketing-ide-badge__logo--jetbrains'>
                  JB
                </span>
                <span>JetBrains</span>
              </div>
            </div>

            <div className='marketing-inline-points'>
              {integrationPoints.map((point) => (
                <div key={point.text} className='marketing-inline-point'>
                  {point.icon}
                  <span>{point.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className='marketing-divider' />

      <section id='plans' className='marketing-section-shell marketing-pricing-section'>
        <div className='marketing-section-heading marketing-section-heading--centered'>
          <h2>{t('选择您的订阅计划')}</h2>
        </div>

        <div className='marketing-pricing-grid'>
          {pricingPlans.map((plan, index) => (
            <ScrollReveal
              key={plan.name}
              as='article'
              className={`marketing-pricing-card ${plan.toneClassName}`}
              delay={index * 90}
            >
              {plan.badge ? (
                <div className='marketing-pricing-card__badge'>{plan.badge}</div>
              ) : null}

              <div className='marketing-pricing-card__head'>
                <h3>{plan.name}</h3>
                <div className='marketing-pricing-card__price'>{plan.price}</div>
                {plan.subtitle ? (
                  <p className='marketing-pricing-card__subtitle'>{plan.subtitle}</p>
                ) : null}
              </div>

              <div className='marketing-pricing-card__features'>
                {plan.features.map((feature) => (
                  <div key={`${plan.name}-${feature.prefix}`} className='marketing-pricing-card__feature'>
                    <span className='marketing-pricing-card__feature-mark'>✓</span>
                    <span>
                      {feature.accentOnly ? (
                        <span className='marketing-pricing-card__feature-accent'>
                          {feature.prefix}
                        </span>
                      ) : (
                        <>
                          {feature.prefix}
                          {feature.accent ? (
                            <span className='marketing-pricing-card__feature-accent'>
                              {feature.accent}
                            </span>
                          ) : null}
                          {feature.suffix || ''}
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                to={plansActionTo}
                className={`marketing-pricing-card__button ${plan.buttonClassName}`}
              >
                {plan.buttonLabel}
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <div className='marketing-divider' />

      {/* <section className='marketing-section-shell marketing-trust-section'>
        <div className='marketing-section-heading marketing-section-heading--centered'>
          <h2>{t('受企业工程师信赖')}</h2>
        </div>

        <div className='marketing-trust-grid'>
          {trustItems.map((item) => (
            <div key={item.name} className='marketing-trust-item'>
              <span className='marketing-trust-wordmark'>{item.name}</span>
            </div>
          ))}
        </div>
      </section> */}

      <div className='marketing-divider' />

      <section className='marketing-section-shell marketing-section-shell--compact'>
        <div className='marketing-story-callout'>
          <div className='marketing-story-callout__icon'>
            <BookOpenText size={22} />
          </div>
          <div className='marketing-story-callout__content'>
            <h3 style={{ fontWeight: 'bold' }}>{t('为什么选用AI Force？')}</h3>
            <p>
              {t(
                '不仅仅是聚合，更是加速。选择我们，告别API焦虑。',
              )}
            </p>
            <div className='marketing-story-callout__actions'>
              <Link to='/about' className='marketing-inline-link'>
                <span>{t('查看部署文档')}</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketingHome;
