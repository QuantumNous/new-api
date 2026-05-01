interface TaskActionLabelInput {
  upstream_kind?: string
}

export function getTaskActionLabel(
  log: TaskActionLabelInput,
  fallbackLabel: string
): string {
  if (log.upstream_kind === 'asset') {
    return 'Asset Upload'
  }
  if (log.upstream_kind === 'image') {
    return 'Image Generation'
  }
  return fallbackLabel
}
