import path from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import noUnknownDemoColors, {
  ruleName,
  // eslint-disable-next-line import/no-relative-packages
} from '../../../scripts/stylelint/no-unknown-demo-colors.mjs';

const themePath = path.resolve(import.meta.dirname, '../../src/css/index.css');

async function lint(code) {
  const result = await stylelint.lint({
    code,
    config: {
      plugins: [noUnknownDemoColors],
      rules: {
        [ruleName]: [true, { themePath }],
      },
    },
  });

  return result.results[0].warnings.map((warning) => warning.text);
}

describe(ruleName, () => {
  it('allows raw colors from the docs Tailwind theme', async () => {
    const warnings = await lint(`
      .Test {
        color: oklch(14.5% 0 0deg);
        background: white;
        border-color: black;
      }
    `);

    expect(warnings).toEqual([]);
  });

  it('allows black and white as theme colors', async () => {
    const warnings = await lint(`
      .Test {
        color: white;
        background: black;
        border: 1px solid white;
        box-shadow: 0 0 0 1px black;
        fill: black;
        stroke: white;
      }
    `);

    expect(warnings).toEqual([]);
  });

  it('allows token-derived alpha colors', async () => {
    const warnings = await lint(`
      .Test {
        box-shadow: 0.25rem 0.25rem 0 rgb(0 0 0 / 12%);
        text-shadow: 0.25rem 0.25rem 0 rgb(255 255 255 / 12%);
        background: color-mix(in oklch, oklch(42.4% 0.199 265.638deg), transparent 90%);
        outline: color-mix(in oklch, black, white 50%);
      }
    `);

    expect(warnings).toEqual([]);
  });

  it('rejects unknown color syntaxes', async () => {
    const warnings = await lint(`
      .Test {
        color: red;
        background-color: #000;
        border-color: oklch(45% 50% 264deg);
        outline-color: papaywhip;
        box-shadow: 0 0 0 1px blue;
      }
    `);

    expect(warnings).toHaveLength(5);
    expect(warnings[0]).toContain('Unexpected demo color "red"');
    expect(warnings[1]).toContain('Unexpected demo color "#000"');
    expect(warnings[2]).toContain('Unexpected demo color "oklch(45% 50% 264deg)"');
    expect(warnings[3]).toContain('Unexpected demo color "papaywhip"');
    expect(warnings[4]).toContain('Unexpected demo color "blue"');
  });

  it('requires rgb black and white derivations to include alpha', async () => {
    const warnings = await lint(`
      .Test {
        box-shadow: 0 0 0 rgb(0 0 0);
        text-shadow: 0 0 0 rgb(255, 255, 255);
        filter: drop-shadow(0 1px 1px rgb(0 0 0 / 53%));
      }
    `);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('Unexpected demo color "rgb(0 0 0)"');
    expect(warnings[1]).toContain('Unexpected demo color "rgb(255, 255, 255)"');
  });

  it('rejects CSS variables used as colors', async () => {
    const warnings = await lint(`
      .Test {
        color: var(--accent);
        border-color: var(--color-red-700);
        background: color-mix(in oklch, var(--accent), transparent 90%);
        margin: var(--space);
      }
    `);

    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('Unexpected demo color "var(--accent)"');
    expect(warnings[1]).toContain('Unexpected demo color "var(--color-red-700)"');
    expect(warnings[2]).toContain('Unexpected demo color "var(--accent)"');
  });

  it('does not treat named non-color property values as colors', async () => {
    const warnings = await lint(`
      .Test {
        grid-area: red;
        view-transition-name: blue;
      }
    `);

    expect(warnings).toEqual([]);
  });

  it('does not treat strings or URLs as colors', async () => {
    const warnings = await lint(`
      .Test {
        background-image: url("#red");
        content: "blue";
      }
    `);

    expect(warnings).toEqual([]);
  });
});
