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
	paths := []string{"/v1/chat/completions", "/v1/completions", "/v1/responses", "/v1/embeddings", "/v1/messages"}
	if channelType == constant.ChannelTypeVLLM {
		paths = append(paths, "/v1/audio/transcriptions", "/v1/audio/translations")
	}
	paths = append(paths, dto.AdvancedCustomModelListPath)
	for _, path := range paths {
		config.Routes = append(config.Routes, dto.AdvancedCustomRoute{
			IncomingPath: path, UpstreamPath: path, Converter: "none",
			Auth: &dto.AdvancedCustomRouteAuth{Type: dto.AdvancedCustomAuthTypeHeader, Name: "Authorization", Value: "Bearer {api_key}"},
		})
	}
	if channelType == constant.ChannelTypeVLLM {
		// vLLM returns the Jina /v1/rerank envelope natively.
		for _, path := range []string{"/v1/rerank", "/rerank"} {
			config.Routes = append(config.Routes, dto.AdvancedCustomRoute{
				IncomingPath: path, UpstreamPath: "/v1/rerank", Converter: "none",
			})
		}
	}
	if channelType == constant.ChannelTypeSGLang {
		for _, path := range []string{"/v1/rerank", "/rerank"} {
			config.Routes = append(config.Routes, dto.AdvancedCustomRoute{
				IncomingPath: path, UpstreamPath: "/v1/rerank", Converter: dto.AdvancedCustomConverterSGLangRerank,
			})
		}
	}
	return config
}
