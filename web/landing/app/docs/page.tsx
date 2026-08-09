import { DocsTableOfContents } from "@/components/docs/docs-table-of-contents";
import { Markdown } from "@/components/docs/markdown";
import { Separator } from "@/components/ui/separator";
import { getDocsIndexDocument } from "@/lib/docs/content";
import { getTableOfContents } from "@/lib/docs/toc";

export default function DocsIndexPage() {
  const document = getDocsIndexDocument();
  const tableOfContents = getTableOfContents(document.content);

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

        <Markdown content={document.content} />
      </article>

      {tableOfContents.length > 0 && (
        <aside className="sticky top-0 hidden h-fit w-full max-w-[13rem] justify-self-end py-10 pr-6 xl:block">
          <DocsTableOfContents key="docs-index" items={tableOfContents} />
        </aside>
      )}
    </main>
  );
}
