import { createMdxComponents } from '@vercel/geistdocs/mdx';
import { LogoIconVercel } from '@vercel/geistdocs/assets/logos';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps, ComponentType, JSX } from 'react';
import { ExampleLinks } from '@/components/docs/example-links';
import { IndexCards } from '@/components/docs/index-cards';
import { Check, Cross } from '@/components/docs/inline-icons';
import { InstallPackages } from '@/components/docs/install-packages';
import { InlinePrompt } from '@/components/docs/inline-prompt';
import { BrowserIllustration } from '@/components/docs/browser-illustration';
import {
  CardPlayer,
  WeatherSearch,
} from '@/components/docs/generative-ui-preview';
import {
  Card,
  OfficialModelCards,
  QuickstartFrameworkCards,
  Support,
  Templates,
} from '@/components/docs/marketing-cards';
import { MDXImage } from '@/components/docs/mdx-image';
import { ButtonLink, GithubLink } from '@/components/docs/misc';
import { Note } from '@/components/docs/note';
import { PropertiesTable } from '@/components/docs/properties-table';
import { PreviewSwitchProviders } from '@/components/docs/provider-preview';
import { resolveDocsHref } from '@/components/docs/resolve-href';
import { Snippet } from '@/components/docs/snippet';
import { Steps } from '@/components/docs/steps';
import { createStub } from '@/components/docs/stub';
import { Tab, Tabs } from '@/components/docs/tabs';

type LinkComponent = ComponentType<ComponentProps<'a'>>;

/**
 * Components not yet ported from the legacy app. Rendered as visible
 * placeholders — port or drop them in phase 2.
 */
const stubNames = [
  'Frameworks',
  'Browser',
  'TextGeneration',
  'ObjectGeneration',
  'ChatGeneration',
  'WeatherCard',
  'ReferenceTable',
  'ObjectTableList',
  'ExamplesList',
  'MarketingVisualVercelAi',
  'MarketingFrameworkCircles',
  'MusicPlayer',
  'FeatureCard',
  'ModelCard',
  'LogoOpenAi',
  'CommunityModelCards',
  'CompatibilityModelCards',
  'FrameworkCard',
  'ExampleCards',
  'CodePreview',
  'TabbedCodePreview',
  'InteractiveCodePreview',
  // Imported (top-level) by ai-sdk-rsc pages in the legacy app; the
  // sync-content transform strips those imports.
  'EventPlanning',
  'Searching',
  'UIPreviewCard',
  'Weather',
] as const;

const stubs = Object.fromEntries(
  stubNames.map(name => [name, createStub(name)]),
);

export const getMdxComponents = ({
  link,
  versionPrefix,
}: {
  link: MDXComponents['a'];
  versionPrefix: string;
}): MDXComponents => {
  const Link = link as LinkComponent;
  const resolveVersionedHref = (href: string) =>
    resolveDocsHref(href, versionPrefix);
  const VersionedLink = ({ href, ...props }: JSX.IntrinsicElements['a']) => (
    <Link
      href={typeof href === 'string' ? resolveVersionedHref(href) : href}
      {...props}
    />
  );

  return {
    ...createMdxComponents({ a: VersionedLink }),
    ...stubs,
    Note,
    Check,
    Cross,
    InstallPackages,
    InlinePrompt,
    BrowserIllustration,
    CardPlayer,
    WeatherSearch,
    Card,
    Templates,
    OfficialModelCards,
    PreviewSwitchProviders,
    QuickstartFrameworkCards: props => (
      <QuickstartFrameworkCards {...props} resolveHref={resolveVersionedHref} />
    ),
    Support: props => <Support {...props} resolveHref={resolveVersionedHref} />,
    VercelIcon: LogoIconVercel,
    Snippet,
    Tabs,
    Tab,
    Steps,
    PropertiesTable: props => (
      <PropertiesTable {...props} versionPrefix={versionPrefix} />
    ),
    IndexCards: props => (
      <IndexCards {...props} resolveHref={resolveVersionedHref} />
    ),
    ExampleLinks: props => (
      <ExampleLinks {...props} resolveHref={resolveVersionedHref} />
    ),
    GithubLink,
    ButtonLink: props => (
      <ButtonLink {...props} resolveHref={resolveVersionedHref} />
    ),
    MDXImage,
    Image: MDXImage,
  };
};
