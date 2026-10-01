import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type Dirent } from 'node:fs';
import { basename, extname } from 'node:path';
import { readdir } from 'node:fs/promises';

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

const DUMMY_SLUG = '_';

export default async function Page(props: Props) {
  const { slug } = await props.params;

  if (slug === DUMMY_SLUG) {
    notFound();
  }

  try {
    const Playground = (await import(`../${slug}.tsx`)).default;
    return <Playground />;
  } catch (error) {
    notFound();
  }
}

export async function generateStaticParams() {
  const routes = (
    await readdir('src/app/(private)/playground', { withFileTypes: true })
  )
    .filter(
      (entry: Dirent) =>
        entry.name.endsWith('.tsx') && entry.name !== 'page.tsx' && entry.isFile(),
    )
    .map((entry: Dirent) => ({ slug: basename(entry.name, extname(entry.name)) }));

  if (routes.length === 0) {
    return [{ slug: DUMMY_SLUG }];
  }

  return routes;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;

  return {
    title: `${slug} - Playground`,
  };
}
