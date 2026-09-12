import fs from 'node:fs';
import path from 'node:path';
import {
  type Argv,
  checkCancel,
  copyFolder,
  create,
  type ESLintTemplateName,
  type RslintTemplateName,
  select,
} from 'create-rstack';
import {
  addPluginsToRsbuildConfig,
  enableReactCompilerInRsbuildConfig,
  tailwindcssPlugin,
} from './rsbuildConfig.js';

const frameworkAlias: Record<string, string> = {
  vue3: 'vue',
  'solid-js': 'solid',
};

async function getTemplateName({ template }: Argv) {
  if (typeof template === 'string') {
    const pair = template.split('-');
    const language = pair[1] ?? 'js';
    const framework = pair[0];

    return `${frameworkAlias[framework] ?? framework}-${language}`;
  }

  const framework = checkCancel<string>(
    await select({
      message: 'Select framework',
      options: [
        { value: 'vanilla', label: 'Vanilla' },
        { value: 'react', label: 'React' },
        { value: 'vue', label: 'Vue' },
        { value: 'lit', label: 'Lit' },
        { value: 'preact', label: 'Preact' },
        { value: 'svelte', label: 'Svelte' },
        { value: 'solid', label: 'Solid' },
      ],
    }),
  );

  const language = checkCancel<string>(
    await select({
      message: 'Select language',
      options: [
        { value: 'ts', label: 'TypeScript' },
        { value: 'js', label: 'JavaScript' },
      ],
    }),
  );

  return `${framework}-${language}`;
}

function mapESLintTemplate(templateName: string): ESLintTemplateName {
  switch (templateName) {
    case 'react-js':
    case 'react-ts':
    case 'svelte-js':
    case 'svelte-ts':
      return templateName;
    case 'vue-js':
    case 'vue3-js':
      return 'vue-js';
    case 'vue-ts':
    case 'vue3-ts':
      return 'vue-ts';
    default:
      return `vanilla-${templateName.split('-')[1]}` as ESLintTemplateName;
  }
}

function mapRstestTemplate(templateName: string): string {
  switch (templateName) {
    case 'react-js':
      return 'react-js';
    case 'react-ts':
      return 'react-ts';
    case 'vue-js':
    case 'vue3-js':
      return 'vue-js';
    case 'vue-ts':
    case 'vue3-ts':
      return 'vue-ts';
    default:
      return `vanilla-${templateName.split('-')[1]}`;
  }
}

function mapRslintTemplate(templateName: string): RslintTemplateName {
  switch (templateName) {
    case 'react-js':
    case 'react-ts':
      return templateName;
    default:
      return `vanilla-${templateName.split('-')[1]}` as RslintTemplateName;
  }
}

const root = path.join(import.meta.dirname, '..');

create({
  root,
  name: 'rsbuild',
  templates: [
    'vanilla-js',
    'vanilla-ts',
    'react-js',
    'react-ts',
    'vue-js',
    'vue-ts',
    'lit-js',
    'lit-ts',
    'preact-js',
    'preact-ts',
    'svelte-js',
    'svelte-ts',
    'solid-js',
    'solid-ts',
  ],
  getTemplateName,
  mapESLintTemplate,
  mapRslintTemplate,
  extraTools: [
    {
      value: 'rstest',
      label: 'Rstest - testing',
      order: 'pre',
      action: ({ templateName, distFolder, addAgentsMdSearchDirs }) => {
        const rstestTemplate = mapRstestTemplate(templateName);
        const toolFolder = path.join(root, 'template-rstest');
        const subFolder = path.join(toolFolder, rstestTemplate);

        copyFolder({
          from: subFolder,
          to: distFolder,
          isMergePackageJson: true,
        });
        addAgentsMdSearchDirs(toolFolder);
      },
    },
    {
      value: 'react-compiler',
      label: 'React Compiler - optimization',
      order: 'pre',
      when: ({ templateName }) => ['react-js', 'react-ts'].includes(templateName),
      action: async ({ distFolder }) => {
        await enableReactCompilerInRsbuildConfig(distFolder);
      },
    },
    {
      value: 'tailwindcss',
      label: 'Tailwind CSS - styling',
      action: async ({ distFolder }) => {
        const from = path.join(root, 'template-tailwindcss');
        copyFolder({
          from: from,
          to: distFolder,
          isMergePackageJson: true,
        });

        // Insert tailwindcss import to main CSS file
        const mainCssFile = ['index.css', 'App.css'];
        for (const cssFile of mainCssFile) {
          const filePath = path.join(distFolder, 'src', cssFile);
          if (fs.existsSync(filePath)) {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            await fs.promises.writeFile(filePath, `@import 'tailwindcss';\n\n${content}`);
            break;
          }
        }

        await addPluginsToRsbuildConfig(distFolder, [tailwindcssPlugin]);
      },
    },
    {
      value: 'storybook',
      label: 'Storybook - component development',
      command: 'npm create storybook@latest -- --skip-install --features docs',
    },
  ],
  extraSkills: [
    {
      value: 'rsbuild-best-practices',
      label: 'Rsbuild best practices',
      source: 'rstackjs/agent-skills',
    },
    {
      value: 'rstest-best-practices',
      label: 'Rstest best practices',
      source: 'rstackjs/agent-skills',
      when: ({ tools }) => tools.includes('rstest'),
    },
    {
      value: 'vercel-react-best-practices',
      label: 'React best practices',
      source: 'vercel-labs/agent-skills',
      when: ({ templateName }) => templateName.startsWith('react-'),
    },
  ],
});
