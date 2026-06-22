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
import {
  opsConsolePageDescriptionClassName,
  opsConsolePageFooterClassName,
  opsConsolePageHeaderRowClassName,
  opsConsolePageTitleClassName,
} from '@/lib/ops-ui-styles'

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

  const hasPageHeader =
    breadcrumb != null ||
    title != null ||
    description != null ||
    actions != null

  return (
    <PageFooterProvider container={footerContainer}>
      <Main>
        {hasPageHeader ? (
          <div className='shrink-0 px-3 pt-3 pb-2.5 sm:px-4 sm:pt-5 sm:pb-3'>
            {breadcrumb != null && (
              <div className='mb-2 sm:mb-3'>{breadcrumb}</div>
            )}
            <div className={opsConsolePageHeaderRowClassName}>
              <div className='min-w-0 flex-1'>
                {title != null ? (
                  <h2 className={opsConsolePageTitleClassName}>{title}</h2>
                ) : null}
                {description != null ? (
                  <p className={opsConsolePageDescriptionClassName}>
                    {description}
                  </p>
                ) : null}
              </div>
              {actions != null && (
                <div className='flex shrink-0 flex-wrap items-center gap-2 sm:gap-x-3'>
                  {actions}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-auto px-3 pb-3 sm:px-4 sm:pb-4',
            hasPageHeader ? 'pt-1 sm:pt-1.5' : 'pt-0'
          )}
        >
          {content}
        </div>

        <div
          ref={setFooterContainer}
          className={opsConsolePageFooterClassName}
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
