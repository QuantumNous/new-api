import { PreviewCard } from '@base-ui/react/preview-card';
import styles from '../../index.module.css';

export default function ExamplePreviewCard() {
  return (
    <PreviewCard.Root>
      <p className={styles.Paragraph}>
        The principles of good{' '}
        <PreviewCard.Trigger
          className={styles.Link}
          href="https://en.wikipedia.org/wiki/Typography"
        >
          typography
        </PreviewCard.Trigger>{' '}
        remain in the digital age.
      </p>

      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8}>
          <PreviewCard.Popup className={styles.Popup}>
            <PreviewCard.Arrow className={styles.Arrow} />
            <div className={styles.PopupContent}>
              <img
                width="224"
                height="150"
                className={styles.Image}
                src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
                alt="Station Hofplein signage in Rotterdam, Netherlands"
              />
              <p className={styles.Summary}>
                <strong>Typography</strong> is the art and science of arranging type to make written
                language clear, visually appealing, and effective in communication.
              </p>
            </div>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
