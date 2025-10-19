import { useAuthStore } from '@/stores/auth-store'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { CTA } from './components/sections/cta'
import { Features } from './components/sections/features'
import { Hero } from './components/sections/hero'
import { Stats } from './components/sections/stats'
import { useHomePageContent } from './hooks/use-home-page-content'

export function Home() {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()

  // Show loading state
  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='bg-background text-foreground flex min-h-screen w-full items-center justify-center'>
          <div className='text-muted-foreground'>Loading...</div>
        </main>
      </PublicLayout>
    )
  }

  // If custom content exists, render it
  if (content) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='bg-background text-foreground w-full overflow-x-hidden'>
          {isUrl ? (
            <iframe
              src={content}
              className='h-screen w-full border-none'
              title='Custom Home Page'
            />
          ) : (
            <div className='container mx-auto py-8'>
              <Markdown className='custom-home-content'>{content}</Markdown>
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  // Default home page
  return (
    <PublicLayout showMainContainer={false}>
      <main className='bg-background text-foreground min-h-screen w-full overflow-hidden'>
        <Hero isAuthenticated={isAuthenticated} />
        <Stats />
        <Features />
        <CTA isAuthenticated={isAuthenticated} />
        <Footer />
      </main>
    </PublicLayout>
  )
}
