export type ImageWorkbenchRequest = {
  model: string
  group?: string
  prompt: string
  n: number
  size: string
  quality: string
  response_format: 'b64_json' | 'url'
  output_format?: 'png' | 'jpeg' | 'webp'
}

export type ImageWorkbenchData = {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export type ImageWorkbenchResponse = {
  created?: number
  data?: ImageWorkbenchData[]
}

export type GeneratedImage = {
  id: string
  src: string
  prompt: string
  revisedPrompt?: string
  model: string
  size: string
  quality: string
  outputFormat: string
  createdAt: string
}
