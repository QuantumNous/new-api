package helper

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	imageAuditTextLimit = 4096
	imageAuditRawLimit  = 16384
)

// LogImageFailureRequest records enough client request detail to diagnose image
// failures without retaining credentials or binary image payloads.
func LogImageFailureRequest(c *gin.Context, relayFormat types.RelayFormat, request dto.Request, info *relaycommon.RelayInfo, relayErr *types.NewAPIError) {
	if !constant.ImageFailureRequestLogEnabled || c == nil || relayErr == nil || !isImageRequest(relayFormat, c, info) {
		return
	}

	payload := map[string]any{
		"event":        "image_failure_request",
		"request_id":   c.GetString(common.RequestIdKey),
		"user_id":      common.GetContextKeyInt(c, constant.ContextKeyUserId),
		"username":     common.GetContextKeyString(c, constant.ContextKeyUserName),
		"group":        common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		"token_id":     common.GetContextKeyInt(c, constant.ContextKeyTokenId),
		"channel_id":   common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		"channel_name": common.GetContextKeyString(c, constant.ContextKeyChannelName),
		"method":       c.Request.Method,
		"path":         c.Request.URL.Path,
		"relay_format": relayFormat,
		"status_code":  relayErr.StatusCode,
		"error_code":   relayErr.GetErrorCode(),
		"error_type":   relayErr.GetErrorType(),
		"error":        truncateImageAuditText(relayErr.MaskSensitiveError()),
		"request":      summarizeImageRequest(request),
	}
	if info != nil {
		payload["origin_model"] = info.OriginModelName
		payload["upstream_model"] = info.UpstreamModelName
		payload["used_channels"] = c.GetStringSlice("use_channel")
	}

	data, err := common.Marshal(payload)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("image failure request audit marshal failed: %s", err.Error()))
		return
	}
	if len(data) > imageAuditRawLimit {
		data = append(data[:imageAuditRawLimit], []byte("... [audit truncated]")...)
	}
	logger.LogError(c, "image_failure_request_audit="+string(data))
}

func isImageRequest(relayFormat types.RelayFormat, c *gin.Context, info *relaycommon.RelayInfo) bool {
	if relayFormat == types.RelayFormatOpenAIImage {
		return true
	}
	if relayFormat != types.RelayFormatGemini {
		return false
	}
	model := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	if info != nil && info.OriginModelName != "" {
		model = info.OriginModelName
	}
	return strings.Contains(strings.ToLower(model), "image") || strings.Contains(strings.ToLower(c.Request.URL.Path), "image")
}

func summarizeImageRequest(request dto.Request) any {
	switch req := request.(type) {
	case *dto.ImageRequest:
		return summarizeOpenAIImageRequest(req)
	case *dto.GeminiChatRequest:
		return summarizeGeminiImageRequest(req)
	case nil:
		return map[string]any{"parsed": false}
	default:
		return map[string]any{"parsed": true, "type": fmt.Sprintf("%T", request)}
	}
}

func summarizeOpenAIImageRequest(req *dto.ImageRequest) map[string]any {
	result := map[string]any{
		"model":           req.Model,
		"prompt":          truncateImageAuditText(req.Prompt),
		"n":               req.N,
		"size":            req.Size,
		"quality":         req.Quality,
		"response_format": req.ResponseFormat,
		"stream":          req.Stream,
		"watermark":       req.Watermark,
	}
	addSafeRawJSON(result, "style", req.Style)
	addSafeRawJSON(result, "background", req.Background)
	addSafeRawJSON(result, "output_format", req.OutputFormat)
	addSafeRawJSON(result, "output_compression", req.OutputCompression)
	addSafeRawJSON(result, "partial_images", req.PartialImages)
	addSafeRawJSON(result, "input_fidelity", req.InputFidelity)
	result["binary_inputs"] = map[string]any{
		"images": rawPayloadMetadata(req.Images),
		"image":  rawPayloadMetadata(req.Image),
		"mask":   rawPayloadMetadata(req.Mask),
	}
	if len(req.Extra) > 0 {
		extra := make(map[string]any, len(req.Extra))
		for key, value := range req.Extra {
			if isSensitiveAuditKey(key) {
				extra[key] = "[redacted]"
				continue
			}
			extra[key] = safeRawJSON(value)
		}
		result["extra"] = extra
	}
	return result
}

func summarizeGeminiImageRequest(req *dto.GeminiChatRequest) map[string]any {
	result := map[string]any{
		"contents": summarizeGeminiContents(req.Contents),
		"generation_config": map[string]any{
			"temperature":         req.GenerationConfig.Temperature,
			"top_p":               req.GenerationConfig.TopP,
			"top_k":               req.GenerationConfig.TopK,
			"candidate_count":     req.GenerationConfig.CandidateCount,
			"response_mime_type":  req.GenerationConfig.ResponseMimeType,
			"response_modalities": req.GenerationConfig.ResponseModalities,
			"media_resolution":    req.GenerationConfig.MediaResolution,
			"seed":                req.GenerationConfig.Seed,
			"image_config":        safeRawJSON(req.GenerationConfig.ImageConfig),
			"thinking_config":     req.GenerationConfig.ThinkingConfig,
			"max_output_tokens":   req.GenerationConfig.MaxOutputTokens,
		},
		"safety_settings":     req.SafetySettings,
		"cached_content_set":  req.CachedContent != "",
		"tools_present":       len(req.Tools) > 0,
		"batch_request_count": len(req.Requests),
	}
	if req.SystemInstructions != nil {
		result["system_instruction"] = summarizeGeminiContents([]dto.GeminiChatContent{*req.SystemInstructions})
	}
	return result
}

func summarizeGeminiContents(contents []dto.GeminiChatContent) []any {
	const maxContents = 32
	const maxPartsPerContent = 64
	if len(contents) > maxContents {
		contents = contents[:maxContents]
	}
	result := make([]any, 0, len(contents))
	for _, content := range contents {
		if len(content.Parts) > maxPartsPerContent {
			content.Parts = content.Parts[:maxPartsPerContent]
		}
		parts := make([]any, 0, len(content.Parts))
		for _, part := range content.Parts {
			summary := map[string]any{}
			if part.Text != "" {
				summary["text"] = truncateImageAuditText(part.Text)
			}
			if part.InlineData != nil {
				summary["inline_data"] = map[string]any{
					"mime_type":  part.InlineData.MimeType,
					"data_bytes": len(part.InlineData.Data),
					"data":       "[redacted]",
				}
			}
			if part.FileData != nil {
				summary["file_data"] = map[string]any{
					"mime_type": part.FileData.MimeType,
					"file_uri":  sanitizeFileURI(part.FileData.FileUri),
				}
			}
			if part.FunctionCall != nil {
				summary["function_call_present"] = true
			}
			if part.FunctionResponse != nil {
				summary["function_response_present"] = true
			}
			parts = append(parts, summary)
		}
		result = append(result, map[string]any{"role": content.Role, "parts": parts})
	}
	return result
}

func addSafeRawJSON(target map[string]any, key string, raw []byte) {
	if len(raw) > 0 {
		target[key] = safeRawJSON(raw)
	}
}

func safeRawJSON(raw []byte) any {
	if len(raw) == 0 {
		return nil
	}
	if len(raw) > imageAuditTextLimit {
		return map[string]any{"present": true, "bytes": len(raw), "value": "[redacted oversized value]"}
	}
	var value any
	if err := common.Unmarshal(raw, &value); err != nil {
		return map[string]any{"present": true, "bytes": len(raw), "value": "[invalid JSON redacted]"}
	}
	return sanitizeAuditValue(value)
}

func sanitizeAuditValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, child := range typed {
			if isSensitiveAuditKey(key) {
				result[key] = "[redacted]"
				continue
			}
			result[key] = sanitizeAuditValue(child)
		}
		return result
	case []any:
		result := make([]any, 0, len(typed))
		for _, child := range typed {
			result = append(result, sanitizeAuditValue(child))
		}
		return result
	case string:
		lower := strings.ToLower(typed)
		if strings.HasPrefix(lower, "data:image/") || strings.Contains(lower, ";base64,") {
			return fmt.Sprintf("[redacted binary string, bytes=%d]", len(typed))
		}
		return truncateImageAuditText(typed)
	default:
		return typed
	}
}

func isSensitiveAuditKey(key string) bool {
	normalized := strings.ToLower(strings.NewReplacer("_", "", "-", "").Replace(key))
	switch normalized {
	case "authorization", "apikey", "key", "token", "password", "secret", "b64json", "base64", "data", "inlinedata", "filedata", "image", "images", "mask", "inputimage", "referenceimage", "referenceimages":
		return true
	default:
		return false
	}
}

func rawPayloadMetadata(raw []byte) map[string]any {
	return map[string]any{"present": len(raw) > 0, "bytes": len(raw), "value": "[redacted]"}
}

func sanitizeFileURI(raw string) string {
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "[redacted file URI]"
	}
	return parsed.Scheme + "://" + parsed.Host + "/[redacted]"
}

func truncateImageAuditText(value string) string {
	if len(value) <= imageAuditTextLimit {
		return value
	}
	return fmt.Sprintf("%s... [truncated, original_length=%d]", value[:imageAuditTextLimit], len(value))
}
