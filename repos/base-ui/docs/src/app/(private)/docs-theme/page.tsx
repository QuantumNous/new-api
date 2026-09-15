import type { Metadata } from 'next';
import * as React from 'react';

import 'docs/src/css/index.css';

import styles from './page.module.css';

const coreScaleSteps = ['s1', 's2', 'c1', 'c2', 'c3', 'p1', 'p2', 't1', 't2'] as const;
const coreColorRows = ['gray', 'indigo'] as const;
const accentColorRows = ['poppy', 'blue', 'green', 'orange', 'pink', 'grape', 'lime'] as const;
const alphaColorRows = ['blackA'] as const;
const alphaScaleSteps = ['1', '2', '3', '4', '5', '6'] as const;
const allCoreRows = [...coreColorRows, ...accentColorRows];

const typefaces = [
  { token: 'font-sans', sample: 'Die Grotesk A for UI copy' },
  { token: 'font-sans-b', sample: 'Die Grotesk B for headings' },
  { token: 'font-mono', sample: 'Paper Mono for code and data' },
  { token: 'font-serif', sample: 'Georgia for editorial accents' },
] as const;

const fontWeights = [
  { token: 'font-weight-400', sample: 'Regular' },
  { token: 'font-weight-700', sample: 'Bold' },
] as const;

const fontSizeScale = ['12', '14', '15', '16', '18', '21', '24', '36', '42'] as const;
const spaceScale = ['4', '8', '12', '16', '20', '24', '28', '32', '40', '48'] as const;
const radiusScale = ['2', '3', '4', '6', '8', '12', '16', 'pill', 'circle'] as const;
const shadows = ['1', '2', '3', '4', '5'] as const;

export default function ThemePage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span aria-hidden="true">🔒</span> Private
        </p>
        <h1>Docs Theme</h1>
      </header>

      <section className={styles.section}>
        <div className={styles.colorMatrixSection}>
          <div className={styles.colorMatrixGrid}>
            <div className={styles.colorMatrixRow}>
              <div className={styles.colorMatrixHeaderCell} />
              {coreScaleSteps.map((step) => (
                <div key={`core-step-${step}`} className={styles.colorMatrixHeaderCell}>
                  {step}
                </div>
              ))}
            </div>

            {allCoreRows.map((row) => {
              const isAccentRow = accentColorRows.includes(row as (typeof accentColorRows)[number]);

              return (
                <div key={`core-row-${row}`} className={styles.colorMatrixRow}>
                  <div className={styles.colorMatrixRowLabel}>{row}</div>
                  {coreScaleSteps.map((step) => {
                    if (isAccentRow && step !== 't1') {
                      return <div key={`${row}-${step}`} />;
                    }

                    const token = isAccentRow ? `${row}-t1` : `${row}-${step}`;
                    const swatchStyle = {
                      backgroundColor: `var(--${token})`,
                      '--swatch-color': `var(--${token})`,
                    } as React.CSSProperties;

                    return (
                      <div key={token} className={styles.colorMatrixCell}>
                        <div className={styles.swatch} style={swatchStyle}>
                          <span className={styles.swatchTokenName}>--{token}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.colorMatrixSection}>
          <div className={styles.colorMatrixGrid}>
            <div className={styles.colorMatrixRow}>
              <div className={styles.colorMatrixHeaderCell} />
              {alphaScaleSteps.map((step) => (
                <div key={`alpha-step-${step}`} className={styles.colorMatrixHeaderCell}>
                  {step}
                </div>
              ))}
            </div>

            {alphaColorRows.map((row) => (
              <div
                key={`alpha-row-${row}`}
                className={`${styles.colorMatrixRow} ${styles.colorMatrixRowAlpha}`}
              >
                <div className={styles.colorMatrixRowLabel}>{row}</div>
                {alphaScaleSteps.map((step) => {
                  const token = `${row}-${step}`;
                  const swatchStyle = {
                    backgroundColor: `var(--${token})`,
                    '--swatch-color': `var(--${token})`,
                  } as React.CSSProperties;

                  return (
                    <div key={token} className={styles.colorMatrixCell}>
                      <div className={styles.swatch} style={swatchStyle}>
                        <span className={styles.swatchTokenName}>--{token}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.typeGrid}>
          {typefaces.map((typeface) => (
            <article key={typeface.token} className={styles.typeCard}>
              <p className={styles.tokenName}>--{typeface.token}</p>
              <p className={styles.typeSample} style={{ fontFamily: `var(--${typeface.token})` }}>
                {typeface.sample}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.typeScale}>
          {fontSizeScale.map((step) => (
            <article key={step} className={styles.typeScaleRow}>
              <p className={styles.tokenName}>--font-size-{step}</p>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: `var(--font-size-${step})`,
                }}
              >
                The quick brown fox jumps over the lazy dog.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.typeGrid}>
          {fontWeights.map((weight) => (
            <article key={weight.token} className={styles.typeCard}>
              <p className={styles.tokenName}>--{weight.token}</p>
              <p
                className={styles.typeSample}
                style={{ fontFamily: 'var(--font-sans)', fontWeight: `var(--${weight.token})` }}
              >
                {weight.sample}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.spaceList}>
          {spaceScale.map((step) => (
            <article key={step} className={styles.spaceRow}>
              <p className={styles.tokenName}>--space-{step}</p>
              <div className={styles.spaceBar} style={{ width: `var(--space-${step})` }} />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.radiusGrid}>
          {radiusScale.map((step) => (
            <article key={step} className={styles.radiusCard}>
              <p className={styles.tokenName}>--radius-{step}</p>
              <div
                className={`${styles.radiusShape} ${step === 'pill' ? styles.radiusShapePill : styles.radiusShapeSquare}`}
                style={{
                  borderRadius: `var(--radius-${step})`,
                }}
              />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shadowGrid}>
          {shadows.map((step) => (
            <article key={step} className={styles.shadowCard}>
              <p className={styles.tokenName}>--shadow-{step}</p>
              <div
                className={styles.shadowSurface}
                style={{ boxShadow: `var(--shadow-${step})` }}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export const metadata: Metadata = {
  title: 'Docs Theme',
  robots: {
    index: false,
    follow: false,
  },
};
