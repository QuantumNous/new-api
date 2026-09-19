'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { Slider } from '@base-ui/react/slider';
import styles from './drawer-slider.module.css';

export default function DrawerSliderExperiment() {
  return (
    <div className={styles.Root}>
      <Drawer.Root swipeDirection="right">
        <Drawer.Trigger className={styles.Trigger}>Open drawer</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className={styles.Backdrop} />
          <Drawer.Viewport className={styles.Viewport}>
            <Drawer.Popup className={styles.Popup}>
              <Drawer.Title className={styles.Title}>Slider in Drawer</Drawer.Title>
              <Drawer.Description className={styles.Description}>
                Adjust the value using the slider below.
              </Drawer.Description>
              <div className={styles.SliderSection}>
                <Slider.Root min={0} max={100} step={1}>
                  <Slider.Control className={styles.SliderControl}>
                    <Slider.Track className={styles.SliderTrack}>
                      <Slider.Indicator className={styles.SliderIndicator} />
                      <Slider.Thumb aria-label="Value" className={styles.SliderThumb} />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
              </div>
              <div className={styles.Actions}>
                <Drawer.Close className={styles.Close}>Close</Drawer.Close>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
