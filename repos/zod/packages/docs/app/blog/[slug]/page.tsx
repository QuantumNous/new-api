import { blog } from "@/loaders/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";

export const revalidate = false;

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = blog.getPage([params.slug]) as any;

  if (!page) notFound();
  const Mdx = page.data.body as ComponentType<any>;
  const author: string = (page.data?.author as string | undefined) ?? "Colin McDonnell";
  const dateValue = page.data?.date as string | Date | undefined;
  const formattedDate = dateValue
    ? new Date(dateValue).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : undefined;

  return (
    <>
      <header className="container px-4">
        <div className="mx-auto max-w-3xl py-10 md:py-14">
          {page.data.title ? (
            <>
              <nav className="mb-0">
                <Link href="/blog" className="text-base text-fd-muted-foreground hover:text-fd-foreground">
                  Blog /
                </Link>
              </nav>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-3">
                {page.data.title}
              </h1>
            </>
          ) : null}
          {/* {page.data.description ? (
            <p className="text-lg text-fd-muted-foreground mb-4">{page.data.description}</p>
          ) : null} */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-fd-muted-foreground">
            <a href="https://x.com/colinhacks" className="font-medium underline underline-offset-2">
              {author}
            </a>
            {formattedDate ? <span className="opacity-60">•</span> : null}
            {formattedDate ? <time dateTime={new Date(dateValue as any).toISOString()}>{formattedDate}</time> : null}
          </div>
        </div>
      </header>
      <article className="container px-4">
        <div className="mx-auto max-w-3xl flex flex-col py-6 md:py-10">
          <div className="prose prose-lg min-w-0">
            <Mdx components={defaultMdxComponents} />
          </div>
          <div className="mt-10 pt-6 border-t text-sm text-fd-muted-foreground">
            <p>
              Written by{" "}
              <a href="https://x.com/colinhacks" className="font-medium underline underline-offset-2">
                {author}
              </a>
              {formattedDate ? (
                <>
                  {" "}
                  on <time dateTime={new Date(dateValue as any).toISOString()}>{formattedDate}</time>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </article>
    </>
  );
}

export function generateStaticParams(): { slug: string }[] {
  return blog.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = blog.getPage([params.slug]) as any;

  if (!page) notFound();

  return {
    title: (page.data?.title as string | undefined) ?? params.slug,
    description: (page.data?.description as string | undefined) ?? undefined,
  };
}
