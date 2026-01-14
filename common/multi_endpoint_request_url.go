package common

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

const (
	MultiEndpointKeyDefault         = "default"
	MultiEndpointKeyOpenAI          = "openai"
	MultiEndpointKeyOpenAIResponses = "openai_responses"
	MultiEndpointKeyEmbedding       = "embedding"
	MultiEndpointKeyOpenAIImage     = "openai_image"
	MultiEndpointKeyOpenAIAudio     = "openai_audio"
	MultiEndpointKeyOpenAIRealtime  = "openai_realtime"
	MultiEndpointKeyRerank          = "rerank"
	MultiEndpointKeyClaude          = "claude"
	MultiEndpointKeyGemini          = "gemini"
)

// ResolveMultiEndpointRequestURL resolves the final upstream request URL for the given incoming request path.
//
// rawConfig supports:
//   - A plain URL (treated as the "openai" endpoint).
//   - A JSON object: endpoint_key -> full request URL template.
//
// Supported template variables:
//   - {model}: replaced with upstream model name.
//   - {path}: replaced with the incoming request path (no query string).
//   - {query}: replaced with the incoming query string (including leading '?', or empty).
//
// Realtime behavior:
func ResolveMultiEndpointRequestURL(rawConfig string, requestURLPath string, upstreamModelName string) (string, error) {
	trimmed := strings.TrimSpace(rawConfig)
	if trimmed == "" {
		return "", nil
	}

	pathOnly, queryPart := splitPathAndQuery(requestURLPath)

	// Allow a plain URL as a shorthand config.
	if !strings.HasPrefix(trimmed, "{") {
		u, err := applyTemplate(trimmed, upstreamModelName, pathOnly, queryPart)
		if err != nil {
			return "", err
		}
		return validateResolvedURL(trimmed, u, pathOnly, queryPart)
	}

	cfg, err := parseMultiEndpointURLConfig(trimmed)
	if err != nil {
		return "", err
	}

	key := multiEndpointKeyForPath(pathOnly)
	u := cfg[key]
	if u == "" {
		u = cfg[MultiEndpointKeyDefault]
	}
	if u == "" {
		u = cfg[MultiEndpointKeyOpenAI]
	}
	if u == "" {
		return "", nil
	}

	resolved, err := applyTemplate(u, upstreamModelName, pathOnly, queryPart)
	if err != nil {
		return "", err
	}
	return validateResolvedURL(u, resolved, pathOnly, queryPart)
}

func parseMultiEndpointURLConfig(raw string) (map[string]string, error) {
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil, fmt.Errorf("multi-endpoint 渠道 base_url 不是合法的 JSON：%w", err)
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		ks := canonicalMultiEndpointKey(k)
		if ks == "" {
			continue
		}
		vs, ok := v.(string)
		if !ok {
			continue
		}
		vs = strings.TrimSpace(vs)
		if vs == "" {
			continue
		}
		out[ks] = vs
	}
	return out, nil
}

func canonicalMultiEndpointKey(k string) string {
	ks := strings.TrimSpace(strings.ToLower(k))
	ks = strings.ReplaceAll(ks, "-", "_")
	ks = strings.ReplaceAll(ks, " ", "")

	switch ks {
	case MultiEndpointKeyDefault:
		return MultiEndpointKeyDefault
	case "openai_response", "openai_responses", "openairesponse", "openairesponses":
		return MultiEndpointKeyOpenAIResponses
	case "embeddings", "embedding":
		return MultiEndpointKeyEmbedding
	case "image", "images", "openai_image", "openai_image_generation", "openai_image_edit", "image_generation", "imagegeneration", "image_generations", "imagegenerations", "image_edit", "imageedit", "image_edits", "imageedits":
		return MultiEndpointKeyOpenAIImage
	case "audio", "openai_audio", "openai_audios":
		return MultiEndpointKeyOpenAIAudio
	case "realtime", "openai_realtime":
		return MultiEndpointKeyOpenAIRealtime
	case "rerank":
		return MultiEndpointKeyRerank
	case "claude", "anthropic":
		return MultiEndpointKeyClaude
	case "gemini":
		return MultiEndpointKeyGemini
	case "openai":
		return MultiEndpointKeyOpenAI
	default:
		return ""
	}
}

func multiEndpointKeyForPath(path string) string {
	if strings.HasPrefix(path, "/v1/messages") {
		return MultiEndpointKeyClaude
	}
	switch relayconstant.Path2RelayMode(path) {
	case relayconstant.RelayModeResponses:
		return MultiEndpointKeyOpenAIResponses
	case relayconstant.RelayModeEmbeddings:
		return MultiEndpointKeyEmbedding
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits, relayconstant.RelayModeEdits:
		return MultiEndpointKeyOpenAIImage
	case relayconstant.RelayModeAudioSpeech, relayconstant.RelayModeAudioTranscription, relayconstant.RelayModeAudioTranslation:
		return MultiEndpointKeyOpenAIAudio
	case relayconstant.RelayModeRealtime:
		return MultiEndpointKeyOpenAIRealtime
	case relayconstant.RelayModeRerank:
		return MultiEndpointKeyRerank
	case relayconstant.RelayModeGemini:
		return MultiEndpointKeyGemini
	default:
		return MultiEndpointKeyOpenAI
	}
}

func splitPathAndQuery(u string) (pathOnly string, queryPart string) {
	idx := strings.IndexByte(u, '?')
	if idx < 0 {
		return u, ""
	}
	return u[:idx], u[idx:]
}

func applyTemplate(template string, model string, pathOnly string, queryPart string) (string, error) {
	out := strings.TrimSpace(template)
	if out == "" {
		return "", nil
	}

	out = strings.ReplaceAll(out, "{model}", model)
	out = strings.ReplaceAll(out, "{path}", pathOnly)
	out = strings.ReplaceAll(out, "{query}", queryPart)

	if strings.Contains(out, "{") || strings.Contains(out, "}") {
		return "", fmt.Errorf("multi-endpoint URL template contains unsupported variables")
	}
	return out, nil
}

func validateResolvedURL(template string, resolved string, pathOnly string, queryPart string) (string, error) {
	u := strings.TrimSpace(resolved)
	if u == "" {
		return "", nil
	}

	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("invalid url: %q", u)
	}

	isRealtime := relayconstant.Path2RelayMode(pathOnly) == relayconstant.RelayModeRealtime
	if isRealtime {
		if parsed.Scheme != "ws" && parsed.Scheme != "wss" {
			return "", fmt.Errorf("realtime endpoint requires ws:// or wss:// url")
		}
	} else {
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return "", fmt.Errorf("endpoint requires http:// or https:// url")
		}
	}

	// Enforce explicitness: if template doesn't use {path}, it must already match the incoming path.
	if !strings.Contains(template, "{path}") {
		if !strings.HasSuffix(parsed.Path, pathOnly) {
			return "", fmt.Errorf("url path mismatch: want suffix %q, got %q (use {path} to opt-in pass-through)", pathOnly, parsed.Path)
		}
	}

	// Enforce explicitness for query params: if there is a query in the request, template must explicitly carry it.
	if queryPart != "" && !strings.Contains(template, "{query}") && !strings.Contains(template, "?") {
		return "", fmt.Errorf("request has query params; template must include {query} or an explicit '?'")
	}

	return u, nil
}

// NOTE: intentionally no auto-append or auto-query behavior here.
// Multi-endpoint channel is designed to require explicit configuration via templates.
