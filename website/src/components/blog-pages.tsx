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
      <section className="page-hero">
        <p className="eyebrow">Blog</p>
        <h1>AI API operations, routing, and model infrastructure</h1>
        <p>Server-rendered articles from flatkey.ai with canonical metadata and crawlable links.</p>
      </section>
      {categories.length > 0 ? (
        <nav className="category-nav" aria-label="Blog categories">
          {categories.map((category) => (
            <Link key={category.slug} href={localizePath(`/blog/category/${category.slug}`, props.locale)}>
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <section className="blog-grid">
        {posts.list.map((post) => (
          <article key={post.slug} className="blog-card">
            <Link href={localizePath(`/blog/${post.slug}`, props.locale)}>
              <h2>{post.title}</h2>
              <p>{post.summary}</p>
              <span>{post.date}</span>
            </Link>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}

export async function BlogArticlePage(props: Props & { slug: string }) {
  const post = await getBlogPost(props.slug);
  if (!post) notFound();

  return (
    <SiteShell locale={props.locale} pathname={`/blog/${props.slug}`}>
      <article className="article">
        <header>
          <p className="eyebrow">{post.categoryName ?? "Blog"}</p>
          <h1>{post.title}</h1>
          {post.summary ? <p>{post.summary}</p> : null}
          {post.date ? <time dateTime={post.date}>{post.date}</time> : null}
        </header>
        <div
          className="article-body"
          dangerouslySetInnerHTML={{
            __html: sanitizeBlogHtml(post.content ?? ""),
          }}
        />
      </article>
    </SiteShell>
  );
}

export async function BlogCategoryPage(props: Props & { slug: string }) {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const category = categories.find((item) => item.slug === props.slug);
  const filteredPosts = posts.list.filter((post) => post.categorySlug === props.slug);
  return (
    <SiteShell locale={props.locale} pathname={`/blog/category/${props.slug}`}>
      <section className="page-hero">
        <p className="eyebrow">Blog category</p>
        <h1>{category?.name ?? props.slug}</h1>
        <p>{category?.description ?? "Articles and updates from flatkey.ai."}</p>
      </section>
      <section className="blog-grid">
        {filteredPosts.map((post) => (
          <article key={post.slug} className="blog-card">
            <Link href={localizePath(`/blog/${post.slug}`, props.locale)}>
              <h2>{post.title}</h2>
              <p>{post.summary}</p>
              <span>{post.date}</span>
            </Link>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
