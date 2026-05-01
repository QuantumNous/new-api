interface TaskActionLabelInput {
  action?: string
  upstream_kind?: string
}

export function getTaskActionLabel(
  log: TaskActionLabelInput,
  fallbackLabel: string
): string {
  if (log.upstream_kind === 'asset' || log.action === 'assetUpload') {
    return 'Asset Upload'
  }
  if (log.upstream_kind === 'image') {
    return 'Image Generation'
  }
  return fallbackLabel
}
