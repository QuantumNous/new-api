import { MobileDocsBar } from '@vercel/geistdocs/mobile-docs-bar';
import { createDocsPage } from '@vercel/geistdocs/pages/docs';
import { getMdxComponents } from '@/components/mdx-components';
import { config } from '@/lib/geistdocs/config';
import { v6Source } from '@/lib/geistdocs/source';

const docsPage = createDocsPage({
  config,
  mdx: ({ link }) => getMdxComponents({ link, versionPrefix: '' }),
  metadata: ({ metadata, page }) => ({
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: page.url,
    },
  }),
  renderTop: ({ data }) => <MobileDocsBar toc={data.toc} />,
  source: v6Source,
  tableOfContentPopover: {
    enabled: false,
  },
});

export const generateMetadata = docsPage.generateMetadata;
export const generateStaticParams = docsPage.generateStaticParams;
export default docsPage.Page;
