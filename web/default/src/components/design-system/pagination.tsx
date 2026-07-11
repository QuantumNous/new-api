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
import * as React from 'react'

import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

function Pagination({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnPagination>) {
  return (
    <ShadcnPagination
      className={cn(
        '[&_[data-slot=pagination-link]]:h-7 [&_[data-slot=pagination-link]:not(:has(span))]:w-7 [&_[data-slot=pagination-ellipsis]]:size-7 sm:[&_[data-slot=pagination-link]]:h-8 sm:[&_[data-slot=pagination-link]:not(:has(span))]:w-8 sm:[&_[data-slot=pagination-ellipsis]]:size-8',
        className
      )}
      {...props}
    />
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
