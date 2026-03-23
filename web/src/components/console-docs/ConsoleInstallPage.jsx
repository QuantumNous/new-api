import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Modal } from '@douyinfe/semi-ui';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode2,
  Laptop,
  Monitor,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import { Claude, OpenAI } from '../../helpers/lobeIcons';
import { INSTALL_GUIDES } from './installGuideData';

const PRODUCT_ICONS = {
  'claude-code': Claude.Color,
  codex: OpenAI,
};

const renderRichText = (segments) =>
  segments.map((segment, index) =>
    segment.type === 'link' ? (
      <a
        key={`${segment.href}-${index}`}
        className='console-docs__inline-link'
        href={segment.href}
        rel='noreferrer'
        target='_blank'
      >
        {segment.text}
      </a>
    ) : (
      <React.Fragment key={`${segment.text}-${index}`}>
        {segment.text}
      </React.Fragment>
    ),
  );

const renderBlock = (block, key) => {
  if (block.type === 'richText') {
    return (
      <p key={key} className='console-docs__paragraph'>
        {renderRichText(block.segments)}
      </p>
    );
  }

  if (block.type === 'code') {
    return (
      <pre key={key} className='console-docs__code-block'>
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === 'variables') {
    return (
      <div key={key} className='console-docs__variable-list'>
        {block.items.map((item) => (
          <div
            key={`${item.name}-${item.value}`}
            className='console-docs__variable-row'
          >
            <div className='console-docs__variable-item'>
              <span className='console-docs__variable-label'>变量名：</span>
              <code>{item.name}</code>
            </div>
            <div className='console-docs__variable-item'>
              <span className='console-docs__variable-label'>变量值：</span>
              <span>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p key={key} className='console-docs__paragraph'>
      {block.text}
    </p>
  );
};

const SectionCard = ({ section, children, action = null, tone = 'default' }) => (
  <section
    className={[
      'console-docs__section-card',
      tone === 'success' ? 'console-docs__section-card--success' : '',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className='console-docs__section-head'>
      <div className='console-docs__section-title-wrap'>
        <h2 className='console-docs__section-title'>{section.title}</h2>
      </div>
      {action}
    </div>
    <div className='console-docs__section-body'>{children}</div>
  </section>
);

const SupportButton = ({ supportContact, onClick }) => (
  <button className='console-docs__support-button' onClick={onClick} type='button'>
    <img
      alt='手指'
      className='console-docs__support-finger'
      loading='lazy'
      src={supportContact.fingerImage}
    />
    <span>{supportContact.buttonText}</span>
  </button>
);

const AccordionSection = ({ section, open, onToggle }) => (
  <section className='console-docs__section-card'>
    <button
      className='console-docs__accordion-toggle'
      onClick={onToggle}
      type='button'
    >
      <span className='console-docs__accordion-title'>{section.title}</span>
      <span className='console-docs__accordion-icon'>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </span>
    </button>
    {open ? (
      <div className='console-docs__section-body console-docs__accordion-body'>
        <div className='console-docs__accordion-list'>
          {section.items.map((item, index) => (
            <article
              key={`${section.id}-${index}`}
              className='console-docs__step-card console-docs__step-card--media'
            >
              <div className='console-docs__step-index'>{index + 1}</div>
              <div className='console-docs__step-content'>
                <h3 className='console-docs__step-title'>{item.title}</h3>
                {item.image ? (
                  <img
                    alt={item.image.alt}
                    className='console-docs__image'
                    loading='lazy'
                    src={item.image.src}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <p className='console-docs__accordion-footer'>{section.footer}</p>
      </div>
    ) : null}
  </section>
);

const StepsSection = ({ section, onSupportClick }) => (
  <SectionCard
    action={
      section.supportContact ? (
        <SupportButton
          onClick={onSupportClick}
          supportContact={section.supportContact}
        />
      ) : null
    }
    section={section}
  >
    <div className='console-docs__step-list'>
      {section.steps.map((step, index) => (
        <article key={`${section.id}-${index}`} className='console-docs__step-card'>
          <div className='console-docs__step-index'>{index + 1}</div>
          <div className='console-docs__step-content'>
            <h3 className='console-docs__step-title'>{step.title}</h3>
            <div className='console-docs__step-blocks'>
              {step.blocks.map((block, blockIndex) =>
                renderBlock(block, `${section.id}-${index}-${blockIndex}`),
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  </SectionCard>
);

const FaqSection = ({ section }) => (
  <SectionCard section={section}>
    <div className='console-docs__faq-content'>
      <div className='console-docs__faq-issue-grid'>
        {section.issues.map((issue) => (
          <article
            key={issue.title}
            className='console-docs__faq-issue console-docs__faq-issue--image'
          >
            <h3 className='console-docs__faq-title'>{issue.title}</h3>
            <img
              alt={issue.image.alt}
              className='console-docs__image'
              loading='lazy'
              src={issue.image.src}
            />
          </article>
        ))}
      </div>
      <div className='console-docs__faq-groups'>
        {section.groups.map((group) => (
          <article key={group.lead} className='console-docs__faq-issue'>
            <h3 className='console-docs__faq-title'>{group.lead}</h3>
            <ul className='console-docs__list'>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  </SectionCard>
);

const DefaultSection = ({ section }) => (
  <SectionCard
    section={section}
    tone={section.type === 'callout' && section.tone === 'success' ? 'success' : 'default'}
  >
    <div className='console-docs__section-stack'>
      {section.blocks.map((block, index) => renderBlock(block, `${section.id}-${index}`))}
    </div>
  </SectionCard>
);

const PlatformTabs = ({ activePlatformId, guide }) => (
  <div className='console-docs__platform-tabs'>
    {guide.platforms.map((platform) => {
      const isActive = platform.id === activePlatformId;
      const Icon = platform.id === 'windows' ? Monitor : Laptop;

      return (
        <Link
          key={platform.id}
          className={[
            'console-docs__platform-tab',
            isActive ? 'console-docs__platform-tab--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          to={`${guide.basePath}/${platform.id}`}
        >
          <span className='console-docs__platform-tab-icon'>
            <Icon size={16} />
          </span>
          <span>{platform.label}</span>
        </Link>
      );
    })}
  </div>
);

const sectionIcons = {
  callout: ShieldCheck,
  section: FileCode2,
  steps: ScanSearch,
  accordion: Monitor,
  faq: ExternalLink,
};

const InstallHero = ({ guide, platform }) => {
  const ProductIcon = PRODUCT_ICONS[guide.productId];

  return (
    <header className='console-docs__hero'>
      <div className='console-docs__hero-copy'>
        <div className='console-docs__eyebrow'>
          <span className='console-docs__eyebrow-icon'>
            <ProductIcon size={18} />
          </span>
          <span>{guide.productLabel}</span>
        </div>
        <h1 className='console-docs__title'>{platform.title}</h1>
        <p className='console-docs__description'>{platform.description}</p>
      </div>
      <PlatformTabs activePlatformId={platform.id} guide={guide} />
    </header>
  );
};

const InstallSections = ({ onSupportClick, openAccordions, platform, toggleAccordion }) => (
  <div className='console-docs__content'>
    {platform.sections.map((section) => {
      const SectionIcon = sectionIcons[section.type] || FileCode2;
      const iconBadge = (
        <span className='console-docs__section-icon' aria-hidden='true'>
          <SectionIcon size={16} />
        </span>
      );

      if (section.type === 'accordion') {
        return (
          <div key={section.id} className='console-docs__section-with-icon'>
            {iconBadge}
            <AccordionSection
              onToggle={() => toggleAccordion(section.id)}
              open={openAccordions.has(section.id)}
              section={section}
            />
          </div>
        );
      }

      if (section.type === 'steps') {
        return (
          <div key={section.id} className='console-docs__section-with-icon'>
            {iconBadge}
            <StepsSection onSupportClick={onSupportClick} section={section} />
          </div>
        );
      }

      if (section.type === 'faq') {
        return (
          <div key={section.id} className='console-docs__section-with-icon'>
            {iconBadge}
            <FaqSection section={section} />
          </div>
        );
      }

      return (
        <div key={section.id} className='console-docs__section-with-icon'>
          {iconBadge}
          <DefaultSection section={section} />
        </div>
      );
    })}
  </div>
);

const ConsoleInstallPage = ({ productId }) => {
  const { platform: platformId } = useParams();
  const guide = INSTALL_GUIDES[productId];
  const fallbackPlatformId = guide?.platforms?.[0]?.id || 'macos-linux';
  const platform = useMemo(
    () => guide?.platforms?.find((item) => item.id === platformId) || null,
    [guide, platformId],
  );
  const [supportVisible, setSupportVisible] = useState(false);
  const [openAccordions, setOpenAccordions] = useState(new Set());

  useEffect(() => {
    if (!guide || !platform) return;

    const nextOpenAccordions = new Set(
      platform.sections
        .filter((section) => section.type === 'accordion' && section.defaultOpen)
        .map((section) => section.id),
    );

    setOpenAccordions(nextOpenAccordions);
  }, [guide, platform]);

  if (!guide) {
    return null;
  }

  if (!platform) {
    return <Navigate replace to={`${guide.basePath}/${fallbackPlatformId}`} />;
  }

  const supportContact =
    platform.sections.find((section) => section.supportContact)?.supportContact || null;

  return (
    <>
      <div className='console-docs console-docs--install'>
        <InstallHero guide={guide} platform={platform} />
        <InstallSections
          onSupportClick={() => setSupportVisible(true)}
          openAccordions={openAccordions}
          platform={platform}
          toggleAccordion={(sectionId) => {
            setOpenAccordions((current) => {
              const next = new Set(current);
              if (next.has(sectionId)) {
                next.delete(sectionId);
              } else {
                next.add(sectionId);
              }
              return next;
            });
          }}
        />
      </div>
      {supportContact ? (
        <Modal
          centered
          footer={null}
          onCancel={() => setSupportVisible(false)}
          title={supportContact.title}
          visible={supportVisible}
        >
          <div className='console-docs__support-modal'>
            <img
              alt={supportContact.qrCodeAlt}
              className='console-docs__support-qr'
              loading='lazy'
              src={supportContact.qrCodeImage}
            />
            <p className='console-docs__support-copy'>{supportContact.description}</p>
          </div>
        </Modal>
      ) : null}
    </>
  );
};

export default ConsoleInstallPage;
