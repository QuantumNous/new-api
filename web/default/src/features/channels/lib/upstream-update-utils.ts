export function normalizeModelList(models: unknown[] = []): string[] {
  return Array.from(
    new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean)
    )
  )
}

export function parseUpstreamUpdateMeta(settings: unknown): {
  enabled: boolean
  pendingAddModels: string[]
  pendingRemoveModels: string[]
} {
  let parsed: Record<string, unknown> | null = null
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    parsed = settings as Record<string, unknown>
  } else if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings)
    } catch {
      parsed = null
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { enabled: false, pendingAddModels: [], pendingRemoveModels: [] }
  }

  return {
    enabled: parsed.upstream_model_update_check_enabled === true,
    pendingAddModels: normalizeModelList(
      (parsed.upstream_model_update_last_detected_models as unknown[]) || []
    ),
    pendingRemoveModels: normalizeModelList(
      (parsed.upstream_model_update_last_removed_models as unknown[]) || []
    ),
  }
}
