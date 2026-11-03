package huawei

// ChannelName is the display name used when creating a Huawei MaaS channel.
var ChannelName = "Huawei MaaS"

// ChatModelList covers the text generation models that Huawei Cloud MaaS serves
// through the OpenAI-compatible interface
// (https://support.huaweicloud.com/model-call-maas/model-call-021.html) and the
// Anthropic-compatible interface
// (https://support.huaweicloud.com/model-call-maas/model-call-022.html).
//
// qwen2.5-vl-72b is deliberately absent: MaaS serves it only through the
// retired V1 standard API (/v1/chat/completions), which this channel never
// calls, so listing it would route requests to a 404.
var ChatModelList = []string{
	"openpangu-2.0-pro",
	"openpangu-2.0-flash",
	"glm-5.3",
	"glm-5.2-arkts-spark",
	"glm-5.2",
	"glm-5.1",
	"kimi-k2.6",
	"deepseek-v4.1-flash-1017",
	"deepseek-v4.1-flash",
	"deepseek-v4-flash",
	"qwen3-32b",
	"qwen3-30b-a3b",
}

// NonChatModelList covers the MaaS models reached through dedicated endpoints:
// text embeddings (model-call-027), rerank (model-call-028) and image
// generation/editing (model-call-023). These stay callable, but they are
// invisible to the model listing at /v2/models (model-call-029), which only
// reports text generation models.
var NonChatModelList = []string{
	"bge-m3",
	"bge-reranker-v2-m3",
	"qwen-image",
	"qwen-image-edit-2509",
	"qwen_image_edit",
}

// ModelList is every model ID this channel can relay.
var ModelList = append(append([]string{}, ChatModelList...), NonChatModelList...)
