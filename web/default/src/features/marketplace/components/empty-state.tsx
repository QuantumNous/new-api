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
import type { ReactNode } from 'react'
import {
  BarChart3,
  FilterX,
  FolderSearch,
  PackageOpen,
  SearchX,
  Sparkles,
  ToggleLeft,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Empty as UIEmpty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { SkillCTAAction } from '../types'
import { SkillCTA } from './skill-cta'

export type MarketplaceEmptyStateKind =
  | 'search'
  | 'category'
  | 'kids'
  | 'filters'
  | 'load-error'
  | 'my-skills'
  | 'analytics'
  | 'feature-off'
  | 'marketplace'

interface EmptyStateProps {
  kind: MarketplaceEmptyStateKind
  action?: SkillCTAAction
  onAction?: () => void
  className?: string
  children?: ReactNode
}

const emptyStateConfig = {
  search: {
    icon: SearchX,
    title: 'No Skills match this search.',
    description: 'Clear search to browse the full marketplace.',
  },
  category: {
    icon: FolderSearch,
    title: 'No Skills are available in this category yet.',
    description: 'View all Skills to keep browsing.',
  },
  kids: {
    icon: FilterX,
    title: 'No Skills are available in Kids Mode for this filter.',
    description: 'Clear filter to view all Kids Safe Skills.',
  },
  filters: {
    icon: FilterX,
    title: 'No Skills match these filters.',
    description: 'Clear filters to browse the full marketplace.',
  },
  'load-error': {
    icon: ToggleLeft,
    title: 'Skills could not be loaded.',
    description: 'Retry loading the Marketplace.',
  },
  'my-skills': {
    icon: Sparkles,
    title: 'No skills in My Skills',
    description: 'Downloaded skills will appear here after you add them.',
  },
  analytics: {
    icon: BarChart3,
    title: 'No analytics yet',
    description: 'Skill usage analytics appear after skills are used.',
  },
  'feature-off': {
    icon: ToggleLeft,
    title: 'Skill Marketplace is not available yet.',
    description: 'This feature is currently disabled for your workspace.',
  },
  marketplace: {
    icon: PackageOpen,
    title: 'No marketplace skills yet',
    description: 'Published skills will appear here when they are available.',
  },
} satisfies Record<
  MarketplaceEmptyStateKind,
  { icon: typeof SearchX; title: string; description: string }
>

export function EmptyState({
  kind,
  action,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  const { t } = useTranslation()
  const config = emptyStateConfig[kind]
  const Icon = config.icon

  return (
    <UIEmpty className={className ?? 'min-h-[320px] border'}>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Icon className='size-6' aria-hidden='true' />
        </EmptyMedia>
        <EmptyTitle>{t(config.title)}</EmptyTitle>
        <EmptyDescription>{t(config.description)}</EmptyDescription>
      </EmptyHeader>
      {(action != null || children != null) && (
        <EmptyContent>
          {action != null && <SkillCTA action={action} onClick={onAction} />}
          {children}
        </EmptyContent>
      )}
    </UIEmpty>
  )
}
