import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function IconSlack({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn('[&>path]:stroke-current', className)}
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <title>Slack</title>
      <path strokeWidth='0' d='M0 0h24v24H0z' fill='none' />
      <path d='M12 12v-6a2 2 0 0 1 4 0v6m0 -2a2 2 0 1 1 2 2h-6' />
      <path d='M12 12h6a2 2 0 0 1 0 4h-6m2 0a2 2 0 1 1 -2 2v-6' />
      <path d='M12 12v6a2 2 0 0 1 -4 0v-6m0 2a2 2 0 1 1 -2 -2h6' />
      <path d='M12 12h-6a2 2 0 0 1 0 -4h6m-2 0a2 2 0 1 1 2 -2v6' />
    </svg>
  )
}
