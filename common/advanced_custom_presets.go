package common

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// GetAdvancedCustomPreset returns fresh defaults.
func GetAdvancedCustomPreset(channelType int) *dto.AdvancedCustomConfig {
	if channelType != constant.ChannelTypeVLLM && channelType != constant.ChannelTypeSGLang {
		return nil
	}
	config := &dto.AdvancedCustomConfig{}
	for _, path := range []string{
		"/v1/chat/completions",
		"/v1/completions",
		"/v1/responses",
		"/v1/embeddings",
		"/v1/messages",
		"/v1/audio/transcriptions",
		"/v1/audio/translations",
		dto.AdvancedCustomModelListPath,
	} {
		config.Routes = append(config.Routes, dto.AdvancedCustomRoute{
			IncomingPath: path, UpstreamPath: path, Converter: "none",
			Auth: &dto.AdvancedCustomRouteAuth{Type: dto.AdvancedCustomAuthTypeHeader, Name: "Authorization", Value: "Bearer {api_key}"},
		})
	}
	// vLLM returns the Jina /v1/rerank envelope natively; SGLang returns a
	// sorted score array that needs jina_rerank_to_sglang.
	rerankConverter := "none"
	if channelType == constant.ChannelTypeSGLang {
		rerankConverter = dto.AdvancedCustomConverterSGLangRerank
	}
	for _, path := range []string{"/v1/rerank", "/rerank"} {
		config.Routes = append(config.Routes, dto.AdvancedCustomRoute{
			IncomingPath: path, UpstreamPath: "/v1/rerank", Converter: rerankConverter,
		})
	}
	return config
}
