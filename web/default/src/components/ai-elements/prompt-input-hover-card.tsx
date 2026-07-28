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
'use client'

import type { ComponentProps } from 'react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>

export const PromptInputHoverCard = (props: PromptInputHoverCardProps) => (
  <HoverCard {...props} />
)

export type PromptInputHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>

export const PromptInputHoverCardTrigger = ({
  delay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardTriggerProps) => (
  <HoverCardTrigger delay={delay} closeDelay={closeDelay} {...props} />
)

export type PromptInputHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>

export const PromptInputHoverCardContent = ({
  align = 'start',
  ...props
}: PromptInputHoverCardContentProps) => (
  <HoverCardContent align={align} {...props} />
)
