import { describe, expect, it } from 'vitest';
import { createParseSource } from '@mui/internal-docs-infra/pipeline/parseSource';
import { exportOpts } from './demoExportOptions';

type HeadTemplate = NonNullable<typeof exportOpts.headTemplate>;
type HeadTemplateProps = Parameters<HeadTemplate>[0];
type ExtraFiles = NonNullable<HeadTemplateProps['variant']>['extraFiles'];

function getTailwindHeadTemplate(
  source: NonNullable<HeadTemplateProps['variant']>['source'],
  extraFiles?: ExtraFiles,
) {
  const headTemplate = exportOpts.headTemplate;
  if (!headTemplate) {
    throw new Error('Expected exportOpts.headTemplate to be defined');
  }

  const props: HeadTemplateProps = {
    sourcePrefix: '',
    assetPrefix: '',
    variantName: 'Tailwind',
    variant: {
      source,
      extraFiles,
    },
  };

  return headTemplate(props);
}

function getInjectedClasses(headTemplate: string) {
  const metaClassMatch = headTemplate.match(/<meta name="custom" class="([^"]+)" \/>/);
  if (!metaClassMatch) {
    throw new Error('Expected Tailwind class injection meta tag to be present');
  }

  return metaClassMatch[1].split(/\s+/);
}

function getInjectedClassAttribute(headTemplate: string) {
  const metaClassMatch = headTemplate.match(/<meta name="custom" class="([^"]+)" \/>/);
  if (!metaClassMatch) {
    throw new Error('Expected Tailwind class injection meta tag to be present');
  }

  return metaClassMatch[1];
}

describe('exportOpts Tailwind class injection', () => {
  it('uses the Tailwind v4 browser runtime for StackBlitz exports', () => {
    const headTemplate = getTailwindHeadTemplate(`
      export default function Demo() {
        return <div className="outline-1 outline-gray-200">Demo</div>;
      }
    `);

    expect(headTemplate).toContain('https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4');
    expect(headTemplate).not.toContain('https://cdn.tailwindcss.com');
  });

  it('injects classes referenced via concatenated className constants', () => {
    const source = `
      const popupClassName =
        "data-[starting-style]:opacity-0 transition-transform " +
        "duration-300";

      export default function Demo() {
        return <div className={popupClassName}>Demo</div>;
      }
    `;

    const headTemplate = getTailwindHeadTemplate(source);
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('data-[starting-style]:opacity-0');
    expect(classes).toContain('transition-transform');
    expect(classes).toContain('duration-300');
  });

  it('injects classes from derived template literals referenced via className constants', () => {
    const source = `
      const sharedClassName =
        "transition-transform duration-300";
      const popupClassName = \`\${sharedClassName} data-[starting-style]:opacity-0\`;

      export default function Demo() {
        return <div className={popupClassName}>Demo</div>;
      }
    `;

    const headTemplate = getTailwindHeadTemplate(source);
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('transition-transform');
    expect(classes).toContain('duration-300');
    expect(classes).toContain('data-[starting-style]:opacity-0');
  });

  it('injects classes from inline template expressions that reference constants', () => {
    const source = `
      const itemClassName =
        "transition-transform duration-300";

      export default function Demo() {
        return <div className={\`\${itemClassName} text-red-600\`}>Demo</div>;
      }
    `;

    const headTemplate = getTailwindHeadTemplate(source);
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('transition-transform');
    expect(classes).toContain('duration-300');
    expect(classes).toContain('text-red-600');
  });

  it('injects classes from highlighted HAST sources without stringifying them first', async () => {
    const parseSource = await createParseSource();
    const source = parseSource(
      `
        const sharedClassName = "transition-transform duration-300";
        const itemClassName = \`\${sharedClassName} text-red-600\`;

        export default function Demo() {
          return <div className={itemClassName}>Demo</div>;
        }
      `,
      'demo.tsx',
    );

    const headTemplate = getTailwindHeadTemplate(source);
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('transition-transform');
    expect(classes).toContain('duration-300');
    expect(classes).toContain('text-red-600');
  });

  it('injects classes from highlighted HAST string literals', async () => {
    const parseSource = await createParseSource();
    const source = parseSource(
      `
        export default function Demo() {
          return <div className="flex p-4 text-red-600">Demo</div>;
        }
      `,
      'demo.tsx',
    );

    const headTemplate = getTailwindHeadTemplate(source);
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('flex');
    expect(classes).toContain('p-4');
    expect(classes).toContain('text-red-600');
  });

  it('injects classes from extra files referenced via derived className constants', () => {
    const headTemplate = getTailwindHeadTemplate(
      `
        export default function Demo() {
          return <Extra />;
        }
      `,
      {
        'Extra.tsx': {
          source: `
            const sharedClassName = "data-[ending-style]:opacity-0";
            const contentClassName = \`\${sharedClassName} translate-x-2\`;

            export function Extra() {
              return <div className={contentClassName}>Extra</div>;
            }
          `,
        },
      },
    );
    const classes = getInjectedClasses(headTemplate);

    expect(classes).toContain('data-[ending-style]:opacity-0');
    expect(classes).toContain('translate-x-2');
  });

  it('escapes the injected class attribute value to prevent HTML injection', () => {
    const source = `
      const popupClassName = 'safe " onclick="alert(1) <script>alert(2)</script>';

      export default function Demo() {
        return <div className={popupClassName}>Demo</div>;
      }
    `;

    const headTemplate = getTailwindHeadTemplate(source);
    const classAttribute = getInjectedClassAttribute(headTemplate);

    expect(classAttribute).toContain('&quot;');
    expect(classAttribute).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(classAttribute).not.toContain('<script>');
    expect(classAttribute).not.toContain('" onclick=');
  });
});
