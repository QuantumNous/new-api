import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'

type SlotProps = { children?: ReactNode }
import { AppHeader } from './app-header'
import { Main } from './main'

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

export type SectionPageLayoutProps = {
  children: ReactNode
}

/**
 * 带标题区的页面布局（复合组件）
 * 用于 /dashboard、/usage-logs、/models 等带 section 子页的列表页。
 * 使用 Title / Description / Actions / Content 子组件声明页面结构，便于一眼看出布局。
 */
export function SectionPageLayout(props: SectionPageLayoutProps) {
  let title: ReactNode = null
  let description: ReactNode = null
  let actions: ReactNode = null
  let content: ReactNode = null

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
  })

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
            <p className='text-muted-foreground'>{description}</p>
          </div>
          {actions != null && (
            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
              {actions}
            </div>
          )}
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          {content}
        </div>
      </Main>
    </>
  )
}

SectionPageLayout.Title = SectionPageLayoutTitle
SectionPageLayout.Description = SectionPageLayoutDescription
SectionPageLayout.Actions = SectionPageLayoutActions
SectionPageLayout.Content = SectionPageLayoutContent
