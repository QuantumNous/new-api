import type { ModelCategory } from '../types'

// 默认模型分类展示（后端 /api/public/model-catalog 未配置时的兜底）。
// 仅展示分类与能力标签，不承诺具体可用性 / 价格 / 指标。
export const defaultModelCategories: Record<'en' | 'zh', ModelCategory[]> = {
  en: [
    {
      category: 'chinese',
      title: 'Chinese LLMs',
      description: 'Leading Chinese large models and multimodal capabilities, outbound.',
      models: [
        { name: 'Chinese Chat Models', capabilityTags: ['chat', 'reasoning'], note: 'Text generation and reasoning.' },
        { name: 'Chinese Vision-Language', capabilityTags: ['vision', 'multimodal'], note: 'Image understanding and multimodal.' },
      ],
    },
    {
      category: 'global',
      title: 'Global LLMs',
      description: 'Mainstream overseas models, unified inbound access.',
      models: [
        { name: 'GPT-class models', capabilityTags: ['chat', 'function-calling'], note: 'General chat and tool use.' },
        { name: 'Claude-class models', capabilityTags: ['chat', 'long-context'], note: 'Long-context assistants.' },
        { name: 'Gemini-class models', capabilityTags: ['multimodal', 'vision'], note: 'Multimodal generation.' },
      ],
    },
    {
      category: 'image',
      title: 'Image Models',
      description: 'Image generation, editing, and visual understanding.',
      models: [
        { name: 'Image Generation', capabilityTags: ['image', 'generation'], note: 'Text-to-image.' },
        { name: 'Image Editing', capabilityTags: ['image', 'edit'], note: 'Instructed editing.' },
      ],
    },
    {
      category: 'video',
      title: 'Video Models',
      description: 'Video generation, task query, and async processing.',
      models: [
        { name: 'Video Generation', capabilityTags: ['video', 'generation'], note: 'Text-to-video tasks.' },
      ],
    },
    {
      category: 'audio',
      title: 'Audio Models',
      description: 'Speech recognition, synthesis, and translation.',
      models: [
        { name: 'Speech Recognition', capabilityTags: ['audio', 'asr'], note: 'Transcription.' },
        { name: 'Speech Synthesis', capabilityTags: ['audio', 'tts'], note: 'Text-to-speech.' },
      ],
    },
    {
      category: 'embedding',
      title: 'Embedding & Rerank',
      description: 'Vectors, reranking, and search augmentation.',
      models: [
        { name: 'Embeddings', capabilityTags: ['embedding'], note: 'Vector representations.' },
        { name: 'Rerank', capabilityTags: ['rerank'], note: 'Result reranking.' },
      ],
    },
  ],
  zh: [
    {
      category: 'chinese',
      title: '中国大模型',
      description: '领先的中国大模型与多模态能力，出海输出。',
      models: [
        { name: '中国对话模型', capabilityTags: ['对话', '推理'], note: '文本生成与推理。' },
        { name: '中国视觉语言模型', capabilityTags: ['视觉', '多模态'], note: '图像理解与多模态。' },
      ],
    },
    {
      category: 'global',
      title: '海外大模型',
      description: '海外主流模型，统一接入。',
      models: [
        { name: 'GPT 类模型', capabilityTags: ['对话', '函数调用'], note: '通用对话与工具调用。' },
        { name: 'Claude 类模型', capabilityTags: ['对话', '长上下文'], note: '长上下文助手。' },
        { name: 'Gemini 类模型', capabilityTags: ['多模态', '视觉'], note: '多模态生成。' },
      ],
    },
    {
      category: 'image',
      title: '图像模型',
      description: '图像生成、编辑与视觉理解。',
      models: [
        { name: '图像生成', capabilityTags: ['图像', '生成'], note: '文生图。' },
        { name: '图像编辑', capabilityTags: ['图像', '编辑'], note: '指令编辑。' },
      ],
    },
    {
      category: 'video',
      title: '视频模型',
      description: '视频生成、任务查询与异步处理。',
      models: [{ name: '视频生成', capabilityTags: ['视频', '生成'], note: '文生视频任务。' }],
    },
    {
      category: 'audio',
      title: '音频模型',
      description: '语音识别、合成与翻译。',
      models: [
        { name: '语音识别', capabilityTags: ['音频', '识别'], note: '转写。' },
        { name: '语音合成', capabilityTags: ['音频', '合成'], note: '文本转语音。' },
      ],
    },
    {
      category: 'embedding',
      title: '向量与重排',
      description: '向量、重排与搜索增强。',
      models: [
        { name: '向量嵌入', capabilityTags: ['嵌入'], note: '向量表示。' },
        { name: '重排', capabilityTags: ['重排'], note: '结果重排。' },
      ],
    },
  ],
}
