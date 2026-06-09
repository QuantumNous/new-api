package blockrun

// ChannelName 是该渠道的内部标识。
const ChannelName = "blockrun"

// ModelList 是 BlockRun 当前支持的 LLM 模型清单。
//
// 数据来源：实际调用 GET https://blockrun.ai/api/v1/models 抓取（仅保留
// chat completions 类的模型；BlockRun 还提供 image/video/music 等模型，但走
// 独立 endpoint，本适配器目前未支持）。BlockRun 是聚合中转站，模型 ID 由它
// 自己定义（namespace/model 格式），与各上游厂商的官方版本号不一定对应。
//
// 用户在管理端可以覆盖此清单，这里仅提供"填充默认模型"按钮的初始集合。
// 上游若新增/下线模型，可重新调用 /v1/models 同步。
var ModelList = []string{
	// Anthropic (verified against gateway GET /v1/models, 2026-06-03)
	"anthropic/claude-haiku-4.5",
	"anthropic/claude-sonnet-4.5",
	"anthropic/claude-sonnet-4.6",
	"anthropic/claude-opus-4.5",
	"anthropic/claude-opus-4.7",
	"anthropic/claude-opus-4.8",
	// OpenAI
	"openai/gpt-5.5",
	"openai/gpt-5.4",
	"openai/gpt-5.4-pro",
	"openai/gpt-5.4-mini",
	"openai/gpt-5.4-nano",
	"openai/gpt-5.3",
	"openai/gpt-5.3-codex",
	"openai/gpt-5.2",
	"openai/gpt-5.2-pro",
	"openai/gpt-5-mini",
	"openai/o1",
	"openai/o1-mini",
	"openai/o3",
	"openai/o3-mini",
	// Google
	"google/gemini-3.1-pro",
	"google/gemini-3-pro-preview",
	"google/gemini-3-flash-preview",
	"google/gemini-3.1-flash-lite",
	"google/gemini-2.5-pro",
	"google/gemini-2.5-flash",
	"google/gemini-2.5-flash-lite",
	// DeepSeek
	"deepseek/deepseek-v4-pro",
	"deepseek/deepseek-chat",
	"deepseek/deepseek-reasoner",
	// Moonshot
	"moonshot/kimi-k2.6",
	// Z.AI (GLM)
	"zai/glm-5.1",
	"zai/glm-5",
	"zai/glm-5-turbo",
	// MiniMax
	"minimax/minimax-m2.7",
	// NVIDIA-hosted open models
	"nvidia/deepseek-v4-flash",
	"nvidia/qwen3-coder-480b",
	"nvidia/qwen3-next-80b-a3b-thinking",
	"nvidia/llama-4-maverick",
	"nvidia/mistral-small-4-119b",
	"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
	// Image generation (/v1/images/generations) and image2image edit/fusion
	// (/v1/images/image2image). Edit-capable: gpt-image-1, gpt-image-2,
	// nano-banana, nano-banana-pro.
	"openai/gpt-image-2",
	"openai/gpt-image-1",
	"openai/dall-e-3",
	"google/nano-banana",
	"google/nano-banana-pro",
	"black-forest/flux-1.1-pro",
	"xai/grok-imagine-image",
	"xai/grok-imagine-image-pro",
	"zai/cogview-4",
}
