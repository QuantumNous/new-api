import { Link } from '@tanstack/react-router'
import { ArrowRight, Zap, Shield, Globe, Code } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ThemeSwitch } from '@/components/theme-switch'

export function Home() {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  return (
    <div className='bg-background min-h-screen'>
      {/* Header */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur'>
        <div className='container flex h-14 items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <Code className='h-6 w-6' />
            <span className='text-xl font-bold'>New API</span>
          </div>
          <div className='flex items-center space-x-4'>
            <ThemeSwitch />
            {isAuthenticated ? (
              <Button asChild>
                <Link to='/dashboard'>
                  进入控制台 <ArrowRight className='ml-2 h-4 w-4' />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant='ghost' asChild>
                  <Link to='/sign-in'>登录</Link>
                </Button>
                <Button asChild>
                  <Link to='/sign-up'>注册</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className='container flex flex-col items-center justify-center space-y-8 py-24 text-center md:py-32'>
        <div className='max-w-3xl space-y-4'>
          <h1 className='text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl'>
            统一的 API 管理平台
          </h1>
          <p className='text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl md:text-2xl'>
            一个强大的 API 中转服务，支持多种 AI 模型，帮助你轻松管理和调用各类
            API 服务
          </p>
        </div>
        <div className='flex flex-col gap-4 sm:flex-row'>
          {isAuthenticated ? (
            <Button size='lg' asChild>
              <Link to='/dashboard'>
                进入控制台 <ArrowRight className='ml-2 h-5 w-5' />
              </Link>
            </Button>
          ) : (
            <>
              <Button size='lg' asChild>
                <Link to='/sign-up'>
                  开始使用 <ArrowRight className='ml-2 h-5 w-5' />
                </Link>
              </Button>
              <Button size='lg' variant='outline' asChild>
                <Link to='/sign-in'>登录账户</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className='bg-muted/50 container py-16 md:py-24'>
        <div className='mb-12 space-y-4 text-center'>
          <h2 className='text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl'>
            核心特性
          </h2>
          <p className='text-muted-foreground mx-auto max-w-2xl text-lg'>
            为开发者和企业提供全方位的 API 管理解决方案
          </p>
        </div>
        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader>
              <Zap className='text-primary mb-2 h-10 w-10' />
              <CardTitle>高性能</CardTitle>
              <CardDescription>
                快速响应，低延迟，支持高并发请求
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Shield className='text-primary mb-2 h-10 w-10' />
              <CardTitle>安全可靠</CardTitle>
              <CardDescription>
                完善的权限控制和 API Key 管理系统
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Globe className='text-primary mb-2 h-10 w-10' />
              <CardTitle>多模型支持</CardTitle>
              <CardDescription>
                支持 OpenAI、Claude、Gemini 等多种主流 AI 模型
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Code className='text-primary mb-2 h-10 w-10' />
              <CardTitle>开发友好</CardTitle>
              <CardDescription>
                完整的文档和 API，易于集成和使用
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className='container py-16 md:py-24'>
          <Card className='bg-primary text-primary-foreground'>
            <CardContent className='flex flex-col items-center justify-center space-y-4 p-12 text-center'>
              <h2 className='text-3xl font-bold tracking-tighter sm:text-4xl'>
                立即开始使用
              </h2>
              <p className='text-primary-foreground/90 max-w-xl text-lg'>
                注册账号，获取 API Key，开始你的 AI 应用开发之旅
              </p>
              <Button size='lg' variant='secondary' asChild>
                <Link to='/sign-up'>
                  免费注册 <ArrowRight className='ml-2 h-5 w-5' />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Footer */}
      <footer className='border-t py-8'>
        <div className='container flex flex-col items-center justify-between gap-4 md:flex-row'>
          <p className='text-muted-foreground text-sm'>
            © 2025 New API. All rights reserved.
          </p>
          <div className='flex items-center space-x-4'>
            <Link
              to='/sign-in'
              className='text-muted-foreground text-sm hover:underline'
            >
              登录
            </Link>
            <Link
              to='/sign-up'
              className='text-muted-foreground text-sm hover:underline'
            >
              注册
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
