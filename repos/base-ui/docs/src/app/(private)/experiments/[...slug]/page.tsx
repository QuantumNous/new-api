import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globby } from 'globby';
import { Sidebar } from '../_components/Sidebar';
import { ExperimentRoot } from '../_components/ExperimentRoot';
import classes from '../_components/ExperimentRoot.module.css';
import { ExperimentSettingsProvider } from '../_components/SettingsPanel';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const experimentsRootDirectory = resolve(currentDirectory, '..');

interface Props {
  params: Promise<{
    slug: string[];
  }>;
}

export default async function Page(props: Props) {
  const { slug } = await props.params;

  const fullPath = resolve(currentDirectory, `../${slug.join('/')}.tsx`);

  try {
    const experimentModule = await import(`../${slug.join('/')}.tsx`);
    const Experiment = experimentModule.default;
    const settingsMetadata = experimentModule.settingsMetadata;

    return (
      <ExperimentSettingsProvider metadata={settingsMetadata}>
        <ExperimentRoot
          sidebar={
            <Sidebar
              experimentPath={fullPath}
              className={classes.sidebar}
              settingsMetadata={settingsMetadata}
            />
          }
        >
          <Experiment />
        </ExperimentRoot>
      </ExperimentSettingsProvider>
    );
  } catch (error) {
    notFound();
  }
}

export async function generateStaticParams() {
  const files = await globby(
    ['**/*.tsx', '!infra/**/*', '!**/page.tsx', '!**/layout.tsx', '!_components/**/*'],
    {
      cwd: experimentsRootDirectory,
    },
  );

  return files
    .filter((file) => file.split('/').length <= 2)
    .map((file) => {
      return {
        slug: file.replace(/\.tsx$/, '').split('/'),
      };
    });
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;

  return {
    title: `${slug[slug.length - 1]} - Experiments`,
  };
}
