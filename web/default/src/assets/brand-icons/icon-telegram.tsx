import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function IconTelegram({ className, ...props }: SVGProps<SVGSVGElement>) {
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
      <title>Telegram</title>
      <path strokeWidth='0' d='M0 0h24v24H0z' fill='none' />
      <path d='M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4' />
    </svg>
  )
}
