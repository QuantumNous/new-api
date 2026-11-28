'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Slider } from '@base-ui/react/slider';
import '../../../../demo-data/theme/css-modules/theme.css';
import styles from './inset.module.css';

function InsetSlider(props: Slider.Root.Props) {
  const value = props.defaultValue ?? props.value;
  const range = Array.isArray(value);
  const prefix = React.useId();
  return (
    <Slider.Root thumbAlignment="edge" {...props} className={styles.InsetRoot}>
      <Slider.Control className={styles.InsetControl}>
        <Slider.Track className={styles.InsetTrack}>
          <Slider.Indicator
            className={clsx(styles.InsetIndicator, !range && styles.InsetIndicatorSingle)}
          />

          {!range && <Slider.Thumb className={styles.InsetThumb} />}

          {range &&
            value.map((_v, i) => {
              return <Slider.Thumb key={`${prefix}${i}`} index={i} className={styles.InsetThumb} />;
            })}
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function DemoSlider(props: Slider.Root.Props & { wide?: boolean }) {
  const { wide, style: styleProp, ...rest } = props;
  const value = rest.value ?? rest.defaultValue;
  const range = Array.isArray(value);
  const prefix = React.useId();
  return (
    <Slider.Root
      thumbAlignment="edge"
      {...rest}
      className={styles.DemoRoot}
      style={
        {
          ['--base-color']:
            props.thumbAlignment !== 'edge-client-only' ? 'var(--color-red)' : 'var(--color-blue)',
          ['--track-width']: wide ? '320px' : undefined,
          ...(typeof styleProp === 'object' ? styleProp : {}),
        } as React.CSSProperties
      }
    >
      <Slider.Control className={styles.DemoControl}>
        <Slider.Track className={styles.DemoTrack}>
          <Slider.Indicator
            className={clsx(styles.DemoIndicator, !range && styles.DemoIndicatorSingle)}
          />

          {!range && <Slider.Thumb className={styles.DemoThumb} />}

          {range &&
            value.map((_v, i) => {
              return <Slider.Thumb key={`${prefix}${i}`} index={i} className={styles.DemoThumb} />;
            })}
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function RadixSlider(props: Slider.Root.Props) {
  return (
    <Slider.Root thumbAlignment="edge" {...props} className={styles.RadixRoot}>
      <Slider.Control className={styles.RadixControl}>
        <Slider.Track className={styles.RadixTrack}>
          <Slider.Indicator className={styles.RadixIndicator} />
          <Slider.Thumb className={styles.RadixThumb} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

export default function App() {
  return (
    <React.Fragment>
      <div
        style={
          {
            '--black-a7': 'color(display-p3 0 0 0/0.5)',
            '--black-a8': 'color(display-p3 0 0 0/0.6)',
            '--black-a10': 'color(display-p3 0 0 0/0.8)',
            '--indigo-9': 'color(display-p3 0.276 0.384 0.837)',
            '--purple-9': 'color(display-p3 0.523 0.318 0.751)',
            '--violet-3': 'color(display-p3 0.154 0.123 0.256)',
          } as React.CSSProperties
        }
        className={styles.HeroRow}
      >
        <RadixSlider defaultValue={40} />

        <RadixSlider defaultValue={40} orientation="vertical" />
      </div>

      <div
        style={
          {
            '--thumb-radius': '0.625rem',
            '--h-track-height': 'calc(var(--thumb-radius) * 2)',
            '--h-track-width': '14rem',

            '--indicator-bg': 'white',
            '--track-bg': 'var(--color-gray-200)',
            '--track-border-color': 'var(--color-gray-400)',
          } as React.CSSProperties
        }
        className={styles.InsetGrid}
      >
        <InsetSlider defaultValue={45} orientation="vertical" />

        <InsetSlider defaultValue={[25, 50]} orientation="vertical" />

        <div className={styles.InsetColumn}>
          <InsetSlider defaultValue={45} />

          <InsetSlider defaultValue={[25, 50]} />
        </div>
      </div>

      <p className={styles.Caption}>
        Red <code>thumbAlignment="edge"</code>, Blue <code>thumbAlignment="edge-client-only"</code>
      </p>
      <div className={styles.DemoGrid}>
        <DemoSlider defaultValue={30} thumbAlignment="edge-client-only" />

        <DemoSlider defaultValue={30} wide thumbAlignment="edge-client-only" />

        <DemoSlider defaultValue={30} />

        <DemoSlider defaultValue={30} wide />

        <DemoSlider defaultValue={[20, 64]} thumbAlignment="edge-client-only" />

        <DemoSlider defaultValue={[20, 64]} wide thumbAlignment="edge-client-only" />

        <DemoSlider defaultValue={[20, 64]} />

        <DemoSlider defaultValue={[20, 64]} wide />
      </div>
    </React.Fragment>
  );
}
