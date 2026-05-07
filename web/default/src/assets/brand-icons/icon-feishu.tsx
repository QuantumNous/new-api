import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function IconFeishu({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn(className)}
      {...props}
    >
      <title>Feishu</title>
      <image
        href='https://cdn.jsdelivr.net/gh/callback-io/allogo@main/public/logos/feishu/icon.svg'
        x='0'
        y='0'
        width='24'
        height='24'
        preserveAspectRatio='xMidYMid meet'
      />
    </svg>
  )
}
