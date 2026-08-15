package zhipu

// This channel targets Zhipu's **legacy v3** API
// (/api/paas/v3/model-api/{model}/invoke) — the chatglm_* names below are the
// only models that endpoint ever served. Current GLM models (glm-5.x / glm-4.x)
// live on the v4 platform: see relay/channel/zhipu_4v.
var ModelList = []string{
	"chatglm_turbo", "chatglm_pro", "chatglm_std", "chatglm_lite",
}

var ChannelName = "zhipu"
