'use client';
import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { StoreInspector } from '@base-ui/utils/store';
import demoStyles from 'docs/src/app/(docs)/react/components/preview-card/demos/detached-triggers-full/css-modules/index.module.css';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import styles from './triggers.module.css';

const previewCard1Handle = PreviewCard.createHandle<React.ReactElement>();
const previewCard2Handle = PreviewCard.createHandle<React.ReactElement>();

interface Settings {
  delay: number;
  closeDelay: number;
  side: 'top' | 'bottom' | 'left' | 'right';
  keepMounted: boolean;
}
const cardContents = {
  typography: (
    <div className={demoStyles.PopupContent}>
      <img
        width="224"
        height="150"
        className={demoStyles.Image}
        src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
        alt="Station Hofplein signage in Rotterdam, Netherlands"
      />
      <p className={demoStyles.Summary}>
        <strong>Typography</strong> is the art and science of arranging type.
      </p>
    </div>
  ),
  design: (
    <div className={demoStyles.PopupContent}>
      <img
        width="250"
        height="249"
        className={demoStyles.Image}
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Braun_ABW30_%28schwarz%29.jpg/250px-Braun_ABW30_%28schwarz%29.jpg"
        alt="Braun ABW30"
      />
      <p className={demoStyles.Summary}>
        A <strong>design</strong> is the concept or proposal for an object, process, or system.
      </p>
    </div>
  ),
  art: (
    <div className={demoStyles.PopupContent}>
      <img
        width="250"
        height="290"
        className={demoStyles.Image}
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/MonaLisa_sfumato.jpeg/250px-MonaLisa_sfumato.jpeg"
        alt="Mona Lisa"
      />
      <p className={demoStyles.Summary}>
        <strong>Art</strong> is a diverse range of cultural activity centered around works utilizing
        creative or imaginative talents, which are expected to evoke a worthwhile experience,
        generally through an expression of emotional power, conceptual ideas, technical proficiency,
        or beauty.
      </p>
    </div>
  ),
};

export default function PreviewCardExperiment() {
  const { settings } = useExperimentSettings<Settings>();
  const [singleTriggerOpen, setSingleTriggerOpen] = React.useState(false);
  const [controlledWithinRootOpen, setControlledWithinRootOpen] = React.useState(false);
  const [controlledWithinRootTriggerId, setControlledWithinRootTriggerId] = React.useState<
    string | null
  >(null);
  const [controlledDetachedOpen, setControlledDetachedOpen] = React.useState(false);
  const [controlledDetachedTriggerId, setControlledDetachedTriggerId] = React.useState<
    string | null
  >(null);

  return (
    <div>
      <h1>Preview Card</h1>
      <div className={styles.Container}>
        <h2>Uncontrolled, single trigger</h2>
        <div className={styles.Panel}>
          <PreviewCard.Root>
            <PreviewCardTrigger
              delay={settings.delay}
              closeDelay={settings.closeDelay}
              href="https://en.wikipedia.org/wiki/Typography"
            >
              Typography
            </PreviewCardTrigger>
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {cardContents.typography}
            </PreviewCardContent>
          </PreviewCard.Root>
          ,&nbsp;
          <PreviewCard.Root>
            <PreviewCardTrigger
              delay={settings.delay}
              closeDelay={settings.closeDelay}
              href="https://en.wikipedia.org/wiki/Design"
            >
              Design
            </PreviewCardTrigger>
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {cardContents.design}
            </PreviewCardContent>
          </PreviewCard.Root>
          ,&nbsp;
          <PreviewCard.Root>
            <PreviewCardTrigger
              delay={settings.delay}
              closeDelay={settings.closeDelay}
              href="https://en.wikipedia.org/wiki/Art"
            >
              Art
            </PreviewCardTrigger>
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {cardContents.art}
            </PreviewCardContent>
          </PreviewCard.Root>
        </div>
      </div>

      <div className={styles.Container}>
        <h2>Controlled, single trigger</h2>
        <div className={styles.Panel}>
          <PreviewCard.Root
            open={singleTriggerOpen}
            onOpenChange={(nextOpen) => setSingleTriggerOpen(nextOpen)}
          >
            <PreviewCardTrigger
              delay={settings.delay}
              closeDelay={settings.closeDelay}
              href="https://en.wikipedia.org/wiki/Typography"
            >
              Typography
            </PreviewCardTrigger>
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {cardContents.typography}
            </PreviewCardContent>
          </PreviewCard.Root>
        </div>
        <button
          type="button"
          className={styles.ControlButton}
          onClick={() => setSingleTriggerOpen(true)}
        >
          Open externally
        </button>
      </div>

      <div className={styles.Container}>
        <h2>Uncontrolled, multiple triggers within Root</h2>
        <div className={styles.Panel}>
          <PreviewCard.Root>
            {({ payload }) => (
              <React.Fragment>
                <PreviewCardTrigger
                  payload={cardContents.typography}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Typography"
                >
                  Typography
                </PreviewCardTrigger>
                ,&nbsp;
                <PreviewCardTrigger
                  payload={cardContents.design}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Design"
                >
                  Design
                </PreviewCardTrigger>
                ,&nbsp;
                <PreviewCardTrigger
                  payload={cardContents.art}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Art"
                >
                  Art
                </PreviewCardTrigger>
                <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
                  {payload as string}
                </PreviewCardContent>
              </React.Fragment>
            )}
          </PreviewCard.Root>
        </div>
      </div>

      <div className={styles.Container}>
        <h2>Controlled, multiple triggers within Root</h2>
        <div className={styles.Panel}>
          <PreviewCard.Root
            open={controlledWithinRootOpen}
            onOpenChange={(open, eventDetails) => {
              setControlledWithinRootOpen(open);
              setControlledWithinRootTriggerId(eventDetails.trigger?.id ?? null);
            }}
            triggerId={controlledWithinRootTriggerId}
          >
            {({ payload }) => (
              <React.Fragment>
                <PreviewCardTrigger
                  payload={cardContents.typography}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Typography"
                  id="within-root-typography"
                >
                  Typography
                </PreviewCardTrigger>
                ,&nbsp;
                <PreviewCardTrigger
                  payload={cardContents.design}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Design"
                  id="within-root-design"
                >
                  Design
                </PreviewCardTrigger>
                ,&nbsp;
                <PreviewCardTrigger
                  payload={cardContents.art}
                  delay={settings.delay}
                  closeDelay={settings.closeDelay}
                  href="https://en.wikipedia.org/wiki/Art"
                  id="within-root-art"
                >
                  Art
                </PreviewCardTrigger>
                <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
                  {payload as string}
                </PreviewCardContent>
              </React.Fragment>
            )}
          </PreviewCard.Root>
        </div>
        <button
          type="button"
          className={styles.ControlButton}
          onClick={() => {
            setControlledWithinRootOpen(true);
            setControlledWithinRootTriggerId('within-root-design');
          }}
        >
          Open externally (Design)
        </button>
      </div>

      <div className={styles.Container}>
        <h2>
          Uncontrolled, detached triggers <StoreInspector store={previewCard1Handle.store} />
        </h2>

        <div className={styles.Panel}>
          <PreviewCardTrigger
            payload={cardContents.typography}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Typography"
            handle={previewCard1Handle}
          >
            Typography
          </PreviewCardTrigger>
          ,&nbsp;
          <PreviewCardTrigger
            payload={cardContents.design}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Design"
            handle={previewCard1Handle}
          >
            Design
          </PreviewCardTrigger>
          ,&nbsp;
          <PreviewCardTrigger
            payload={cardContents.art}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Art"
            handle={previewCard1Handle}
          >
            Art
          </PreviewCardTrigger>
        </div>

        <PreviewCard.Root handle={previewCard1Handle}>
          {({ payload }) => (
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {payload}
            </PreviewCardContent>
          )}
        </PreviewCard.Root>
      </div>

      <div className={styles.Container}>
        <h2>Controlled, detached triggers</h2>
        <div className={styles.Panel}>
          <PreviewCardTrigger
            payload={cardContents.typography}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Typography"
            handle={previewCard2Handle}
            id="detached-typography-trigger"
          >
            Typography
          </PreviewCardTrigger>
          ,&nbsp;
          <PreviewCardTrigger
            payload={cardContents.design}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Design"
            handle={previewCard2Handle}
            id="detached-design-trigger"
          >
            Design
          </PreviewCardTrigger>
          ,&nbsp;
          <PreviewCardTrigger
            payload={cardContents.art}
            delay={settings.delay}
            closeDelay={settings.closeDelay}
            href="https://en.wikipedia.org/wiki/Art"
            handle={previewCard2Handle}
            id="detached-art-trigger"
          >
            Art
          </PreviewCardTrigger>
        </div>

        <PreviewCard.Root
          handle={previewCard2Handle}
          open={controlledDetachedOpen}
          triggerId={controlledDetachedTriggerId}
          onOpenChange={(open, eventDetails) => {
            setControlledDetachedOpen(open);
            setControlledDetachedTriggerId(eventDetails.trigger?.id ?? null);
          }}
        >
          {({ payload }) => (
            <PreviewCardContent side={settings.side} keepMounted={settings.keepMounted}>
              {payload}
            </PreviewCardContent>
          )}
        </PreviewCard.Root>

        <button
          type="button"
          className={styles.ControlButton}
          onClick={() => {
            setControlledDetachedOpen(true);
            setControlledDetachedTriggerId('detached-design-trigger');
          }}
        >
          Open externally (Design)
        </button>
        <button
          type="button"
          className={styles.ControlButton}
          onClick={() => {
            previewCard2Handle.open('detached-design-trigger');
          }}
        >
          Open via handle (Design)
        </button>
      </div>
    </div>
  );
}

function PreviewCardTrigger<Payload = string>(
  props: PreviewCard.Trigger.Props<Payload>,
): React.ReactElement {
  return <PreviewCard.Trigger className={demoStyles.Link} {...(props as any)} />;
}

function PreviewCardContent(
  props: PreviewCard.Popup.Props & {
    side: 'top' | 'bottom' | 'left' | 'right';
    keepMounted: boolean;
  },
) {
  const { children, side, keepMounted, ...otherProps } = props;
  return (
    <PreviewCard.Portal keepMounted={keepMounted}>
      <PreviewCard.Positioner sideOffset={8} side={side} className={demoStyles.Positioner}>
        <PreviewCard.Popup className={demoStyles.Popup} {...otherProps}>
          <PreviewCard.Arrow className={demoStyles.Arrow}>
            <ArrowSvg />
          </PreviewCard.Arrow>
          <PreviewCard.Viewport className={demoStyles.Viewport}>{children}</PreviewCard.Viewport>
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={demoStyles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={demoStyles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={demoStyles.ArrowInnerStroke}
      />
    </svg>
  );
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  delay: {
    type: 'number',
    label: 'Delay',
    default: 600,
  },
  closeDelay: {
    type: 'number',
    label: 'Close Delay',
    default: 300,
  },
  side: {
    type: 'string',
    label: 'Side',
    options: ['top', 'bottom', 'left', 'right'],
    default: 'bottom',
  },
  keepMounted: {
    type: 'boolean',
    label: 'Keep mounted',
    default: false,
  },
};
