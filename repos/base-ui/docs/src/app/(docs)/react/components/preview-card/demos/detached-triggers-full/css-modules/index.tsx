'use client';
import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import styles from './index.module.css';

const demoPreviewCard = PreviewCard.createHandle<React.ReactElement>();

const cardContents = {
  typography: (
    <div className={styles.PopupContent}>
      <img
        width="224"
        height="150"
        className={styles.Image}
        src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
        alt="Station Hofplein signage in Rotterdam, Netherlands"
      />
      <p className={styles.Summary}>
        <strong>Typography</strong> is the art and science of arranging type.
      </p>
    </div>
  ),
  design: (
    <div className={styles.PopupContent}>
      <img
        width="250"
        height="249"
        className={styles.Image}
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Braun_ABW30_%28schwarz%29.jpg/250px-Braun_ABW30_%28schwarz%29.jpg"
        alt="Braun ABW30"
      />
      <p className={styles.Summary}>
        A <strong>design</strong> is the concept or proposal for an object, process, or system.
      </p>
    </div>
  ),
  art: (
    <div className={styles.PopupContent}>
      <img
        width="250"
        height="290"
        className={styles.Image}
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/MonaLisa_sfumato.jpeg/250px-MonaLisa_sfumato.jpeg"
        alt="Mona Lisa"
      />
      <p className={styles.Summary}>
        <strong>Art</strong> is a diverse range of cultural activity centered around works utilizing
        creative or imaginative talents, which are expected to evoke a worthwhile experience,
        generally through an expression of emotional power, conceptual ideas, technical proficiency,
        or beauty.
      </p>
    </div>
  ),
};

export default function PreviewCardDetachedTriggersFullDemo() {
  return (
    <div>
      <p className={styles.Paragraph}>
        Discover{' '}
        <PreviewCard.Trigger
          className={styles.Link}
          handle={demoPreviewCard}
          href="https://en.wikipedia.org/wiki/Typography"
          payload={cardContents.typography}
        >
          typography
        </PreviewCard.Trigger>
        ,{' '}
        <PreviewCard.Trigger
          className={styles.Link}
          handle={demoPreviewCard}
          href="https://en.wikipedia.org/wiki/Design"
          payload={cardContents.design}
        >
          design
        </PreviewCard.Trigger>
        , or{' '}
        <PreviewCard.Trigger
          className={styles.Link}
          handle={demoPreviewCard}
          href="https://en.wikipedia.org/wiki/Art"
          payload={cardContents.art}
        >
          art
        </PreviewCard.Trigger>
        .
      </p>

      <PreviewCard.Root handle={demoPreviewCard}>
        {({ payload }) => (
          <PreviewCard.Portal>
            <PreviewCard.Positioner sideOffset={8} className={styles.Positioner}>
              <PreviewCard.Popup className={styles.Popup}>
                <PreviewCard.Arrow className={styles.Arrow} />
                <PreviewCard.Viewport className={styles.Viewport}>{payload}</PreviewCard.Viewport>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        )}
      </PreviewCard.Root>
    </div>
  );
}
