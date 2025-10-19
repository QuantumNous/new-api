import { useAuthStore } from '@/stores/auth-store'
import { PublicLayout } from '@/components/layout'
import { CTA } from '@/features/home/components/sections/cta'
import { Features } from '@/features/home/components/sections/features'
import { Footer } from '@/features/home/components/sections/footer'
import { Hero } from '@/features/home/components/sections/hero'
import { Stats } from '@/features/home/components/sections/stats'

export function Home() {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

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
