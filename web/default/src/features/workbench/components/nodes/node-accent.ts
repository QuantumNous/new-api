/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Frame,
  Image as ImageIcon,
  Music,
  Settings2,
  StickyNote,
  Table,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { CanvasNodeType } from '../../types'

/**
 * Per-type identity for node cards. The tint is what lets a dense canvas read
 * as a composition instead of a wall of identical grey boxes.
 */
type NodeAccent = {
  icon: LucideIcon
  /** Tailwind gradient for the header icon chip. */
  chip: string
  /** Faint wash behind the card header. */
  wash: string
  /** Ring colour used while the node is selected or hovered. */
  ring: string
}

const NODE_ACCENTS: Record<CanvasNodeType, NodeAccent> = {
  [CanvasNodeType.Image]: {
    icon: ImageIcon,
    chip: 'from-violet-500 to-fuchsia-500',
    wash: 'from-violet-500/12',
    ring: 'rgba(139,92,246,.45)',
  },
  [CanvasNodeType.Video]: {
    icon: Video,
    chip: 'from-sky-500 to-cyan-500',
    wash: 'from-sky-500/12',
    ring: 'rgba(14,165,233,.45)',
  },
  [CanvasNodeType.Audio]: {
    icon: Music,
    chip: 'from-emerald-500 to-teal-500',
    wash: 'from-emerald-500/12',
    ring: 'rgba(16,185,129,.45)',
  },
  [CanvasNodeType.Text]: {
    icon: StickyNote,
    chip: 'from-amber-400 to-orange-500',
    wash: 'from-amber-400/14',
    ring: 'rgba(245,158,11,.45)',
  },
  [CanvasNodeType.Script]: {
    icon: Table,
    chip: 'from-rose-500 to-pink-500',
    wash: 'from-rose-500/12',
    ring: 'rgba(244,63,94,.45)',
  },
  [CanvasNodeType.Config]: {
    icon: Settings2,
    chip: 'from-slate-500 to-slate-700',
    wash: 'from-slate-500/12',
    ring: 'rgba(100,116,139,.45)',
  },
  [CanvasNodeType.Frame]: {
    icon: Frame,
    chip: 'from-slate-400 to-slate-600',
    wash: 'from-slate-400/10',
    ring: 'rgba(148,163,184,.45)',
  },
}

export function nodeAccent(type: CanvasNodeType): NodeAccent {
  return NODE_ACCENTS[type]
}
