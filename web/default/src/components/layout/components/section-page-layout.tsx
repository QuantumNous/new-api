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
import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { Main } from './main'
import { PageFooterProvider } from './page-footer'

type SlotProps = { children?: ReactNode }

function SectionPageLayoutTitle(_props: SlotProps) {
  return null
}
SectionPageLayoutTitle.displayName = 'SectionPageLayout.Title'

function SectionPageLayoutDescription(_props: SlotProps) {
  return null
}
SectionPageLayoutDescription.displayName = 'SectionPageLayout.Description'

function SectionPageLayoutActions(_props: SlotProps) {
  return null
}
SectionPageLayoutActions.displayName = 'SectionPageLayout.Actions'

function SectionPageLayoutContent(_props: SlotProps) {
  return null
}
SectionPageLayoutContent.displayName = 'SectionPageLayout.Content'

function SectionPageLayoutBreadcrumb(_props: SlotProps) {
  return null
}
SectionPageLayoutBreadcrumb.displayName = 'SectionPageLayout.Breadcrumb'

export type SectionPageLayoutProps = {
  children: ReactNode
  density?: 'compact' | 'comfortable'
}

export function SectionPageLayout(props: SectionPageLayoutProps) {
  const [footerContainer, setFooterContainer] = useState<HTMLDivElement | null>(
    null
  )

  let title: ReactNode = null
  let description: ReactNode = null
  let actions: ReactNode = null
  let content: ReactNode = null
  let breadcrumb: ReactNode = null

  Children.forEach(props.children, (node) => {
    if (!isValidElement(node)) return
    const child = node as ReactElement<SlotProps>
    if (child.type === SectionPageLayoutTitle) title = child.props.children
    else if (child.type === SectionPageLayoutDescription)
      description = child.props.children
    else if (child.type === SectionPageLayoutActions)
      actions = child.props.children
    else if (child.type === SectionPageLayoutContent)
      content = child.props.children
    else if (child.type === SectionPageLayoutBreadcrumb)
      breadcrumb = child.props.children
  })

  const isComfortable = props.density === 'comfortable'

  return (
    <PageFooterProvider container={footerContainer}>
      <Main>
        <div
          className={cn(
            'surface-route shrink-0 rounded-none border-x-0 border-t-0 px-3 pt-3 pb-2.5 shadow-[inset_0_-1px_0_var(--border-subtle)] sm:px-4 sm:pt-5 sm:pb-3',
            isComfortable && 'sm:pt-6 sm:pb-4'
          )}
        >
          {breadcrumb != null && (
            <div className='mb-2 sm:mb-3'>{breadcrumb}</div>
          )}
          <div className='flex flex-wrap items-start justify-between gap-x-3 gap-y-3 sm:gap-x-4'>
            <div className='min-w-0 flex-1'>
              <div className='mb-1 flex items-center gap-2'>
                <span
                  aria-hidden
                  className='route-node hidden size-2 rounded-full bg-[var(--brand-signal)] sm:inline-block'
                />
                <h1 className='truncate text-base font-bold tracking-tight sm:text-lg'>
                  {title}
                </h1>
              </div>
              {description != null && (
                <p className='text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed sm:text-sm'>
                  {description}
                </p>
              )}
            </div>
            {actions != null && (
              <div className='flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-x-3'>
                {actions}
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-auto px-3 pt-2 pb-3 sm:px-4 sm:pb-4',
            isComfortable ? 'sm:pt-4' : 'sm:pt-2'
          )}
        >
          {content}
        </div>

        <div
          ref={setFooterContainer}
          className='bg-background shrink-0 border-t px-3 py-2.5 empty:hidden sm:px-4 sm:py-3'
        />
      </Main>
    </PageFooterProvider>
  )
}

SectionPageLayout.Title = SectionPageLayoutTitle
SectionPageLayout.Description = SectionPageLayoutDescription
SectionPageLayout.Actions = SectionPageLayoutActions
SectionPageLayout.Content = SectionPageLayoutContent
SectionPageLayout.Breadcrumb = SectionPageLayoutBreadcrumb
