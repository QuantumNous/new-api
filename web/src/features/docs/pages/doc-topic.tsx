/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) a later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { Link, useParams } from '@tanstack/react-router'

import { PublicLayout } from '@/components/layout/components/public-layout'
import { FooterCta } from '@/features/marketing/components/MarketingSections'
import { useMarketingNavLinks } from '@/features/marketing/hooks/useSiteContent'

import { DocsSidebar } from '../components/docs-sidebar'
import { getDocTopic } from '../lib/docs-data'

export function DocTopicPage() {
  const { topic } = useParams({ from: '/docs/$topic' })
  const navLinks = useMarketingNavLinks()
  const doc = getDocTopic(topic)

  if (!doc) {
    return (
      <PublicLayout navLinks={navLinks} showAuthButtons showThemeSwitch>
        <div className='mx-auto max-w-3xl px-4 py-20 text-center'>
          <h1 className='text-2xl font-bold'>未找到该文档</h1>
          <p className='text-muted-foreground mt-2'>文档「{topic}」不存在或尚未编写。</p>
          <Link to='/docs' className='text-primary mt-4 inline-block hover:underline'>
            返回文档中心
          </Link>
        </div>
        <FooterCta />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout navLinks={navLinks} showAuthButtons showThemeSwitch>
      <div className='mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 py-10 md:grid-cols-[200px_1fr]'>
        <aside className='hidden md:block'>
          <div className='text-muted-foreground/50 mb-3 text-xs font-medium tracking-wider uppercase'>
            文档
          </div>
          <DocsSidebar />
        </aside>
        <article>
          <h1 className='text-3xl font-bold'>{doc.title}</h1>
          <p className='text-muted-foreground mt-2'>{doc.summary}</p>
          <div className='mt-8 space-y-8'>
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className='text-xl font-semibold'>{section.heading}</h2>
                <p className='text-muted-foreground mt-2 leading-relaxed'>
                  {section.body}
                </p>
              </section>
            ))}
          </div>
          <p className='text-muted-foreground/60 mt-10 rounded-xl border border-border/50 bg-muted/30 p-4 text-sm'>
            本文档为框架占位内容，正式内容将陆续补充。
          </p>
        </article>
      </div>
      <FooterCta />
    </PublicLayout>
  )
}
