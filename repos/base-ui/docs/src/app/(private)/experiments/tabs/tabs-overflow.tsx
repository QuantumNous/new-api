'use client';
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import classes from './tabs-overflow.module.css';

const OVERFLOW_LABELS = Array.from({ length: 20 }, (_, index) => `Tab ${index + 1}`);

const VARIANTS = [
  {
    title: 'Micro copy',
    description: 'Tiny labels emulate condensed navigation without wrapping.',
    fontSize: '0.75rem',
    labels: ['Home', 'Docs', 'Blog', 'Team'],
  },
  {
    title: 'Standard size',
    description: 'Default typography with four concise tabs.',
    styles: {
      fontSize: '1rem',
      border: '2px solid black',
    },
    labels: ['Overview', 'Features', 'Releases', 'Support'],
  },
  {
    title: 'All caps',
    description: 'Uppercase words stretch to the indicator boundary.',
    styles: {
      fontSize: '0.85rem',
      border: '4px solid black',
    },
    labels: ['CODE', 'GUIDES', 'API', 'STATUS'],
  },
  {
    title: 'Overflow check',
    description: 'Twenty tabs make the list exceed the container and force scrolling.',
    fontSize: '0.85rem',
    labels: OVERFLOW_LABELS,
  },
];

export default function TabsOverflowExperiment() {
  const [activeValues, setActiveValues] = React.useState(() => VARIANTS.map(() => 0));

  const handleValueChange = (variantIndex: number) => (value: number) => {
    setActiveValues((prev) => {
      const next = [...prev];
      next[variantIndex] = value;
      return next;
    });
  };

  return (
    <section className={classes.experiment}>
      <h1>Indicator precision check</h1>
      {VARIANTS.map((variant, index) => (
        <article className={classes.variant} key={variant.title}>
          <div>
            <h2 className={classes.variantTitle}>{variant.title}</h2>
            <p className={classes.variantSubtitle}>{variant.description}</p>
          </div>
          <div className={classes.variantBody}>
            <Tabs.Root
              className={classes.tabs}
              value={activeValues[index]}
              onValueChange={handleValueChange(index)}
            >
              <Tabs.List className={classes.list} style={variant.styles}>
                {variant.labels.map((label, tabIndex) => (
                  <Tabs.Tab className={classes.tab} key={label} value={tabIndex}>
                    {label}
                  </Tabs.Tab>
                ))}
                <Tabs.Indicator className={classes.indicator} renderBeforeHydration />
              </Tabs.List>
            </Tabs.Root>
          </div>
        </article>
      ))}
    </section>
  );
}
