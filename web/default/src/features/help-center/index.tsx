import { Link } from '@tanstack/react-router'
import { BookOpen, CheckCircle2, Clock3, FileText, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Separator } from '@/components/ui/separator'
import { PublicLayout } from '@/components/layout'
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getHelpArticleBySlug,
  getHelpCategoryByKey,
  type HelpArticle,
} from './content'

type HelpCenterPageProps = {
  slug?: string
}

function ArticleLink({ article, compact = false }: { article: HelpArticle; compact?: boolean }) {
  return (
    <Link
      to='/help/$slug'
      params={{ slug: article.slug }}
      className='border-border/80 bg-background/70 hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring block rounded-2xl border p-4 transition-colors outline-none focus-visible:ring-3'
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>{article.difficulty}</Badge>
        <span className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
          <Clock3 className='size-3.5' />
          {article.readTime}
        </span>
      </div>
      <h3 className='mt-3 text-base font-semibold'>{article.title}</h3>
      {compact ? null : (
        <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
          {article.summary}
        </p>
      )}
    </Link>
  )
}

function HelpHome() {
  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl py-10 md:py-14'>
        <section className='grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end'>
          <div className='space-y-5'>
            <Badge variant='secondary' className='h-6 rounded-full px-3'>
              aiapi114 Help Center
            </Badge>
            <div className='space-y-3'>
              <h1 className='max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl'>
                从第一把 API Key 到稳定调用，按路径完成配置
              </h1>
              <p className='text-muted-foreground max-w-2xl text-base leading-7 md:text-lg'>
                帮助中心先覆盖新手最容易卡住的账号、Key、Base URL、模型名、调用失败排查。内容基于已清洗的参考文档改写，并经过编写者与审核员双重检查。
              </p>
            </div>
          </div>
          <div className='border-border/80 bg-muted/30 rounded-3xl border p-5'>
            <div className='flex items-start gap-3'>
              <div className='bg-background rounded-2xl p-2 shadow-sm'>
                <ShieldCheck className='text-primary size-5' />
              </div>
              <div className='space-y-2'>
                <h2 className='font-semibold'>当前落地顺序</h2>
                <p className='text-muted-foreground text-sm leading-6'>
                  第一批先完成新手入门、快速使用、常见错误答疑；后续继续扩展第三方工具配置、进阶使用和 API 接口描述。
                </p>
              </div>
            </div>
          </div>
        </section>

        <Separator className='my-10' />

        <section className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {HELP_CATEGORIES.map((category, index) => {
            const articles = category.articleSlugs
              .map((slug) => HELP_ARTICLES.find((article) => article.slug === slug))
              .filter((article): article is HelpArticle => Boolean(article))

            return (
              <div key={category.key} className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <span className='bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-semibold'>
                    {index + 1}
                  </span>
                  <h2 className='text-lg font-semibold'>{category.title}</h2>
                </div>
                <p className='text-muted-foreground min-h-12 text-sm leading-6'>
                  {category.description}
                </p>
                <div className='space-y-2'>
                  {articles.map((article, articleIndex) => (
                    <ArticleLink
                      key={article.slug}
                      article={article}
                      compact={articleIndex > 0}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </PublicLayout>
  )
}

function ArticleAside({ article }: { article: HelpArticle }) {
  const category = getHelpCategoryByKey(article.categoryKey)

  return (
    <aside className='space-y-5 md:sticky md:top-24 md:self-start'>
      <div className='border-border/80 rounded-2xl border p-4'>
        <div className='flex items-center gap-2 text-sm font-semibold'>
          <BookOpen className='size-4' />
          文档信息
        </div>
        <dl className='mt-4 space-y-3 text-sm'>
          <div>
            <dt className='text-muted-foreground'>分类</dt>
            <dd className='mt-1 font-medium'>{category?.title ?? '帮助文档'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>阅读难度</dt>
            <dd className='mt-1 font-medium'>{article.difficulty}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>预计时间</dt>
            <dd className='mt-1 font-medium'>{article.readTime}</dd>
          </div>
        </dl>
      </div>

      <div className='border-border/80 rounded-2xl border p-4'>
        <div className='flex items-center gap-2 text-sm font-semibold'>
          <CheckCircle2 className='text-primary size-4' />
          审核结果
        </div>
        <ul className='text-muted-foreground mt-3 space-y-2 text-sm leading-6'>
          {article.audit.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function HelpArticlePage({ article }: { article: HelpArticle }) {
  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-6xl gap-8 py-10 md:grid-cols-[minmax(0,1fr)_280px] md:py-14'>
        <article className='min-w-0'>
          <div className='mb-6 space-y-4'>
            <Button variant='ghost' size='sm' render={<Link to='/help' />}>
              返回帮助中心
            </Button>
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>{article.difficulty}</Badge>
                <span className='text-muted-foreground inline-flex items-center gap-1 text-sm'>
                  <FileText className='size-4' />
                  {article.readTime}
                </span>
              </div>
              <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
                {article.title}
              </h1>
              <p className='text-muted-foreground max-w-3xl text-base leading-7'>
                {article.summary}
              </p>
            </div>
          </div>
          <div className='border-border/80 bg-background rounded-3xl border p-5 md:p-7'>
            <Markdown className='prose-headings:scroll-mt-24 prose-h2:mt-8 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-table:text-sm'>
              {article.markdown}
            </Markdown>
          </div>
        </article>
        <ArticleAside article={article} />
      </div>
    </PublicLayout>
  )
}

function NotFoundArticle() {
  return (
    <PublicLayout>
      <div className='mx-auto max-w-2xl py-16 text-center'>
        <h1 className='text-2xl font-semibold'>未找到这篇帮助文档</h1>
        <p className='text-muted-foreground mt-3'>
          当前帮助中心仍在分批建设，请先返回首页查看已发布内容。
        </p>
        <Button className='mt-6' render={<Link to='/help' />}>
          返回帮助中心
        </Button>
      </div>
    </PublicLayout>
  )
}

export function HelpCenterPage({ slug }: HelpCenterPageProps) {
  if (!slug) {
    return <HelpHome />
  }

  const article = getHelpArticleBySlug(slug)
  if (!article) {
    return <NotFoundArticle />
  }

  return <HelpArticlePage article={article} />
}
