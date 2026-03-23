export const normalizeModelList = (models = []) =>
  Array.from(
    new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean),
    ),
  );

export const parseUpstreamUpdateMeta = (settings) => {
  let parsed = null;
  if (settings && typeof settings === 'object') {
    parsed = settings;
  } else if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings);
    } catch (error) {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      enabled: false,
      pendingAddModels: [],
      pendingRemoveModels: [],
    };
  }

  return {
    enabled: parsed.upstream_model_update_check_enabled === true,
    pendingAddModels: normalizeModelList(
      parsed.upstream_model_update_last_detected_models,
    ),
    pendingRemoveModels: normalizeModelList(
      parsed.upstream_model_update_last_removed_models,
    ),
  };
};
