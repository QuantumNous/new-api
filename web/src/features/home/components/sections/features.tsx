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
      icon: <Zap className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Secure & Reliable',
      description:
        'Enterprise-grade security with comprehensive permission management',
      icon: <Shield className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Global Coverage',
      description: 'Multi-region deployment for stable global access',
      icon: <Globe className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Developer Friendly',
      description: 'Complete API documentation with multi-language SDK support',
      icon: <Code className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'High Performance',
      description: 'Support for high concurrency with automatic load balancing',
      icon: <Gauge className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Transparent Billing',
      description: 'Pay-as-you-go with real-time usage monitoring',
      icon: <DollarSign className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Team Collaboration',
      description: 'Multi-user management with flexible permission allocation',
      icon: <Users className='h-5 w-5 stroke-1' />,
    },
    {
      title: 'Technical Support',
      description: 'Professional team providing 24/7 technical support',
      icon: <HeartHandshake className='h-5 w-5 stroke-1' />,
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
            <p className='text-muted-foreground max-w-[600px] text-lg font-medium'>
              {subtitle}
            </p>
          )}
        </div>
        <div className='grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'>
          {items.map((item, index) => (
            <div
              key={index}
              className='group/feature text-foreground flex flex-col gap-4 p-4'
            >
              {/* Icon */}
              <div className='flex items-center self-start'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 shadow-inner ring-1 ring-amber-500/20 transition-all duration-300 group-hover/feature:scale-110 group-hover/feature:ring-amber-500/40'>
                  {item.icon}
                </div>
              </div>
              {/* Title */}
              <h3 className='text-sm leading-none font-semibold tracking-tight sm:text-base'>
                {item.title}
              </h3>
              {/* Description */}
              <div className='text-muted-foreground flex max-w-[240px] flex-col gap-2 text-sm text-balance'>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
