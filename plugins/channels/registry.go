package channels

import (
	"fmt"
	
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/core/registry"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/ali"
	"github.com/QuantumNous/new-api/relay/channel/aws"
	"github.com/QuantumNous/new-api/relay/channel/baidu"
	"github.com/QuantumNous/new-api/relay/channel/baidu_v2"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/cloudflare"
	"github.com/QuantumNous/new-api/relay/channel/cohere"
	"github.com/QuantumNous/new-api/relay/channel/coze"
	"github.com/QuantumNous/new-api/relay/channel/deepseek"
	"github.com/QuantumNous/new-api/relay/channel/dify"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/jimeng"
	"github.com/QuantumNous/new-api/relay/channel/jina"
	"github.com/QuantumNous/new-api/relay/channel/mistral"
	"github.com/QuantumNous/new-api/relay/channel/mokaai"
	"github.com/QuantumNous/new-api/relay/channel/moonshot"
	"github.com/QuantumNous/new-api/relay/channel/ollama"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	"github.com/QuantumNous/new-api/relay/channel/palm"
	"github.com/QuantumNous/new-api/relay/channel/perplexity"
	"github.com/QuantumNous/new-api/relay/channel/siliconflow"
	"github.com/QuantumNous/new-api/relay/channel/submodel"
	"github.com/QuantumNous/new-api/relay/channel/tencent"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	"github.com/QuantumNous/new-api/relay/channel/volcengine"
	"github.com/QuantumNous/new-api/relay/channel/xai"
	"github.com/QuantumNous/new-api/relay/channel/xunfei"
	"github.com/QuantumNous/new-api/relay/channel/zhipu"
	"github.com/QuantumNous/new-api/relay/channel/zhipu_4v"
)

// init 包初始化时自动注册所有Channel插件
func init() {
	RegisterAllChannels()
}

// RegisterAllChannels 注册所有Channel插件
func RegisterAllChannels() {
	// 包装现有的Adaptor并注册为插件
	channels := []struct {
		channelType int
		adaptor     channel.Adaptor
		name        string
	}{
		{constant.APITypeOpenAI, &openai.Adaptor{}, "openai"},
		{constant.APITypeAnthropic, &claude.Adaptor{}, "claude"},
		{constant.APITypeGemini, &gemini.Adaptor{}, "gemini"},
		{constant.APITypeAli, &ali.Adaptor{}, "ali"},
		{constant.APITypeBaidu, &baidu.Adaptor{}, "baidu"},
		{constant.APITypeBaiduV2, &baidu_v2.Adaptor{}, "baidu_v2"},
		{constant.APITypeTencent, &tencent.Adaptor{}, "tencent"},
		{constant.APITypeXunfei, &xunfei.Adaptor{}, "xunfei"},
		{constant.APITypeZhipu, &zhipu.Adaptor{}, "zhipu"},
		{constant.APITypeZhipuV4, &zhipu_4v.Adaptor{}, "zhipu_v4"},
		{constant.APITypeOllama, &ollama.Adaptor{}, "ollama"},
		{constant.APITypePerplexity, &perplexity.Adaptor{}, "perplexity"},
		{constant.APITypeAws, &aws.Adaptor{}, "aws"},
		{constant.APITypeCohere, &cohere.Adaptor{}, "cohere"},
		{constant.APITypeDify, &dify.Adaptor{}, "dify"},
		{constant.APITypeJina, &jina.Adaptor{}, "jina"},
		{constant.APITypeCloudflare, &cloudflare.Adaptor{}, "cloudflare"},
		{constant.APITypeSiliconFlow, &siliconflow.Adaptor{}, "siliconflow"},
		{constant.APITypeVertexAi, &vertex.Adaptor{}, "vertex"},
		{constant.APITypeMistral, &mistral.Adaptor{}, "mistral"},
		{constant.APITypeDeepSeek, &deepseek.Adaptor{}, "deepseek"},
		{constant.APITypeMokaAI, &mokaai.Adaptor{}, "mokaai"},
		{constant.APITypeVolcEngine, &volcengine.Adaptor{}, "volcengine"},
		{constant.APITypeXai, &xai.Adaptor{}, "xai"},
		{constant.APITypeCoze, &coze.Adaptor{}, "coze"},
		{constant.APITypeJimeng, &jimeng.Adaptor{}, "jimeng"},
		{constant.APITypeMoonshot, &moonshot.Adaptor{}, "moonshot"},
		{constant.APITypeSubmodel, &submodel.Adaptor{}, "submodel"},
		{constant.APITypePaLM, &palm.Adaptor{}, "palm"},
		// OpenRouter 和 Xinference 使用 OpenAI adaptor
		{constant.APITypeOpenRouter, &openai.Adaptor{}, "openrouter"},
		{constant.APITypeXinference, &openai.Adaptor{}, "xinference"},
	}
	
	registeredCount := 0
	for _, ch := range channels {
		plugin := NewBaseChannelPlugin(
			ch.adaptor,
			ch.name,
			"1.0.0",
			100, // 默认优先级
		)
		
		if err := registry.RegisterChannel(ch.channelType, plugin); err != nil {
			common.SysError("Failed to register channel plugin: " + ch.name + ", error: " + err.Error())
		} else {
			registeredCount++
		}
	}
	
	common.SysLog(fmt.Sprintf("Registered %d channel plugins", registeredCount))
}

