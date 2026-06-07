package dto

import (
	"fmt"
	"net/url"
	"strings"
)

type CustomEndpointTransformer string

const (
	CustomEndpointTransformerOpenAIChatCompletions  CustomEndpointTransformer = "openai_chat_completions"
	CustomEndpointTransformerOpenAICompletions      CustomEndpointTransformer = "openai_completions"
	CustomEndpointTransformerOpenAIResponses        CustomEndpointTransformer = "openai_responses"
	CustomEndpointTransformerOpenAIResponsesCompact CustomEndpointTransformer = "openai_responses_compact"
	CustomEndpointTransformerOpenAIEmbeddings       CustomEndpointTransformer = "openai_embeddings"
	CustomEndpointTransformerOpenAIImages           CustomEndpointTransformer = "openai_images"
	CustomEndpointTransformerOpenAIAudio            CustomEndpointTransformer = "openai_audio"
	CustomEndpointTransformerOpenAIModerations      CustomEndpointTransformer = "openai_moderations"
	CustomEndpointTransformerClaudeMessages         CustomEndpointTransformer = "claude_messages"
	CustomEndpointTransformerGeminiGenerateContent  CustomEndpointTransformer = "gemini_generate_content"
	CustomEndpointTransformerGeminiEmbeddings       CustomEndpointTransformer = "gemini_embeddings"
	CustomEndpointTransformerGeminiImage            CustomEndpointTransformer = "gemini_image"
	CustomEndpointTransformerJinaRerank             CustomEndpointTransformer = "jina_rerank"
	CustomEndpointTransformerCohereRerank           CustomEndpointTransformer = "cohere_rerank"
)

var validCustomEndpointTransformers = map[CustomEndpointTransformer]struct{}{
	CustomEndpointTransformerOpenAIChatCompletions:  {},
	CustomEndpointTransformerOpenAICompletions:      {},
	CustomEndpointTransformerOpenAIResponses:        {},
	CustomEndpointTransformerOpenAIResponsesCompact: {},
	CustomEndpointTransformerOpenAIEmbeddings:       {},
	CustomEndpointTransformerOpenAIImages:           {},
	CustomEndpointTransformerOpenAIAudio:            {},
	CustomEndpointTransformerOpenAIModerations:      {},
	CustomEndpointTransformerClaudeMessages:         {},
	CustomEndpointTransformerGeminiGenerateContent:  {},
	CustomEndpointTransformerGeminiEmbeddings:       {},
	CustomEndpointTransformerGeminiImage:            {},
	CustomEndpointTransformerJinaRerank:             {},
	CustomEndpointTransformerCohereRerank:           {},
}

var supportedCustomEndpointRoutePaths = map[string]struct{}{
	"/v1/chat/completions":     {},
	"/v1/completions":          {},
	"/v1/responses":            {},
	"/v1/responses/compact":    {},
	"/v1/messages":             {},
	"/v1/embeddings":           {},
	"/v1/images/generations":   {},
	"/v1/images/edits":         {},
	"/v1/audio/speech":         {},
	"/v1/audio/transcriptions": {},
	"/v1/audio/translations":   {},
	"/v1/moderations":          {},
	"/v1/rerank":               {},
	"/rerank":                  {},
}

const (
	geminiCustomEndpointV1BetaModelsPrefix = "/v1beta/models/"
	geminiCustomEndpointV1ModelsPrefix     = "/v1/models/"
)

var geminiCustomEndpointRouteSuffixes = []string{
	":generateContent",
	":streamGenerateContent",
	":embedContent",
	":batchEmbedContents",
}

type CustomEndpointSettings struct {
	Routes map[string]CustomEndpointRoute `json:"routes,omitempty"`
}

type CustomEndpointRoute struct {
	Path                   string                    `json:"path"`
	Transformer            CustomEndpointTransformer `json:"transformer"`
	StreamOptionsSupported *bool                     `json:"stream_options_supported,omitempty"`
}

func (r CustomEndpointRoute) SupportsStreamOptions() bool {
	return r.StreamOptionsSupported == nil || *r.StreamOptionsSupported
}

func IsValidCustomEndpointTransformer(transformer CustomEndpointTransformer) bool {
	_, ok := validCustomEndpointTransformers[transformer]
	return ok
}

func (s CustomEndpointSettings) Validate() error {
	if len(s.Routes) == 0 {
		return fmt.Errorf("custom_endpoint.routes is required")
	}
	for routePath, route := range s.Routes {
		if err := validateCustomEndpointRoutePath(routePath); err != nil {
			return err
		}
		if err := route.Validate(routePath); err != nil {
			return err
		}
	}
	return nil
}

func (r CustomEndpointRoute) Validate(routePath string) error {
	path := strings.TrimSpace(r.Path)
	if path == "" {
		return fmt.Errorf("custom_endpoint.routes.%s.path is required", routePath)
	}
	if r.Path != path {
		return fmt.Errorf("custom_endpoint.routes.%s.path must not include surrounding whitespace", routePath)
	}
	parsedURL, err := url.Parse(path)
	if err != nil {
		return fmt.Errorf("custom_endpoint.routes.%s.path is invalid: %w", routePath, err)
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("custom_endpoint.routes.%s.path must start with http:// or https://", routePath)
	}
	if strings.TrimSpace(parsedURL.Host) == "" {
		return fmt.Errorf("custom_endpoint.routes.%s.path must include host", routePath)
	}
	if r.Transformer == "" {
		return fmt.Errorf("custom_endpoint.routes.%s.transformer is required", routePath)
	}
	if !IsValidCustomEndpointTransformer(r.Transformer) {
		return fmt.Errorf("custom_endpoint.routes.%s.transformer is invalid: %s", routePath, r.Transformer)
	}
	return nil
}

func validateCustomEndpointRoutePath(routePath string) error {
	if routePath == "" {
		return fmt.Errorf("custom_endpoint route path is empty")
	}
	if routePath != strings.TrimSpace(routePath) {
		return fmt.Errorf("custom_endpoint route path %s must not include surrounding whitespace", routePath)
	}
	if strings.Contains(routePath, "://") {
		return fmt.Errorf("custom_endpoint route path %s must be an entry path, not a full URL", routePath)
	}
	if !strings.HasPrefix(routePath, "/") {
		return fmt.Errorf("custom_endpoint route path %s must start with /", routePath)
	}
	if strings.Contains(routePath, "?") {
		return fmt.Errorf("custom_endpoint route path %s must not include query", routePath)
	}
	if !isSupportedCustomEndpointRoutePath(routePath) {
		return fmt.Errorf("custom_endpoint route path is unsupported: %s", routePath)
	}
	return nil
}

func isSupportedCustomEndpointRoutePath(routePath string) bool {
	if _, ok := supportedCustomEndpointRoutePaths[routePath]; ok {
		return true
	}
	return isGeminiCustomEndpointRoutePath(routePath)
}

func isGeminiCustomEndpointRoutePath(routePath string) bool {
	modelAndAction, ok := splitGeminiCustomEndpointRoutePath(routePath)
	if !ok {
		return false
	}
	for _, suffix := range geminiCustomEndpointRouteSuffixes {
		if strings.HasSuffix(modelAndAction, suffix) {
			model := strings.TrimSuffix(modelAndAction, suffix)
			return strings.TrimSpace(model) != ""
		}
	}
	return false
}

func splitGeminiCustomEndpointRoutePath(routePath string) (string, bool) {
	switch {
	case strings.HasPrefix(routePath, geminiCustomEndpointV1BetaModelsPrefix):
		return strings.TrimPrefix(routePath, geminiCustomEndpointV1BetaModelsPrefix), true
	case strings.HasPrefix(routePath, geminiCustomEndpointV1ModelsPrefix):
		return strings.TrimPrefix(routePath, geminiCustomEndpointV1ModelsPrefix), true
	default:
		return "", false
	}
}
