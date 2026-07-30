package model

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

type IntegrationProfile struct {
	ID                  string `json:"id"`
	Protocol            string `json:"protocol"`
	Operation           string `json:"operation"`
	NameKey             string `json:"name_key"`
	Method              string `json:"method"`
	GatewayPathTemplate string `json:"gateway_path_template"`
	AuthScheme          string `json:"auth_scheme"`
	ContentType         string `json:"content_type"`
	DocsSlug            string `json:"docs_slug"`
	SampleKind          string `json:"sample_kind"`
	Streaming           bool   `json:"streaming"`
}

type ModelIntegration struct {
	ProfileID string   `json:"profile_id"`
	Groups    []string `json:"groups"`
	Verified  bool     `json:"verified"`
	Source    string   `json:"source"`
}

var integrationProfiles = []IntegrationProfile{
	{ID: "openai.chat_completions", Protocol: "openai", Operation: "chat_completions", NameKey: "OpenAI Chat Completions", Method: "POST", GatewayPathTemplate: "/v1/chat/completions", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-chat-completions", SampleKind: "openai_chat", Streaming: true},
	{ID: "openai.responses", Protocol: "openai", Operation: "responses", NameKey: "OpenAI Responses", Method: "POST", GatewayPathTemplate: "/v1/responses", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-responses", SampleKind: "openai_responses", Streaming: true},
	{ID: "openai.responses_compact", Protocol: "openai", Operation: "responses_compact", NameKey: "OpenAI Responses Compact", Method: "POST", GatewayPathTemplate: "/v1/responses/compact", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-responses-compact", SampleKind: "openai_responses_compact"},
	{ID: "anthropic.messages", Protocol: "anthropic", Operation: "messages", NameKey: "Anthropic Messages", Method: "POST", GatewayPathTemplate: "/v1/messages", AuthScheme: "x-api-key", ContentType: "application/json", DocsSlug: "anthropic-messages", SampleKind: "anthropic_messages", Streaming: true},
	{ID: "gemini.generate_content", Protocol: "gemini", Operation: "generate_content", NameKey: "Gemini Generate Content", Method: "POST", GatewayPathTemplate: "/v1beta/models/{model}:generateContent", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "gemini-generate-content", SampleKind: "gemini_generate_content"},
	{ID: "openai.embeddings", Protocol: "openai", Operation: "embeddings", NameKey: "OpenAI Embeddings", Method: "POST", GatewayPathTemplate: "/v1/embeddings", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-embeddings", SampleKind: "openai_embeddings"},
	{ID: "jina.rerank", Protocol: "jina", Operation: "rerank", NameKey: "Jina Rerank", Method: "POST", GatewayPathTemplate: "/v1/rerank", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "jina-rerank", SampleKind: "jina_rerank"},
	{ID: "openai.images.generate", Protocol: "openai", Operation: "images_generate", NameKey: "OpenAI Images", Method: "POST", GatewayPathTemplate: "/v1/images/generations", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-images-generate", SampleKind: "openai_images"},
	{ID: "openai.audio.speech", Protocol: "openai", Operation: "audio_speech", NameKey: "OpenAI Speech", Method: "POST", GatewayPathTemplate: "/v1/audio/speech", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-audio-speech", SampleKind: "openai_audio_speech", Streaming: true},
	{ID: "openai.audio.transcriptions", Protocol: "openai", Operation: "audio_transcriptions", NameKey: "OpenAI Transcriptions", Method: "POST", GatewayPathTemplate: "/v1/audio/transcriptions", AuthScheme: "bearer", ContentType: "multipart/form-data", DocsSlug: "openai-audio-transcriptions", SampleKind: "openai_audio_transcriptions"},
	{ID: "openai.video.create", Protocol: "openai", Operation: "video_create", NameKey: "OpenAI Video", Method: "POST", GatewayPathTemplate: "/v1/videos", AuthScheme: "bearer", ContentType: "multipart/form-data", DocsSlug: "openai-video-create", SampleKind: "openai_video"},
	{ID: "openai.realtime", Protocol: "openai", Operation: "realtime", NameKey: "OpenAI Realtime", Method: "GET", GatewayPathTemplate: "/v1/realtime?model={model}", AuthScheme: "bearer", ContentType: "application/json", DocsSlug: "openai-realtime", SampleKind: "openai_realtime", Streaming: true},
}

func GetIntegrationProfiles() []IntegrationProfile {
	return append([]IntegrationProfile(nil), integrationProfiles...)
}

// NormalizeModelIntegrations validates explicit assignments. Groups are required:
// an empty group list never means global access and is rejected.
func NormalizeModelIntegrations(raw string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", nil
	}
	var assignments []ModelIntegration
	if err := common.Unmarshal([]byte(raw), &assignments); err != nil {
		return "", fmt.Errorf("invalid integrations JSON: %w", err)
	}
	known := make(map[string]struct{}, len(integrationProfiles))
	for _, profile := range integrationProfiles {
		known[profile.ID] = struct{}{}
	}
	byProfile := make(map[string]map[string]struct{})
	for _, assignment := range assignments {
		id := strings.TrimSpace(assignment.ProfileID)
		if _, ok := known[id]; !ok {
			return "", fmt.Errorf("unknown integration profile_id %q", id)
		}
		if byProfile[id] == nil {
			byProfile[id] = make(map[string]struct{})
		}
		for _, group := range assignment.Groups {
			if group = strings.TrimSpace(group); group != "" {
				byProfile[id][group] = struct{}{}
			}
		}
		if len(byProfile[id]) == 0 {
			return "", fmt.Errorf("integration %q must specify at least one group", id)
		}
	}
	ids := make([]string, 0, len(byProfile))
	for id := range byProfile {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	normalized := make([]ModelIntegration, 0, len(ids))
	for _, id := range ids {
		groups := make([]string, 0, len(byProfile[id]))
		for group := range byProfile[id] {
			groups = append(groups, group)
		}
		sort.Strings(groups)
		normalized = append(normalized, ModelIntegration{ProfileID: id, Groups: groups, Verified: true, Source: "explicit"})
	}
	data, err := common.Marshal(normalized)
	return string(data), err
}

var endpointProfileIDs = map[constant.EndpointType]string{
	constant.EndpointTypeOpenAI: "openai.chat_completions", constant.EndpointTypeOpenAIResponse: "openai.responses",
	constant.EndpointTypeOpenAIResponseCompact: "openai.responses_compact", constant.EndpointTypeAnthropic: "anthropic.messages",
	constant.EndpointTypeOpenAIAlphaSearch: "openai.alpha_search",
	constant.EndpointTypeGemini:            "gemini.generate_content", constant.EndpointTypeEmbeddings: "openai.embeddings",
	constant.EndpointTypeJinaRerank: "jina.rerank", constant.EndpointTypeImageGeneration: "openai.images.generate",
	constant.EndpointTypeOpenAIVideo: "openai.video.create",
}
