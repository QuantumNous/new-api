/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, BookOpen, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { getBlogCategories, getBlogList, getBlogPost } from './api'
import { BlogArticle } from './components/blog-article'
import { BlogCard } from './components/blog-card'
import { BlogPagination } from './components/blog-pagination'
import { BlogSearch } from './components/blog-search'
import { BlogSeo } from './components/blog-seo'
import {
  BLOG_PAGE_SIZE,
  getBlogCategory,
  normalizeBlogCategories,
} from './constants'
import { formatBlogDate } from './lib/format'

interface BlogSearchState {
  page?: number
  q?: string
}

interface BlogListPageProps {
  search: BlogSearchState
}

interface BlogCategoryPageProps {
  slug: string
  search: BlogSearchState
}

interface BlogPostPageProps {
  slug: string
}

function normalizePage(page: number | undefined): number {
  if (!page || page < 1) {
    return 1
  }
  return page
}

function BlogHero(props: {
  title: string
  description: string
  query?: string
  categorySlug?: string
}) {
  return (
    <section className='bg-muted/30 border-border/50 border-b pt-28 pb-14 text-center'>
      <div className='container max-w-5xl px-4'>
        <Badge variant='outline' className='mb-5'>
          <BookOpen className='size-3.5' />
          Flatkey AI
        </Badge>
        <h1 className='text-foreground text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          {props.title}
        </h1>
        <p className='text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 text-balance md:text-lg'>
          {props.description}
        </p>
        <BlogSearch query={props.query} categorySlug={props.categorySlug} />
      </div>
    </section>
  )
}

function BlogCategories() {
  const { t } = useTranslation()
  const result = useQuery({
    queryKey: ['blog-categories'],
    queryFn: getBlogCategories,
  })
  const categories = normalizeBlogCategories(result.data?.data ?? [])

  if (result.isLoading) {
    return (
      <div className='mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='border-border bg-card rounded-lg border p-5'
          >
            <Skeleton className='h-5 w-36' />
            <Skeleton className='mt-4 h-4 w-full' />
            <Skeleton className='mt-2 h-4 w-4/5' />
            <Skeleton className='mt-5 h-4 w-24' />
          </div>
        ))}
      </div>
    )
  }

  if (result.isError || categories.length === 0) {
    return null
  }

  return (
    <div className='mt-10 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4'>
      {categories.map((category) => (
        <Link
          key={category.slug}
          to='/blog/category/$slug'
          params={{ slug: category.slug }}
          search={{ page: undefined, q: undefined }}
          className='border-border bg-card hover:border-primary/35 block rounded-lg border p-5 transition-colors'
        >
          <h2 className='text-foreground font-semibold'>{category.name}</h2>
          <p className='text-muted-foreground mt-2 line-clamp-3 text-sm leading-6'>
            {category.description ||
              t('Latest articles in {{category}}.', {
                category: category.name,
              })}
          </p>
          <span className='text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium'>
            {t('Read more')}
            <ArrowRight className='size-3.5' />
          </span>
        </Link>
      ))}
    </div>
  )
}

function BlogGridSkeleton() {
  return (
    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className='border-border/70 bg-card overflow-hidden rounded-lg border'
        >
          <Skeleton className='aspect-[16/9] rounded-none' />
          <div className='space-y-3 p-5'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-4 w-[85%]' />
            <Skeleton className='h-4 w-[70%]' />
          </div>
        </div>
      ))}
    </div>
  )
}

function BlogCTA() {
  const { t } = useTranslation()

  return (
    <section className='bg-foreground text-background mt-20 rounded-lg px-6 py-12 text-center sm:px-10'>
      <h2 className='text-2xl font-semibold'>
        {t('Build faster with one AI gateway.')}
      </h2>
      <p className='text-background/75 mx-auto mt-3 max-w-2xl text-sm leading-6'>
        {t(
          'Use Flatkey AI to manage models, keys, billing, and observability from one API platform.'
        )}
      </p>
      <Button
        className='bg-background text-foreground hover:bg-background/90 mt-7'
        render={<Link to='/sign-up' />}
      >
        {t('Get started')}
      </Button>
    </section>
  )
}

function EmptyBlogState() {
  const { t } = useTranslation()

  return (
    <div className='border-border bg-card flex min-h-64 flex-col items-center justify-center rounded-lg border px-6 py-14 text-center'>
      <BookOpen className='text-muted-foreground size-10' />
      <h2 className='mt-4 text-lg font-semibold'>{t('No posts found')}</h2>
      <p className='text-muted-foreground mt-2 max-w-md text-sm'>
        {t('Try a different search or category.')}
      </p>
    </div>
  )
}

export function BlogListPage(props: BlogListPageProps) {
  const { t } = useTranslation()
  const page = normalizePage(props.search.page)
  const query = props.search.q?.trim()
  const result = useQuery({
    queryKey: ['blog-list', page, query],
    queryFn: () => getBlogList({ page, q: query }),
  })
  const data = result.data?.data
  const totalPages = data ? Math.ceil(data.total / BLOG_PAGE_SIZE) : 0

  return (
    <PublicLayout showMainContainer={false}>
      <BlogSeo
        title={t('Flatkey AI Blog')}
        description={t(
          'Insights, product notes, and implementation guides for teams building on AI APIs.'
        )}
        path='/blog'
        type='blog'
      />
      <main>
        <BlogHero
          title={t('Flatkey AI Blog')}
          description={t(
            'Insights, product notes, and implementation guides for teams building on AI APIs.'
          )}
          query={query}
        />
        <section className='container max-w-6xl px-4 py-14'>
          <BlogCategories />
        </section>
        <section className='container max-w-6xl px-4 pb-20'>
          {result.isLoading && <BlogGridSkeleton />}
          {result.isError && <EmptyBlogState />}
          {data && data.list.length === 0 && <EmptyBlogState />}
          {data && data.list.length > 0 && (
            <>
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {data.list.map((post) => (
                  <BlogCard key={post.id || post.slug} post={post} />
                ))}
              </div>
              <BlogPagination
                pageNo={page}
                totalPages={totalPages}
                query={query}
              />
              <BlogCTA />
            </>
          )}
        </section>
      </main>
      <Footer />
    </PublicLayout>
  )
}

export function BlogCategoryPage(props: BlogCategoryPageProps) {
  const { t } = useTranslation()
  const page = normalizePage(props.search.page)
  const query = props.search.q?.trim()
  const categoriesQuery = useQuery({
    queryKey: ['blog-categories'],
    queryFn: getBlogCategories,
  })
  const category = getBlogCategory(categoriesQuery.data?.data, props.slug)
  const categoryId = category?.id
  const result = useQuery({
    queryKey: ['blog-category', props.slug, categoryId, page, query],
    queryFn: () =>
      getBlogList({
        page,
        q: query,
        categoryIds: categoryId ? [categoryId] : [],
      }),
    enabled: !!category,
  })
  const data = result.data?.data
  const totalPages = data ? Math.ceil(data.total / BLOG_PAGE_SIZE) : 0

  if (categoriesQuery.isLoading) {
    return (
      <PublicLayout>
        <div className='flex min-h-[50vh] items-center justify-center'>
          <Loader2 className='text-muted-foreground size-8 animate-spin' />
        </div>
      </PublicLayout>
    )
  }

  if (!category) {
    return (
      <PublicLayout>
        <EmptyBlogState />
      </PublicLayout>
    )
  }

  const categoryDescription =
    category.description ||
    t('Latest articles in {{category}}.', {
      category: category.name,
    })

  return (
    <PublicLayout showMainContainer={false}>
      <BlogSeo
        title={`${category.name} Blog`}
        description={categoryDescription}
        path={`/blog/category/${props.slug}`}
        type='category'
        categoryName={category.name}
      />
      <main>
        <BlogHero
          title={category.name}
          description={categoryDescription}
          query={query}
          categorySlug={props.slug}
        />
        <section className='container max-w-6xl px-4 py-12'>
          <Button
            variant='ghost'
            render={
              <Link to='/blog' search={{ page: undefined, q: undefined }} />
            }
          >
            <ArrowLeft className='size-4' />
            {t('Back to Blog')}
          </Button>
        </section>
        <section className='container max-w-6xl px-4 pb-20'>
          {result.isLoading && <BlogGridSkeleton />}
          {result.isError && <EmptyBlogState />}
          {data && data.list.length === 0 && <EmptyBlogState />}
          {data && data.list.length > 0 && (
            <>
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {data.list.map((post) => (
                  <BlogCard key={post.id || post.slug} post={post} />
                ))}
              </div>
              <BlogPagination
                pageNo={page}
                totalPages={totalPages}
                query={query}
                categorySlug={props.slug}
              />
              <BlogCTA />
            </>
          )}
        </section>
      </main>
      <Footer />
    </PublicLayout>
  )
}

export function BlogPostPage(props: BlogPostPageProps) {
  const { t } = useTranslation()
  const postQuery = useQuery({
    queryKey: ['blog-post', props.slug],
    queryFn: () => getBlogPost(props.slug),
  })
  const post = postQuery.data?.data
  const relatedQuery = useQuery({
    queryKey: ['blog-related', post?.categoryId, props.slug],
    queryFn: () =>
      getBlogList({
        page: 1,
        categoryIds: post?.categoryId ? [post.categoryId] : undefined,
      }),
    enabled: !!post,
  })
  const related = useMemo(() => {
    const posts = relatedQuery.data?.data.list ?? []
    return posts.filter((item) => item.slug !== props.slug).slice(0, 3)
  }, [props.slug, relatedQuery.data?.data.list])

  return (
    <PublicLayout showMainContainer={false}>
      {post && (
        <BlogSeo
          title={post.title}
          description={post.summary}
          path={`/blog/${post.slug}`}
          type='article'
          post={post}
        />
      )}
      <main>
        {postQuery.isLoading && (
          <div className='flex min-h-[70vh] items-center justify-center'>
            <Loader2 className='text-muted-foreground size-8 animate-spin' />
          </div>
        )}
        {postQuery.isError && <EmptyBlogState />}
        {post && (
          <>
            <section className='bg-muted/30 border-border/50 border-b pt-28 pb-12'>
              <div className='container max-w-4xl px-4'>
                <div className='mb-5 flex flex-wrap items-center gap-3'>
                  {post.categoryName && (
                    <Badge variant='outline'>{post.categoryName}</Badge>
                  )}
                  <span className='text-muted-foreground text-sm'>
                    {formatBlogDate(post.date, 'long')}
                  </span>
                  {post.author && (
                    <span className='text-muted-foreground text-sm'>
                      {post.author}
                    </span>
                  )}
                </div>
                <h1 className='text-foreground text-3xl font-semibold tracking-tight text-balance md:text-5xl'>
                  {post.title}
                </h1>
                {post.summary && (
                  <p className='text-muted-foreground mt-5 max-w-3xl text-base leading-7 text-balance md:text-lg'>
                    {post.summary}
                  </p>
                )}
              </div>
            </section>
            {post.cover && (
              <div className='container max-w-4xl px-4 py-8'>
                <img
                  src={post.cover}
                  alt={post.title}
                  className='bg-muted aspect-[16/9] w-full rounded-lg object-cover'
                  loading='eager'
                  decoding='async'
                />
              </div>
            )}
            <section className='container max-w-5xl px-4 py-8'>
              <BlogArticle content={post.content ?? ''} />
            </section>
            {related.length > 0 && (
              <section className='border-border/50 mt-10 border-t py-16'>
                <div className='container max-w-5xl px-4'>
                  <h2 className='text-xl font-semibold'>
                    {t('Related articles')}
                  </h2>
                  <div className='mt-7 grid gap-5 sm:grid-cols-3'>
                    {related.map((item) => (
                      <BlogCard
                        key={item.id || item.slug}
                        post={item}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}
            <div className='container max-w-5xl px-4 pb-16'>
              <Button
                variant='ghost'
                render={
                  <Link to='/blog' search={{ page: undefined, q: undefined }} />
                }
              >
                <ArrowLeft className='size-4' />
                {t('Back to Blog')}
              </Button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </PublicLayout>
  )
}
