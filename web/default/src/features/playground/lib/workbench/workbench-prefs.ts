/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
export type WorkbenchChatTools = {
  webSearch: boolean
  mode: 'auto' | 'image' | 'video' | 'search'
  carryHistory: boolean
  longMemory: boolean
  maxToolLoops: number
  systemPrompt: string
  visualOutput: boolean
}

export type DuoCollabState = {
  enabled: boolean
  answerModels: string[]
  summaryModel: string
}

export type WorkbenchPrefs = {
  pinnedModels: string[]
  chatTools: WorkbenchChatTools
  duo: DuoCollabState
}

export const DEFAULT_CHAT_TOOLS: WorkbenchChatTools = {
  webSearch: false,
  mode: 'auto',
  carryHistory: true,
  longMemory: false,
  maxToolLoops: 3,
  systemPrompt: '',
  visualOutput: true,
}

export const DEFAULT_DUO: DuoCollabState = {
  enabled: false,
  answerModels: [],
  summaryModel: '',
}

export const DEFAULT_WORKBENCH_PREFS: WorkbenchPrefs = {
  pinnedModels: [],
  chatTools: DEFAULT_CHAT_TOOLS,
  duo: DEFAULT_DUO,
}

export const WORKBENCH_STORAGE_KEY = 'playground_workbench_prefs_v1'
export const MAX_PINNED_MODELS = 40
export const MAX_SYSTEM_PROMPT_CHARS = 8000

export function clampSystemPrompt(value: string | undefined | null): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, MAX_SYSTEM_PROMPT_CHARS)
}

export function normalizeChatTools(
  value: Partial<WorkbenchChatTools> | undefined | null
): WorkbenchChatTools {
  let mode: WorkbenchChatTools['mode'] = value?.webSearch ? 'search' : 'auto'
  if (
    value?.mode === 'image' ||
    value?.mode === 'video' ||
    value?.mode === 'search'
  ) {
    mode = value.mode
  }
  return {
    webSearch: value?.webSearch === true,
    mode,
    carryHistory: value?.carryHistory !== false,
    longMemory: value?.longMemory === true,
    maxToolLoops: clampInt(value?.maxToolLoops, 1, 20, 3),
    systemPrompt: clampSystemPrompt(value?.systemPrompt),
    visualOutput: value?.visualOutput !== false,
  }
}

export function loadWorkbenchPrefs(): WorkbenchPrefs {
  try {
    const raw = localStorage.getItem(WORKBENCH_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_WORKBENCH_PREFS)
    const parsed = JSON.parse(raw) as Partial<WorkbenchPrefs>
    return {
      pinnedModels: Array.isArray(parsed.pinnedModels)
        ? parsed.pinnedModels
            .filter((item): item is string => typeof item === 'string')
            .slice(0, MAX_PINNED_MODELS)
        : [],
      chatTools: normalizeChatTools(parsed.chatTools),
      duo: {
        ...DEFAULT_DUO,
        ...parsed.duo,
        enabled: parsed.duo?.enabled === true,
        answerModels: Array.isArray(parsed.duo?.answerModels)
          ? parsed.duo.answerModels
              .filter((item): item is string => typeof item === 'string')
              .slice(0, 5)
          : [],
        summaryModel:
          typeof parsed.duo?.summaryModel === 'string'
            ? parsed.duo.summaryModel
            : '',
      },
    }
  } catch {
    return structuredClone(DEFAULT_WORKBENCH_PREFS)
  }
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value as number)))
}
