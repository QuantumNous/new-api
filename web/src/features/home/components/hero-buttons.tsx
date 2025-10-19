import { Link } from '@tanstack/react-router'
import { ArrowRight, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeroButtonsProps {
  isAuthenticated: boolean
}

/**
 * Hero section action buttons
 */
export function HeroButtons({ isAuthenticated }: HeroButtonsProps) {
  if (isAuthenticated) {
    return (
      <Button size='lg' asChild>
        <Link to='/dashboard'>
          Go to Dashboard <ArrowRight className='ml-2 h-5 w-5' />
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button size='lg' asChild>
        <Link to='/sign-up'>
          Get Started
          <ArrowRight className='ml-2 h-5 w-5' />
        </Link>
      </Button>
      <Button size='lg' variant='outline' asChild>
        <Link to='/sign-in'>
          <Github className='mr-2 h-4 w-4' />
          Sign In
        </Link>
      </Button>
    </>
  )
}
