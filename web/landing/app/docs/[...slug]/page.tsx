import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsTableOfContents } from "@/components/docs/docs-table-of-contents";
import { DocumentPagination } from "@/components/docs/document-pagination";
import { Markdown } from "@/components/docs/markdown";
import { Separator } from "@/components/ui/separator";
import { getAdjacentDocuments, getAllDocuments, getDocument } from "@/lib/docs/content";
import { getTableOfContents } from "@/lib/docs/toc";

interface DocPageProps {
  params: Promise<{ slug: string[] }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDocuments().map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getDocument(slug);

  if (!document) return {};

  return {
    title: document.title,
    description: document.description,
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const document = getDocument(slug);

  if (!document) notFound();

  const tableOfContents = getTableOfContents(document.content);
  const { previous, next } = getAdjacentDocuments(document);

  return (
    <main id="main-content" className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_15rem]">
      <article className="mx-auto min-w-0 w-full max-w-[46rem] px-5 py-12 sm:px-8 lg:py-16 xl:px-6">
        <header>
          <h1 className="font-semibold tracking-[-0.035em] text-neutral-900 [font-size:var(--docs-text-h1)] [line-height:1.15]">
            {document.title}
          </h1>
          {document.description && (
            <p className="mt-3 leading-7 text-neutral-700 [font-size:var(--docs-text-base)]">
              {document.description}
            </p>
          )}
        </header>

        <Separator className="my-8" />

        <div>
          <Markdown content={document.content} />
        </div>

        <DocumentPagination previous={previous} next={next} />
      </article>

      {tableOfContents.length > 0 && (
        <aside className="sticky top-0 hidden h-fit w-full max-w-[13rem] justify-self-end py-10 pr-6 xl:block">
          <DocsTableOfContents key={document.slug.join("/")} items={tableOfContents} />
        </aside>
      )}
    </main>
  );
}
