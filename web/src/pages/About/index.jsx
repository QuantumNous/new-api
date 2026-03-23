import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileText,
  Layers3,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConsolePageShell from '../../components/layout/ConsolePageShell';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';

const AboutFeatureCard = ({ icon: Icon, title, description, points = [] }) => (
  <article className='marketing-about-card'>
    <div className='marketing-about-card__icon'>
      <Icon size={22} />
    </div>
    <div className='marketing-about-card__content'>
      <h3 className='marketing-about-card__title'>{title}</h3>
      <p className='marketing-about-card__description'>{description}</p>
      {points.length > 0 ? (
        <div className='marketing-about-card__list'>
          {points.map((point) => (
            <div key={point} className='marketing-about-card__list-item'>
              <BadgeCheck size={16} />
              <span>{point}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </article>
);

const About = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
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

  const heroMetrics = useMemo(
    () => [
      {
        value: '40+',
        label: t('上游 AI 提供商能力'),
      },
      {
        value: t('统一'),
        label: t('API / 令牌 / 计费体验'),
      },
      {
        value: t('多角色'),
        label: t('面向开发者、团队与企业'),
      },
    ],
    [t],
  );

  const heroTags = useMemo(
    () => [
      'OpenAI',
      'Claude',
      'Gemini',
      'Azure',
      'Bedrock',
      t('控制台管理'),
    ],
    [t],
  );

  const capabilityCards = useMemo(
    () => [
      {
        icon: Layers3,
        title: t('统一接入多家模型能力'),
        description: t(
          'AI Force 持续围绕真实的接入与交付场景演进，把 OpenAI、Claude、Gemini、Azure、Bedrock 等多家上游能力收拢到一个更统一的入口里，让接入、切换和扩展都更直接。',
        ),
        points: [
          t('减少多平台来回配置的心智负担'),
          t('把模型接入差异收敛在统一工作流里'),
        ],
      },
      {
        icon: Workflow,
        title: t('把管理链路组织成一个工作台'),
        description: t(
          '从用户、令牌、额度到订阅、调用日志和控制台页面，平台更在意的是把日常高频操作放进一套连续的使用链路里，而不是分散在多个零碎入口。',
        ),
        points: [
          t('账户、令牌和配额更容易统一治理'),
          t('日志、用量和配置更容易回看与协作'),
        ],
      },
      {
        icon: ShieldCheck,
        title: t('让实际使用过程更稳定可控'),
        description: t(
          '我们不把“接通一次”当作完成，而是更重视后续能否稳定使用、清楚计费、出现问题时能否快速排查。平台设计尽量围绕真实使用过程，而不是只做表面的接入展示。',
        ),
        points: [
          t('额度、价格和调用链路尽量清晰透明'),
          t('遇到问题时更容易定位和恢复'),
        ],
      },
    ],
    [t],
  );

  const principleCards = useMemo(
    () => [
      {
        title: t('稳定优先'),
        description: t(
          '先把接入、管理、日志和控制台这些基础体验打磨稳定，再继续叠加更复杂的能力。对平台来说，长期可用性比一次性的功能堆叠更重要。',
        ),
      },
      {
        title: t('透明可控'),
        description: t(
          '价格、额度、订阅和关键操作链路尽量保持清晰，让用户知道自己在用什么、花在哪里、该如何管理，而不是把核心信息藏在黑盒后面。',
        ),
      },
      {
        title: t('工程友好'),
        description: t(
          '平台既面向第一次接触 AI 工具的开发者，也面向已经进入团队协作和正式使用阶段的用户，因此会尽量保持统一接口思路和顺手的控制台体验。',
        ),
      },
    ],
    [t],
  );

  const audienceCards = useMemo(
    () => [
      {
        icon: TerminalSquare,
        title: t('个人开发者'),
        description: t(
          '适合希望尽快用上 Claude Code、Codex 和多模型能力的人。你不必把精力浪费在多平台账号、充值和环境差异上，可以更快进入真正的产品和代码工作。',
        ),
        points: [
          t('更低门槛开始使用顶级 AI 编程工具'),
          t('把注意力从配置细节拉回到构建本身'),
        ],
      },
      {
        icon: Users,
        title: t('产品与研发团队'),
        description: t(
          '当团队开始共同使用 AI 时，令牌分发、额度控制、日志回看和账单归因会迅速变成真实问题。AI Force 希望把这些工作变成一个统一且可协作的管理面。',
        ),
        points: [
          t('更适合多人协作和统一成本管理'),
          t('减少工具链分散带来的沟通摩擦'),
        ],
      },
      {
        icon: Building2,
        title: t('企业与高校场景'),
        description: t(
          '对于需要更清晰账务、采购和使用边界的组织，平台更强调透明、规范和可管理性，让从试用到正式使用的过程更平滑，而不是依赖临时拼接的方案。',
        ),
        points: [
          t('更容易衔接采购、报销和正式交付流程'),
          t('让组织内部使用边界与权限更明确'),
        ],
      },
    ],
    [t],
  );

  return (
    <ConsolePageShell className='console-page-shell--public' fullWidth>
      <div className='marketing-about-page'>
        <section className='marketing-section-shell marketing-about-hero'>
          <div className='marketing-about-hero__grid'>
            <div className='marketing-about-hero__copy'>
              <span className='marketing-about-hero__eyebrow'>
                <Sparkles size={16} />
                <span>{t('About AI Force')}</span>
              </span>

              <h1 className='marketing-about-hero__title'>
                {t('让 AI 接入、管理与使用')}
                <span className='marketing-about-hero__title-accent'>
                  {t('真正变成一套顺手的工作流')}
                </span>
              </h1>

              <p className='marketing-about-hero__description'>
                {t(
                  'AI Force 是一站式 AI 接入与管理平台。我们希望把 40+ 上游 AI 提供商、统一 API、用户与令牌管理、额度计费、限流和控制台体验整合到同一个工作台里，帮助个人开发者、团队与企业更稳定地把 AI 用进真实产品。',
                )}
              </p>

              <div className='marketing-about__actions'>
                <Link
                  to={primaryActionTo}
                  className='marketing-about__button marketing-about__button--primary'
                >
                  <span>{primaryActionLabel}</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to='/docs'
                  className='marketing-about__button marketing-about__button--secondary'
                >
                  {t('查看使用教程')}
                </Link>
                <Link
                  to='/pricing'
                  className='marketing-about__button marketing-about__button--pricing'
                >
                  {t('查看价格方案')}
                </Link>
              </div>
            </div>

            <div className='marketing-about-hero__panel'>
              <span className='marketing-about-hero__panel-badge'>
                {t('统一接入 · 工程优先')}
              </span>
              <h2 className='marketing-about-hero__panel-title'>
                {t('我们不想再增加一层复杂度，而是把复杂度收拢起来。')}
              </h2>
              <p className='marketing-about-hero__panel-description'>
                {t(
                  '从模型接入到令牌分发，从使用计费到日志排查，平台更在意的是那些会在日常使用里持续打断注意力的细节。我们希望把这些基础工作做得更稳、更清楚，也更适合长期使用。',
                )}
              </p>

              <div className='marketing-about-hero__metrics'>
                {heroMetrics.map((metric) => (
                  <div key={metric.label} className='marketing-about-hero__metric'>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>

              <div className='marketing-about-hero__tags'>
                {heroTags.map((tag) => (
                  <span key={tag} className='marketing-about-hero__tag'>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className='marketing-divider' />

        <section className='marketing-section-shell'>
          <div className='marketing-section-heading'>
            <h2>{t('我们在做什么')}</h2>
            <p>
              {t(
                '把能力聚合不是终点，把接入、管理和使用过程组织成一套清晰的产品体验，才是 AI Force 更在意的事情。',
              )}
            </p>
          </div>

          <div className='marketing-about-card-grid'>
            {capabilityCards.map((card) => (
              <AboutFeatureCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <div className='marketing-divider' />

        <section className='marketing-section-shell'>
          <div className='marketing-platform-card marketing-about-principles'>
            <div className='marketing-section-heading marketing-section-heading--centered'>
              <h2>{t('我们坚持的方式')}</h2>
              <p>
                {t(
                  '我们更看重长期使用里的确定性，而不是短期堆叠一串看起来热闹但不好维护的功能名词。',
                )}
              </p>
            </div>

            <div className='marketing-about-principles__grid'>
              {principleCards.map((item) => (
                <article key={item.title} className='marketing-about-principle'>
                  <div className='marketing-about-principle__icon'>
                    <ShieldCheck size={18} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className='marketing-divider' />

        <section className='marketing-section-shell'>
          <div className='marketing-section-heading marketing-section-heading--centered'>
            <h2>{t('适合谁')}</h2>
            <p>
              {t(
                '无论你是个人开发者，还是正在把 AI 纳入团队流程，都应该用更轻的心智负担开始，而不是先被繁琐的底层细节拖住。',
              )}
            </p>
          </div>

          <div className='marketing-about-card-grid marketing-about-card-grid--audience'>
            {audienceCards.map((card) => (
              <AboutFeatureCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <div className='marketing-divider' />

        <section className='marketing-section-shell marketing-section-shell--compact'>
          <div className='marketing-story-callout marketing-about-cta'>
            <div className='marketing-about-cta__content marketing-story-callout__content'>
              <div className='marketing-about-cta__eyebrow'>
                <FileText size={15} />
                <span>{t('下一步')}</span>
              </div>
              <h2>{t('把底层复杂度留给平台，把产品注意力留给你')}</h2>
              <p>
                {t(
                  '如果你想先了解接入方式，可以先看安装与使用教程；如果你已经准备开始试用，控制台、价格页和平台化能力都已经就位。',
                )}
              </p>
              <div className='marketing-about-cta__actions'>
                <Link
                  to={primaryActionTo}
                  className='marketing-about__button marketing-about__button--primary'
                >
                  <span>{primaryActionLabel}</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to='/docs'
                  className='marketing-about__button marketing-about__button--secondary'
                >
                  {t('查看教程')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ConsolePageShell>
  );
};

export default About;
