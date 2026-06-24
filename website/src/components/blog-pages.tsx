import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Search, X } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { formatBlogCopy, type BlogCopy } from "@/lib/blog-copy";
import {
  BLOG_PAGE_SIZE,
  formatBlogDate,
  getBlogCategories,
  getBlogPost,
  getBlogPosts,
  getBlogToc,
  sanitizeBlogHtml,
  type BlogPost,
} from "@/lib/blog";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import {
  buildBlogArticleSchema,
  buildBlogCategorySchema,
  buildBlogIndexSchema,
  stringifyJsonLd,
  type JsonLdGraph,
} from "@/lib/schema";
import { cn } from "@/lib/utils";

type BlogSearchState = {
  page?: number;
  q?: string;
};

type Props = {
  locale: Locale;
};

function JsonLdScript(props: { data: JsonLdGraph }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(props.data) }} />;
}

function Badge(props: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground",
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

function buttonClass(variant: "primary" | "outline" | "ghost" = "primary") {
  if (variant === "outline") {
    return "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted";
  }
  if (variant === "ghost") {
    return "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted";
  }
  return "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90";
}

function buildQuery(search?: BlogSearchState) {
  const params = new URLSearchParams();
  if (search?.page && search.page > 1) params.set("page", String(search.page));
  if (search?.q) params.set("q", search.q);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseQuery(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const query = raw?.trim();
  return query || undefined;
}

export function parseBlogSearch(searchParams?: Record<string, string | string[] | undefined>): BlogSearchState {
  return {
    page: parsePage(searchParams?.page),
    q: parseQuery(searchParams?.q),
  };
}

function BlogHero(props: {
  locale: Locale;
  title: string;
  description: string;
  copy: BlogCopy;
  query?: string;
  categorySlug?: string;
}) {
  const action = props.categorySlug ? `/blog/category/${props.categorySlug}` : "/blog";

  return (
    <section className="border-b border-border/50 bg-muted/30 pt-28 pb-14 text-center">
      <div className="container mx-auto max-w-5xl px-4">
        <Badge className="mb-5">
          <BookOpen className="size-3.5" />
          flatkey.ai
        </Badge>
        <h1 className="text-foreground text-4xl leading-[1.08] font-semibold text-balance md:text-5xl md:leading-[1.05]">
          {props.title}
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 text-balance md:text-lg">
          {props.description}
        </p>
        <form className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row" action={localizePath(action, props.locale)}>
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              name="q"
              defaultValue={props.query ?? ""}
              placeholder={props.copy.searchPlaceholder}
              className="border-input bg-background h-11 w-full rounded-lg border px-3 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/15"
              type="search"
            />
          </div>
          <button className={cn(buttonClass(), "h-11 px-5")} type="submit">
            <Search className="size-4" />
            {props.copy.search}
          </button>
          {props.query ? (
            <Link className={cn(buttonClass("outline"), "h-11 px-5")} href={localizePath(action, props.locale)}>
              <X className="size-4" />
              {props.copy.clear}
            </Link>
          ) : null}
        </form>
      </div>
    </section>
  );
}

async function BlogCategories(props: { locale: Locale }) {
  const categories = await getBlogCategories();
  const copy = getCopy(props.locale).blog;

  if (categories.length === 0) return null;

  return (
    <div className="mt-10 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={localizePath(`/blog/category/${category.slug}`, props.locale)}
          className="border-border bg-card hover:border-primary/35 block rounded-lg border p-5 transition-colors"
        >
          <h2 className="text-foreground font-semibold">{category.name}</h2>
          <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
            {category.description || formatBlogCopy(copy.latestInCategory, { category: category.name })}
          </p>
          <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
            {copy.readMore}
            <ArrowRight className="size-3.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

function BlogCard(props: { post: BlogPost; locale: Locale; compact?: boolean }) {
  const date = formatBlogDate(props.post.date, "short", props.locale);

  return (
    <Link
      href={localizePath(`/blog/${props.post.slug}`, props.locale)}
      className="border-border/70 bg-card group flex min-h-full flex-col overflow-hidden rounded-lg border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {props.post.cover ? (
        <div className="bg-muted aspect-[16/9] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.post.cover}
            alt={props.post.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="from-primary/15 via-muted to-secondary/20 aspect-[16/9] bg-linear-to-br" />
      )}
      <div className={cn("flex flex-1 flex-col p-5", props.compact && "p-4")}>
        {props.post.categoryName ? <Badge className="mb-3 max-w-fit">{props.post.categoryName}</Badge> : null}
        <h2
          className={cn(
            "text-foreground group-hover:text-primary line-clamp-2 font-semibold transition-colors",
            props.compact ? "text-sm leading-snug" : "text-base leading-snug"
          )}
        >
          {props.post.title}
        </h2>
        {props.post.summary && !props.compact ? (
          <p className="text-muted-foreground mt-3 line-clamp-3 flex-1 text-sm leading-6">{props.post.summary}</p>
        ) : null}
        <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-2 text-xs">
          {date ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {date}
            </span>
          ) : null}
          {props.post.author ? <span>{props.post.author}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function BlogPagination(props: { locale: Locale; pageNo: number; totalPages: number; query?: string; categorySlug?: string }) {
  if (props.totalPages <= 1) return null;
  const copy = getCopy(props.locale).blog;
  const basePath = props.categorySlug ? `/blog/category/${props.categorySlug}` : "/blog";
  const prevPage = props.pageNo - 1;
  const nextPage = props.pageNo + 1;

  return (
    <nav className="mt-14 flex flex-wrap items-center justify-center gap-3">
      {props.pageNo > 1 ? (
        <Link
          className={buttonClass("outline")}
          href={`${localizePath(basePath, props.locale)}${buildQuery({ page: prevPage, q: props.query })}`}
        >
          <ArrowLeft className="size-4" />
          {copy.previous}
        </Link>
      ) : null}
      <span className="text-muted-foreground text-sm">
        {formatBlogCopy(copy.pageOf, { page: props.pageNo, total: props.totalPages })}
      </span>
      {props.pageNo < props.totalPages ? (
        <Link
          className={buttonClass("outline")}
          href={`${localizePath(basePath, props.locale)}${buildQuery({ page: nextPage, q: props.query })}`}
        >
          {copy.next}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

function BlogCTA(props: { locale: Locale }) {
  const copy = getCopy(props.locale).blog;

  return (
    <section className="bg-foreground text-background mt-20 rounded-lg px-6 py-12 text-center sm:px-10">
      <h2 className="text-2xl font-semibold">{copy.ctaTitle}</h2>
      <p className="text-background/75 mx-auto mt-3 max-w-2xl text-sm leading-6">
        {copy.ctaDescription}
      </p>
      <Link className={cn(buttonClass(), "mt-7 bg-background text-foreground hover:bg-background/90")} href={consoleUrl("/sign-up")}>
        {copy.ctaButton}
      </Link>
    </section>
  );
}

function EmptyBlogState(props: { locale: Locale }) {
  const copy = getCopy(props.locale).blog;

  return (
    <div className="border-border bg-card flex min-h-64 flex-col items-center justify-center rounded-lg border px-6 py-14 text-center">
      <BookOpen className="text-muted-foreground size-10" />
      <h2 className="mt-4 text-lg font-semibold">{copy.emptyTitle}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{copy.emptyDescription}</p>
    </div>
  );
}

export async function BlogIndexPage(props: Props & { search?: BlogSearchState }) {
  const page = props.search?.page ?? 1;
  const query = props.search?.q;
  const posts = await getBlogPosts({ page, q: query }, props.locale);
  const totalPages = Math.ceil(posts.total / BLOG_PAGE_SIZE);
  const copy = getCopy(props.locale).blog;

  return (
    <SiteShell locale={props.locale} pathname="/blog">
      <JsonLdScript data={buildBlogIndexSchema({ locale: props.locale, title: copy.title, description: copy.description })} />
      <main>
        <BlogHero
          locale={props.locale}
          title={copy.title}
          description={copy.description}
          copy={copy}
          query={query}
        />
        <section className="container mx-auto max-w-6xl px-4 py-14">
          <BlogCategories locale={props.locale} />
        </section>
        <section className="container mx-auto max-w-6xl px-4 pb-20">
          {posts.list.length === 0 ? (
            <EmptyBlogState locale={props.locale} />
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.list.map((post) => (
                  <BlogCard key={post.id || post.slug} post={post} locale={props.locale} />
                ))}
              </div>
              <BlogPagination pageNo={page} totalPages={totalPages} query={query} locale={props.locale} />
              <BlogCTA locale={props.locale} />
            </>
          )}
        </section>
      </main>
    </SiteShell>
  );
}

export async function BlogArticlePage(props: Props & { slug: string }) {
  const post = await getBlogPost(props.slug, props.locale);
  if (!post) notFound();
  const currentPost = post;

  const relatedPosts = await getBlogPosts(
    { page: 1, categoryIds: currentPost.categoryId ? [currentPost.categoryId] : undefined },
    props.locale
  );
  const related = relatedPosts.list.filter((item) => item.slug !== props.slug).slice(0, 3);
  const html = sanitizeBlogHtml(currentPost.content ?? "", props.locale);
  const toc = getBlogToc(html);
  const copy = getCopy(props.locale).blog;

  return (
    <SiteShell locale={props.locale} pathname={`/blog/${props.slug}`}>
      <JsonLdScript data={buildBlogArticleSchema({ locale: props.locale, post })} />
      <main>
        <section className="border-b border-border/50 bg-muted/30 pt-28 pb-12">
          <div className="container mx-auto max-w-4xl px-4">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {currentPost.categoryName ? <Badge>{currentPost.categoryName}</Badge> : null}
              {currentPost.date ? <span className="text-muted-foreground text-sm">{formatBlogDate(currentPost.date, "long", props.locale)}</span> : null}
              {currentPost.author ? <span className="text-muted-foreground text-sm">{currentPost.author}</span> : null}
            </div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              {currentPost.title}
            </h1>
            {currentPost.summary ? (
              <p className="text-muted-foreground mt-5 max-w-3xl text-base leading-7 text-balance md:text-lg">{currentPost.summary}</p>
            ) : null}
          </div>
        </section>
        {currentPost.cover ? (
          <div className="container mx-auto max-w-4xl px-4 py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPost.cover}
              alt={currentPost.title}
              className="bg-muted aspect-[16/9] w-full rounded-lg object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        <section className="container mx-auto max-w-5xl px-4 py-8">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="blog-content min-w-0" dangerouslySetInnerHTML={{ __html: html }} />
            {toc.length >= 2 ? (
              <aside className="hidden lg:block">
                <nav className="sticky top-24 text-sm">
                  <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">{copy.onThisPage}</p>
                  <ul className="space-y-1.5">
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={cn(
                            "block leading-snug transition-colors text-muted-foreground hover:text-foreground",
                            item.level === 3 && "pl-3"
                          )}
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            ) : null}
          </div>
        </section>
        {related.length > 0 ? (
          <section className="mt-10 border-t border-border/50 py-16">
            <div className="container mx-auto max-w-5xl px-4">
              <h2 className="text-xl font-semibold">{copy.relatedArticles}</h2>
              <div className="mt-7 grid gap-5 sm:grid-cols-3">
                {related.map((item) => (
                  <BlogCard key={item.id || item.slug} post={item} locale={props.locale} compact />
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <div className="container mx-auto max-w-5xl px-4 pb-16">
          <Link className={buttonClass("ghost")} href={localizePath("/blog", props.locale)}>
            <ArrowLeft className="size-4" />
            {copy.backToBlog}
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}

export async function BlogCategoryPage(props: Props & { slug: string; search?: BlogSearchState }) {
  const categories = await getBlogCategories();
  const category = categories.find((item) => item.slug === props.slug);
  if (!category) notFound();
  const currentCategory = category;

  const page = props.search?.page ?? 1;
  const query = props.search?.q;
  const posts = await getBlogPosts({ page, q: query, categoryIds: [currentCategory.id] }, props.locale);
  const totalPages = Math.ceil(posts.total / BLOG_PAGE_SIZE);
  const copy = getCopy(props.locale).blog;
  const description = currentCategory.description || formatBlogCopy(copy.latestInCategory, { category: currentCategory.name });

  return (
    <SiteShell locale={props.locale} pathname={`/blog/category/${props.slug}`}>
      <JsonLdScript data={buildBlogCategorySchema({ locale: props.locale, slug: props.slug, name: category.name, description })} />
      <main>
        <BlogHero locale={props.locale} title={currentCategory.name} description={description} copy={copy} query={query} categorySlug={props.slug} />
        <section className="container mx-auto max-w-6xl px-4 py-12">
          <Link className={buttonClass("ghost")} href={localizePath("/blog", props.locale)}>
            <ArrowLeft className="size-4" />
            {copy.backToBlog}
          </Link>
        </section>
        <section className="container mx-auto max-w-6xl px-4 pb-20">
          {posts.list.length === 0 ? (
            <EmptyBlogState locale={props.locale} />
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.list.map((post) => (
                  <BlogCard key={post.id || post.slug} post={post} locale={props.locale} />
                ))}
              </div>
              <BlogPagination
                pageNo={page}
                totalPages={totalPages}
                query={query}
                categorySlug={props.slug}
                locale={props.locale}
              />
              <BlogCTA locale={props.locale} />
            </>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
