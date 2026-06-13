import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getBlogCategories, getBlogPost, getBlogPosts, sanitizeBlogHtml } from "@/lib/blog";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";

type Props = {
  locale: Locale;
};

export async function BlogIndexPage(props: Props) {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  return (
    <SiteShell locale={props.locale} pathname="/blog">
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70"
        />
        <section className="relative z-10 mx-auto max-w-6xl py-14 md:py-20">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">Blog</p>
          <h1 className="max-w-4xl text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">
            AI API operations, routing, and model infrastructure
          </h1>
          <p className="text-muted-foreground/80 mt-5 max-w-2xl text-base leading-relaxed md:text-[15px]">
            Server-rendered articles from flatkey.ai with canonical metadata and crawlable links.
          </p>
        </section>
      {categories.length > 0 ? (
        <nav className="relative z-10 mx-auto mb-8 flex max-w-6xl flex-wrap items-center gap-3" aria-label="Blog categories">
          {categories.map((category) => (
            <Link
              key={category.slug}
              className="rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium text-foreground/80 shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs"
              href={localizePath(`/blog/category/${category.slug}`, props.locale)}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        {posts.list.map((post) => (
          <article key={post.slug} className="rounded-xl border border-violet-500/15 bg-white/80 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm">
            <Link className="block p-7" href={localizePath(`/blog/${post.slug}`, props.locale)}>
              <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
              <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-7">{post.summary}</p>
              <span className="text-muted-foreground/70 mt-5 block text-xs">{post.date}</span>
            </Link>
          </article>
        ))}
      </section>
      </main>
    </SiteShell>
  );
}

export async function BlogArticlePage(props: Props & { slug: string }) {
  const post = await getBlogPost(props.slug);
  if (!post) notFound();

  return (
    <SiteShell locale={props.locale} pathname={`/blog/${props.slug}`}>
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24">
      <article className="relative z-10 mx-auto max-w-3xl">
        <header className="border-b border-violet-500/10 py-14 md:py-20">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{post.categoryName ?? "Blog"}</p>
          <h1 className="text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">{post.title}</h1>
          {post.summary ? <p className="text-muted-foreground/80 mt-5 text-base leading-relaxed md:text-[15px]">{post.summary}</p> : null}
          {post.date ? <time className="text-muted-foreground/70 mt-5 block text-xs" dateTime={post.date}>{post.date}</time> : null}
        </header>
        <div
          className="article-body mt-10 rounded-2xl border border-violet-500/15 bg-white/80 p-7 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm md:p-10"
          dangerouslySetInnerHTML={{
            __html: sanitizeBlogHtml(post.content ?? ""),
          }}
        />
      </article>
      </main>
    </SiteShell>
  );
}

export async function BlogCategoryPage(props: Props & { slug: string }) {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const category = categories.find((item) => item.slug === props.slug);
  const filteredPosts = posts.list.filter((post) => post.categorySlug === props.slug);
  return (
    <SiteShell locale={props.locale} pathname={`/blog/category/${props.slug}`}>
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24">
      <section className="relative z-10 mx-auto max-w-6xl py-14 md:py-20">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">Blog category</p>
        <h1 className="max-w-4xl text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">{category?.name ?? props.slug}</h1>
        <p className="text-muted-foreground/80 mt-5 max-w-2xl text-base leading-relaxed md:text-[15px]">{category?.description ?? "Articles and updates from flatkey.ai."}</p>
      </section>
      <section className="relative z-10 mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        {filteredPosts.map((post) => (
          <article key={post.slug} className="rounded-xl border border-violet-500/15 bg-white/80 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm">
            <Link className="block p-7" href={localizePath(`/blog/${post.slug}`, props.locale)}>
              <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
              <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-7">{post.summary}</p>
              <span className="text-muted-foreground/70 mt-5 block text-xs">{post.date}</span>
            </Link>
          </article>
        ))}
      </section>
      </main>
    </SiteShell>
  );
}
