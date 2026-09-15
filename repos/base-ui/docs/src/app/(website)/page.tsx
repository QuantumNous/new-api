import * as React from 'react';
import type { Metadata, Viewport } from 'next';
import { Accordion } from '@base-ui/react/accordion';
import { Link } from 'docs/src/components/Link';
import { Paper } from './logos/Paper';
import { Zed } from './logos/Zed';
import { Unsplash } from './logos/Unsplash';
import { Operate } from './logos/Operate';
import { GitHub } from './logos/GitHub';
import { Interfere } from './logos/Interfere';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';

export default function Homepage() {
  return (
    <React.Fragment>
      {/* Set the Site name for Google results. https://developers.google.com/search/docs/appearance/site-names */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Base UI',
            url: 'https://base-ui.com',
          }),
        }}
      />
      {/* Organization schema for Google Knowledge Panel and entity recognition.
          https://developers.google.com/search/docs/appearance/structured-data/organization */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Base UI',
            url: process.env.BASE_URL,
            logo: `${process.env.BASE_URL}/static/favicon.svg`,
            sameAs: [
              process.env.SOURCE_CODE_REPO,
              'https://x.com/base_ui',
              'https://www.npmjs.com/package/@base-ui/react',
              'https://bsky.app/profile/base-ui.com',
            ],
          }),
        }}
      />

      <section className="bui-d-c">
        <h1 className="Text sz-3 bp2:sz-4 bui-gcs-1 bui-gce-9 bp4:bui-gce-5">
          Unstyled UI components for building accessible user interfaces
        </h1>
        <div className="bui-gcs-1 bui-gce-9">
          <Link className="Text sz-2 bui-d-if" href="/react/overview/quick-start" withArrow>
            Documentation
          </Link>
        </div>
      </section>
      <section className="bui-d-c">
        <div className="bui-d-f bui-fd-c bui-g-4 bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7">
          <p className="Text sz-2">
            From the creators of Radix, Floating&nbsp;UI, and Material&nbsp;UI, Base&nbsp;UI is a
            comprehensive UI component library for building accessible user interfaces with React.
          </p>
          <p className="Text sz-2">
            Each Base UI component is meticulously designed for composability, consistency, and
            craft. The library's architecture prioritizes flexibility—without imposing visual
            opinions—helping teams craft distinctive interfaces that are fundamentally accessible
            and reliable.
          </p>
          <p className="Text sz-2">
            Collectively, we've been building component libraries for multiple decades. We've
            learned what works, what lasts, and what doesn't. And we really, really sweat the
            details.
          </p>
          <p className="Text sz-2">
            Base UI is built to last. It is designed with care and maintained with intent. Our
            mission is to provide a future-proof foundation for professional interface design on the
            Web.
          </p>
        </div>
      </section>
      <div className="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
        <div className="Separator" role="separator" aria-hidden="true"></div>
      </div>
      <section className="bui-d-c">
        <div className="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
          <h2 className="Text sz-2">Made for the makers</h2>
        </div>
        <ul
          className="List bui-gcs-1 bui-gce-9 bp3:bui-gcs-3 bui-d-g bui-gtc-2 bp2:bui-gtc-4 bp3:bui-gtc-6 bui-g-8 bp2:bui-g-9"
          aria-label="companies using Base UI"
        >
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <Paper />
                </div>
              </div>
              <span className="Text sz-1">Paper</span>
            </div>
          </li>
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <GitHub />
                </div>
              </div>
              <span className="Text sz-1">GitHub</span>
            </div>
          </li>
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <Zed />
                </div>
              </div>
              <span className="Text sz-1">Zed</span>
            </div>
          </li>
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <Unsplash />
                </div>
              </div>
              <span className="Text sz-1">Unsplash</span>
            </div>
          </li>
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <Operate />
                </div>
              </div>
              <span className="Text sz-1">Operate</span>
            </div>
          </li>
          <li>
            <div className="bui-d-f bui-fd-c bui-g-2">
              <div className="Figure" aria-hidden="true">
                <div className="bui-d-f bui-ai-c bui-jc-c bui-h-100">
                  <Interfere />
                </div>
              </div>
              <span className="Text sz-1">Interfere</span>
            </div>
          </li>
        </ul>
      </section>
      <div className="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
        <div className="Separator" role="separator" aria-hidden="true"></div>
      </div>
      <section className="bui-d-c">
        <div className="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
          <h2 className="Text sz-2">So you know who to blame</h2>
        </div>
        <div className="bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7">
          <ul
            className="List"
            aria-label="team members"
            style={{ borderTop: '1px solid var(--gray-t2)' }}
          >
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Colm Tuite</span>
              <span className="Text sz-2">Director of Design Engineering</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Marija Najdova</span>
              <span className="Text sz-2">Director of Engineering</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Albert Yu</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Flavien Delangle</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">James Nelson</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Jenna Smith</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Lukas Tyla</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Michał Dudak</span>
              <span className="Text sz-2">Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Aarón García</span>
              <span className="Text sz-2">Design Engineer</span>
            </li>
            <li className="ListItem bui-d-g bui-gtc-2 bui-g-8 bp3:bui-g-9">
              <span className="Text sz-2">Vlad Moroz</span>
              <span className="Text sz-2">Contributor</span>
            </li>
          </ul>
        </div>
      </section>
      <div className="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
        <div className="Separator" role="separator" aria-hidden="true"></div>
      </div>
      <section className="bui-d-c">
        <div className="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
          <h2 className="Text sz-2">The fine print</h2>
        </div>
        <div className="bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7">
          <Accordion.Root
            className="AccordionWebsiteRoot"
            itemScope
            itemType="https://schema.org/FAQPage"
            // Setting `keepMounted` so that the content of all panels is available in the DOM for search engines. This is especially important for the homepage, which contains important SEO content.
            keepMounted
          >
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  What is Base UI?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  Base UI is a library of unstyled UI components for building accessible component
                  libraries, user interfaces, web applications, and websites with React. Base UI
                  components are highly configurable, composable, and customizable.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  Does Base UI work with any styling library?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  Yes. Base UI works with Tailwind, CSS Modules, CSS-in-JS, plain CSS, and any other
                  styling library you prefer. It also works with JavaScript animation libraries like
                  Motion, or just plain CSS transitions. Base UI is an unstyled component library.
                  The package does not bundle any CSS, and does not prescribe any styling solution.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  Which accessibility standards does Base UI follow?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  When designing and speccing components, we follow{' '}
                  <Link href="https://www.w3.org/WAI/ARIA/apg/patterns/">
                    ARIA Authoring Practices Guide patterns
                  </Link>
                  , and comply with the{' '}
                  <Link href="https://www.w3.org/TR/WCAG22/#new-features-in-wcag-2-2">
                    WCAG 2.2 standard
                  </Link>
                  . Base UI is compliant with all Success Criteria levels relating to component
                  behavior. However, in most cases, we go way beyond these guides. Base UI
                  components are tested across a wide range of browsers, devices, platforms, and
                  environments, and are designed to be accessible.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  How does Base UI differ from Radix UI?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <div className="bui-d-f bui-fd-c bui-g-4" itemProp="text">
                  <p className="Text sz-2">
                    In terms of API design, both libraries are very similar. We intentionally kept
                    our APIs close to Radix UI for an easier migration path. Base UI provides more
                    complex components such as Combobox and Autocomplete. Base UI also provides
                    deeper feature support such as input scrubbing, nested dialogs, and triggering
                    menus on hover. Base UI is more robust and more polished in terms of a11y and
                    edge case handling.
                  </p>
                  <p className="Text sz-2">
                    But the most important difference is that Base UI is actively maintained and
                    developed, with a dedicated team of 7 developers, designers, and managers
                    working on it full-time.
                  </p>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  Can I use Base UI without React?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  Base UI is a React library. It is not designed to be used without React. We may
                  consider supporting other libraries at some point, but for the foreseeable future,
                  React is our primary focus.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  Is Base UI free for commercial use?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  Yes. Base UI is licensed under the MIT license, and is free for commercial use.
                  You are free to use it in your commercial projects, and to modify it to suit your
                  needs.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item
              className="AccordionWebsiteItem"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <Accordion.Header className="AccordionWebsiteHeader">
                <Accordion.Trigger className="AccordionWebsiteTrigger Text sz-2" itemProp="name">
                  Do you offer enterprise SLAs?
                  <PlusIcon className="AccordionWebsiteIcon AccordionWebsiteIconPlus" />
                  <MinusIcon className="AccordionWebsiteIcon AccordionWebsiteIconMinus" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                className="AccordionWebsitePanel"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="Text sz-2" itemProp="text">
                  Not currently. We do provide dedicated support channels to some very large
                  enterprise companies who are working with us as design partners. But we do not
                  currently provide Service Level Agreements, guaranteed response times, issue
                  escalation, feature prioritization, or any other formal support guarantees.
                </p>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </section>
    </React.Fragment>
  );
}

const description = 'Unstyled UI components for building accessible web apps and design systems.';

export const metadata: Metadata = {
  description,
  twitter: {
    site: '@base_ui',
    card: 'summary_large_image',
    description,
  },
  openGraph: {
    type: 'website',
    url: './',
    description,
  },
};

// Custom viewport for the homepage because on mobile it doesn't have a header
export const viewport: Viewport = {
  themeColor: [
    // Desktop Safari page background
    {
      media: '(prefers-color-scheme: light) and (min-width: 1024px)',
      color: 'oklch(95% 0.25% 264)',
    },
    {
      media: '(prefers-color-scheme: dark) and (min-width: 1024px)',
      color: 'oklch(25% 1% 264)',
    },

    // Mobile Safari header background (match the page content)
    {
      media: '(prefers-color-scheme: light)',
      color: '#FFF',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: '#000',
    },
  ],
};
