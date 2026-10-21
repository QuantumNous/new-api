export const MODEL_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'image', label: 'Image' },
  { value: 'file', label: 'File' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
] as const

export type ModelType = (typeof MODEL_TYPE_OPTIONS)[number]['value']

export function inferModelType(modelName: string): ModelType {
  const lower = modelName.toLowerCase()
  if (
    lower.includes('embedding') ||
    lower.includes('embed') ||
    lower.includes('bge-') ||
    lower.startsWith('m3e')
  ) {
    return 'embedding'
  }
  if (
    lower.includes('seedream') ||
    lower.includes('image') ||
    lower.includes('gpt-image')
  ) {
    return 'image'
  }
  if (
    lower.includes('seedance') ||
    lower.includes('video') ||
    lower.includes('sora')
  ) {
    return 'video'
  }
  if (
    lower.includes('tts') ||
    lower.includes('audio') ||
    lower.includes('speech')
  ) {
    return 'audio'
  }
  if (lower.includes('file')) {
    return 'file'
  }
  return 'text'
}
