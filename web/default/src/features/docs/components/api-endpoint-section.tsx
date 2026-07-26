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
import { Badge } from '@/components/ui/badge'

type ApiEndpointSectionProps = {
  id: string
  title: string
  description: string
  method: 'GET' | 'POST'
  path: string
  children: React.ReactNode
}

export function ApiEndpointSection(props: ApiEndpointSectionProps) {
  return (
    <section id={props.id} className='scroll-mt-28'>
      <h2 className='text-2xl font-semibold'>{props.title}</h2>
      <p className='text-muted-foreground mt-3 leading-7'>
        {props.description}
      </p>
      <div className='border-border bg-card mt-5 flex min-h-12 items-center gap-3 rounded-lg border px-4'>
        <Badge variant='secondary'>{props.method}</Badge>
        <code className='min-w-0 truncate font-mono text-sm'>{props.path}</code>
      </div>
      <div className='mt-4 flex flex-col gap-4'>{props.children}</div>
    </section>
  )
}
