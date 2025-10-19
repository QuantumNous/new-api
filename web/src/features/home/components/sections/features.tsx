import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
} from 'lucide-react'
import { Section } from '@/components/layout/components/section'

interface FeatureProps {
  title: string
  description: string
  icon: React.ReactNode
}

interface FeaturesProps {
  title?: string
  subtitle?: string
  items?: FeatureProps[]
  className?: string
}

export function Features({
  title = 'Core Features',
  subtitle = 'Comprehensive API management solutions for developers and enterprises',
  items = [
    {
      title: 'Lightning Fast',
      description:
        'Optimized network architecture ensures millisecond response times',
      icon: <Zap className='h-5 w-5' />,
    },
    {
      title: 'Secure & Reliable',
      description:
        'Enterprise-grade security with comprehensive permission management',
      icon: <Shield className='h-5 w-5' />,
    },
    {
      title: 'Global Coverage',
      description: 'Multi-region deployment for stable global access',
      icon: <Globe className='h-5 w-5' />,
    },
    {
      title: 'Developer Friendly',
      description: 'Complete API documentation with multi-language SDK support',
      icon: <Code className='h-5 w-5' />,
    },
    {
      title: 'High Performance',
      description: 'Support for high concurrency with automatic load balancing',
      icon: <Gauge className='h-5 w-5' />,
    },
    {
      title: 'Transparent Billing',
      description: 'Pay-as-you-go with real-time usage monitoring',
      icon: <DollarSign className='h-5 w-5' />,
    },
    {
      title: 'Team Collaboration',
      description: 'Multi-user management with flexible permission allocation',
      icon: <Users className='h-5 w-5' />,
    },
    {
      title: 'Technical Support',
      description: 'Professional team providing 24/7 technical support',
      icon: <HeartHandshake className='h-5 w-5' />,
    },
  ],
  className,
}: FeaturesProps) {
  return (
    <Section className={className}>
      <div className='max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-20'>
        <div className='flex flex-col items-center gap-4 text-center'>
          <h2 className='max-w-[560px] text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight'>
            {title}
          </h2>
          {subtitle && (
            <p className='text-muted-foreground max-w-[600px] text-lg'>
              {subtitle}
            </p>
          )}
        </div>
        <div className='grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4'>
          {items.map((item, index) => (
            <div
              key={index}
              className='group bg-background/50 hover:shadow-primary/5 relative overflow-hidden rounded-xl border p-6 backdrop-blur-sm transition-all hover:shadow-lg'
            >
              <div className='flex flex-col gap-4'>
                <div className='flex items-center gap-3'>
                  <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg'>
                    {item.icon}
                  </div>
                </div>
                <div className='space-y-2'>
                  <h3 className='font-semibold tracking-tight'>{item.title}</h3>
                  <p className='text-muted-foreground text-sm'>
                    {item.description}
                  </p>
                </div>
              </div>
              <div className='from-primary/10 absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover:opacity-100' />
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
