package huawei

// ChannelName is the display name used when creating a Huawei MaaS channel.
var ChannelName = "Huawei MaaS"

// ModelList covers the models documented by Huawei Cloud MaaS
// (https://support.huaweicloud.com/model-call-maas/): chat models served via
// the OpenAI-compatible interface, plus embeddings, rerank, and image
// generation/editing models.
var ModelList = []string{
	"openpangu-2.0-pro",
	"openpangu-2.0-flash",
	"glm-5.2",
	"glm-5.1",
	"kimi-k2.6",
	"deepseek-v4-pro",
	"deepseek-v4-flash",
	"qwen3-32b",
	"qwen3-30b-a3b",
	"qwen2.5-vl-72b",
	"bge-m3",
	"bge-reranker-v2-m3",
	"qwen-image",
	"qwen-image-edit-2509",
	"qwen_image_edit",
}
