'use client';
import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { type SettingsMetadata, useExperimentSettings } from './_components/SettingsPanel';
import styles from './inline-positioning.module.css';

interface Settings {
  use300msDelay: boolean;
}

const DELAY_MS = 300;

function getDelay(settings: Settings) {
  return settings.use300msDelay ? DELAY_MS : 0;
}

const previewCards = {
  classicalProportion: {
    href: 'https://en.wikipedia.org/wiki/Proportion_(architecture)',
    title: 'Classical proportion',
    summary:
      'A compact reference for ratios, page blocks, and the calm geometry that still shapes editorial layouts.',
    artwork: 'linear-gradient(135deg, #efe5d3 0%, #d9c7a5 48%, #b88b4a 100%)',
  },
  opticalSizing: {
    href: 'https://en.wikipedia.org/wiki/Optical_size',
    title: 'Optical sizing',
    summary:
      'Type tuned for its rendered size keeps counters open, joins sturdy, and rhythm readable at small scales.',
    artwork: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 48%, #60a5fa 100%)',
  },
  newspaperSystems: {
    href: 'https://en.wikipedia.org/wiki/Newspaper_design',
    title: 'Newspaper systems',
    summary:
      'Narrow columns and tightly controlled measures make wrapped inline anchors especially easy to inspect.',
    artwork: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 52%, #9ca3af 100%)',
  },
  marginAlignment: {
    href: 'https://en.wikipedia.org/wiki/Hanging_punctuation',
    title: 'Optical margin alignment',
    summary:
      'Hanging punctuation keeps the text edge visually straight even when commas and quotes sit outside the block.',
    artwork: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 52%, #f472b6 100%)',
  },
  captionRhythm: {
    href: 'https://en.wikipedia.org/wiki/Grid_(graphic_design)',
    title: 'Caption rhythm',
    summary:
      'Captions and asides often contain the longest inline references in a layout, which makes them a useful wrap case.',
    artwork: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 48%, #4ade80 100%)',
  },
  joinedFragments: {
    href: 'https://en.wikipedia.org/wiki/Line_wrap_and_word_wrap',
    title: 'Joined fragments',
    summary:
      'Two neighboring inline references should still track the hovered line even when they meet at punctuation.',
    artwork: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 48%, #8b5cf6 100%)',
  },
  pairedReferences: {
    href: 'https://en.wikipedia.org/wiki/Microtypography',
    title: 'Paired references',
    summary:
      'This case helps inspect how a second link behaves when it starts exactly where another wrapped trigger ends.',
    artwork: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 52%, #f59e0b 100%)',
  },
} as const;

export default function InlinePositioningExperiment() {
  return (
    <div className={styles.Experiment}>
      <section className={styles.Section}>
        <p className={styles.SectionLabel}>Preview Cards</p>
        <p className={styles.Paragraph}>
          Editors still bounce between{' '}
          <PreviewCardLink {...previewCards.classicalProportion}>
            classical proportion
          </PreviewCardLink>
          , <PreviewCardLink {...previewCards.opticalSizing}>optical sizing</PreviewCardLink>, and{' '}
          <PreviewCardLink {...previewCards.newspaperSystems}>
            newspaper systems that deliberately wrap across several carefully measured lines
          </PreviewCardLink>
          . They also compare{' '}
          <PreviewCardLink {...previewCards.marginAlignment}>
            optical margin alignment
          </PreviewCardLink>{' '}
          with{' '}
          <PreviewCardLink {...previewCards.captionRhythm}>
            caption rhythms that keep long annotations moving into the next line
          </PreviewCardLink>
          , while slash-joined references like{' '}
          <PreviewCardLink {...previewCards.joinedFragments}>
            joined inline fragments that want to wrap awkwardly
          </PreviewCardLink>
          /
          <PreviewCardLink {...previewCards.pairedReferences}>
            paired references that continue immediately after the slash
          </PreviewCardLink>{' '}
          make it easier to inspect conjoining inline cases.
        </p>
      </section>
    </div>
  );
}

interface PreviewCardLinkProps {
  href: string;
  title: string;
  summary: string;
  artwork: string;
  children: React.ReactNode;
}

function PreviewCardLink(props: PreviewCardLinkProps) {
  const { settings } = useExperimentSettings<Settings>();
  const { href, title, summary, artwork, children } = props;
  const delay = getDelay(settings);

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger className={styles.Link} closeDelay={delay} delay={delay} href={href}>
        {children}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8}>
          <PreviewCard.Popup className={styles.PreviewPopup}>
            <PreviewCard.Arrow className={styles.Arrow}>
              <ArrowSvg />
            </PreviewCard.Arrow>
            <div className={styles.Artwork} style={{ background: artwork }}>
              <span className={styles.ArtworkLabel}>{title}</span>
            </div>
            <div className={styles.CardBody}>
              <p className={styles.CardTitle}>{title}</p>
              <p className={styles.Summary}>{summary}</p>
            </div>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  use300msDelay: {
    type: 'boolean',
    label: 'Use 300ms delay',
    default: false,
  },
};
