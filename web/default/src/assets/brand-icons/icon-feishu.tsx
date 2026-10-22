/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { SVGProps } from 'react'

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
      fill='currentColor'
      {...props}
    >
      <title>Feishu</title>
      <path d='M12.006 2.13c-3.67.24-6.91 2.56-8.34 5.95-.35.84-.57 1.72-.65 2.61l-.02.27v.94l.03.42c.23 3.02 1.97 5.74 4.6 7.28l.38.2.14-.31c.29-.66.44-1.37.44-2.09 0-1.27-.43-2.5-1.21-3.49l-.19-.23.24-.17a6.07 6.07 0 0 0 2.47-4.88V8.5l.27.1c1.24.47 2.14 1.57 2.37 2.87l.04.27h.55l.04-.27c.23-1.3 1.13-2.4 2.37-2.87l.27-.1v.15a6.07 6.07 0 0 0 2.47 4.88l.24.17-.19.23a5.42 5.42 0 0 0-1.21 3.49c0 .72.15 1.43.44 2.09l.14.31.38-.2c2.63-1.54 4.37-4.26 4.6-7.28l.03-.42v-.94l-.02-.27a10.02 10.02 0 0 0-.65-2.61c-1.43-3.39-4.67-5.71-8.33-5.95l-.43-.01z' />
    </svg>
  )
}
