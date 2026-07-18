package image_stream

// Legacy synchronous entry point for gpt-image-* requests on
// /v1/images/edits. New text-to-image and image-to-image integrations use the
// durable /v1/images/generations task path. This handler bypasses the standard
// adaptor.DoRequest path and
// instead:
//
//   1. Re-shapes the request into a /v1/responses + stream:true payload
//   2. Calls the configured upstream channel directly
//   3. Aggregates the SSE stream in Go (skipping huge partial_image events)
//   4. Uploads the final image bytes to R2 (or returns b64_json inline)
//   5. Builds the OpenAI Images-API envelope and writes it
//   6. Triggers billing
//
// An "early flush" is emitted before the upstream call so the CF edge in
// front of the gateway sees a TTFB byte well within its 100s window even
// though the upstream model takes 60-150s to produce the image.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// IsGptImageModel returns true for the gpt-image-* family. Used as the
// gating predicate at the upper relay layer.
func IsGptImageModel(model string) bool {
	return strings.HasPrefix(strings.ToLower(model), "gpt-image-")
}

// ShouldRunAsync is kept for callers that need to classify the image-generation
// surface. All /v1/images/generations requests are asynchronous; the model and
// legacy async flag no longer select a synchronous path.
func ShouldRunAsync(_ string, _ *bool) bool {
	return true
}

// HandleImageStream retains the legacy multipart edit implementation. The
// generation branch remains for compatibility with direct internal callers;
// HTTP generation requests are submitted through SubmitAsyncImage.
func HandleImageStream(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ImageRequest) *types.NewAPIError {
	if info.ChannelBaseUrl == "" {
		return types.NewError(
			errors.New("image_stream: channel base_url is empty"),
			types.ErrorCodeInvalidApiType,
			types.ErrOptionWithSkipRetry(),
		)
	}

	var upstreamReq responsesRequest
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		if req.Prompt == "" {
			return types.NewErrorWithStatusCode(
				errors.New("prompt is required"),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		var buildErr error
		upstreamReq, buildErr = buildGenerationsRequestWithError(req, info.UpstreamModelName)
		if buildErr != nil {
			return types.NewErrorWithStatusCode(
				buildErr,
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}

	case relayconstant.RelayModeImagesEdits:
		if !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			return types.NewErrorWithStatusCode(
				errors.New("image_stream: edits requires multipart/form-data"),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		mf := c.Request.MultipartForm
		if mf == nil {
			if _, err := c.MultipartForm(); err != nil {
				return types.NewErrorWithStatusCode(
					fmt.Errorf("parse multipart form: %w", err),
					types.ErrorCodeInvalidRequest,
					http.StatusBadRequest,
					types.ErrOptionWithSkipRetry(),
				)
			}
			mf = c.Request.MultipartForm
		}
		images, err := CollectAndNormalizeImages(c.Request.Context(), mf)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		// Pull all the optional tool params out of the multipart form. They
		// live alongside `image` and aren't reflected in dto.ImageRequest's
		// fields for /v1/images/edits.
		formGet := func(key string) string {
			if vs := mf.Value[key]; len(vs) > 0 {
				return strings.TrimSpace(vs[0])
			}
			return ""
		}
		prompt := strings.TrimSpace(req.Prompt)
		if prompt == "" {
			prompt = formGet("prompt")
		}
		if prompt == "" {
			return types.NewErrorWithStatusCode(
				errors.New("prompt is required"),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		var outputCompression any
		if oc := formGet("output_compression"); oc != "" {
			outputCompression = json.RawMessage(oc)
		}
		upstreamReq = buildEditsRequest(
			prompt, images,
			req.Model, info.UpstreamModelName,
			formGet("size"), formGet("quality"),
			formGet("output_format"), formGet("background"), formGet("moderation"),
			outputCompression,
		)

	default:
		return types.NewError(
			fmt.Errorf("image_stream: unsupported relay mode %d", info.RelayMode),
			types.ErrorCodeInvalidApiType,
			types.ErrOptionWithSkipRetry(),
		)
	}

	body, err := common.Marshal(upstreamReq)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	url := strings.TrimRight(info.ChannelBaseUrl, "/") + "/v1/responses"
	if common.DebugEnabled {
		logger.LogDebug(c, fmt.Sprintf("image_stream: POST %s body=%dB mode=%d", url, len(body), info.RelayMode))
	}

	// Early flush: write headers + a single space byte to satisfy the CF
	// edge's 100s TTFB before we begin the long upstream call. JSON parsers
	// ignore leading whitespace, so the eventual body still parses cleanly.
	earlyFlushHeaders(c)

	// We give the upstream up to 5 minutes — enough headroom for 4K + high
	// quality (60-150s observed). Once headers arrive the request is no
	// longer subject to that ceiling, only the per-stream timeout below.
	httpClient := &http.Client{Timeout: 5 * time.Minute}
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), "POST", url, bytes.NewReader(body))
	if err != nil {
		writeError(c, http.StatusInternalServerError, err.Error())
		return types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	httpReq.Header.Set("Authorization", "Bearer "+info.ApiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	upstreamResp, err := httpClient.Do(httpReq)
	if err != nil {
		writeError(c, http.StatusBadGateway, err.Error())
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	defer upstreamResp.Body.Close()

	if upstreamResp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(upstreamResp.Body, 4096))
		writeError(c, upstreamResp.StatusCode, fmt.Sprintf("upstream %d: %s", upstreamResp.StatusCode, string(errBody)))
		return types.NewError(
			fmt.Errorf("upstream returned %d: %s", upstreamResp.StatusCode, string(errBody)),
			types.ErrorCodeBadResponse,
			types.ErrOptionWithSkipRetry(),
		)
	}

	aggregated, err := AggregateResponseStream(upstreamResp.Body)
	if err != nil {
		writeError(c, http.StatusBadGateway, err.Error())
		return types.NewError(err, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}

	envelope, buildErr := buildImagesResponse(c.Request.Context(), aggregated, req)
	if buildErr != nil {
		writeError(c, http.StatusInternalServerError, buildErr.Error())
		return types.NewError(buildErr, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}

	envelopeJSON, err := common.Marshal(envelope)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err.Error())
		return types.NewError(err, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	if _, werr := c.Writer.Write(envelopeJSON); werr != nil {
		logger.LogError(c, fmt.Sprintf("image_stream: write envelope: %s", werr.Error()))
	}
	c.Writer.Flush()

	applyBilling(c, info, envelope.Usage, req)
	return nil
}

// earlyFlushHeaders pushes the response headers + a leading whitespace byte
// to the client. The space is ignored by JSON parsers (whitespace is allowed
// before the document) but resets the CF edge's TTFB clock so it doesn't
// 524 us at 100s while the upstream model is still working.
func earlyFlushHeaders(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	c.Writer.Header().Set("Cache-Control", "no-store")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write([]byte(" "))
	c.Writer.Flush()
}

// writeError writes a JSON error envelope. Headers may already have been
// flushed (status 200), in which case status is whatever we said earlier;
// the body still carries an `error` object so OpenAI clients see it.
func writeError(c *gin.Context, status int, msg string) {
	if !c.Writer.Written() {
		c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		c.Writer.WriteHeader(status)
	}
	body, _ := common.Marshal(map[string]any{
		"error": map[string]any{
			"message": msg,
			"type":    "upstream_error",
			"code":    "image_stream_failed",
		},
	})
	_, _ = c.Writer.Write(body)
	c.Writer.Flush()
}

// imageEnvelope is the JSON shape we write back to the client. It extends
// dto.ImageResponse with the optional fields the worker used to surface
// (output_format, size, quality, background, model, usage). Clients depend
// on output_format to know whether webp was honoured or silently demoted.
type imageEnvelope struct {
	Created      int64           `json:"created"`
	Data         []dto.ImageData `json:"data"`
	Background   string          `json:"background,omitempty"`
	OutputFormat string          `json:"output_format,omitempty"`
	Quality      string          `json:"quality,omitempty"`
	Size         string          `json:"size,omitempty"`
	Model        string          `json:"model,omitempty"`
	Usage        *dto.Usage      `json:"usage,omitempty"`
}

type imageStorageError struct {
	err       error
	permanent bool
}

func (e *imageStorageError) Error() string { return e.err.Error() }

func (e *imageStorageError) Unwrap() error { return e.err }

func (e *imageStorageError) Permanent() bool { return e.permanent }

// buildImagesResponse turns the aggregated /v1/responses payload into the
// classic OpenAI Images-API envelope. For each image_generation_call item,
// either uploads the bytes to R2 (returning a public URL) or surfaces the
// base64 inline as `b64_json` if the caller asked for that or R2 isn't
// configured.
func buildImagesResponse(ctx context.Context, agg *UpstreamResponse, req *dto.ImageRequest) (*imageEnvelope, error) {
	return buildImagesResponseWithStorage(ctx, agg, req, false)
}

func buildStoredImagesResponse(ctx context.Context, agg *UpstreamResponse, req *dto.ImageRequest) (*imageEnvelope, error) {
	return buildImagesResponseWithStorage(ctx, agg, req, true)
}

func buildImagesResponseWithStorage(ctx context.Context, agg *UpstreamResponse, req *dto.ImageRequest, requireObjectStorage bool) (*imageEnvelope, error) {
	r2 := LoadR2Config()
	if requireObjectStorage && !r2.Enabled() {
		return nil, errors.New("image object storage is not configured")
	}
	wantB64 := !requireObjectStorage && (req.ResponseFormat == "b64_json" || !r2.Enabled())
	usage, err := mergeUsage(agg)
	if err != nil {
		return nil, err
	}

	out := &imageEnvelope{
		Created: time.Now().Unix(),
		Model:   agg.Model,
		Usage:   usage,
	}

	var firstFormat, firstSize string
	for _, item := range agg.Output {
		if item.Type != "image_generation_call" || strings.TrimSpace(item.Result) == "" {
			continue
		}
		// Use the magic-byte sniffed extension as authoritative format —
		// upstream sometimes claims webp but returns PNG, so trusting
		// item.OutputFormat would mislabel.
		raw, err := base64.StdEncoding.DecodeString(item.Result)
		if err != nil {
			return nil, fmt.Errorf("decode image base64: %w", err)
		}
		ext, ok := strictGenericImageFormat(raw)
		if !ok {
			return nil, errors.New("upstream image has unsupported magic bytes")
		}
		actualFormat := ext
		if ext == "jpg" {
			actualFormat = "jpeg"
		}
		if firstFormat == "" {
			firstFormat = actualFormat
		}
		if firstSize == "" {
			firstSize = item.Size
		}

		entry := dto.ImageData{}
		if wantB64 {
			entry.B64Json = item.Result
		} else {
			url, err := r2.PutObject(ctx,
				"images/"+sha256HexBytes(raw)+"."+ext,
				MimeForExt(ext), raw)
			if err != nil {
				var putErr *r2PutError
				return nil, &imageStorageError{
					err:       fmt.Errorf("R2 upload: %w", err),
					permanent: errors.As(err, &putErr) && putErr.Permanent(),
				}
			}
			entry.Url = url
		}
		if item.RevisedPrompt != "" {
			entry.RevisedPrompt = item.RevisedPrompt
		} else if req.Prompt != "" {
			entry.RevisedPrompt = req.Prompt
		}
		out.Data = append(out.Data, entry)
	}

	if len(out.Data) == 0 {
		return nil, errors.New("upstream produced no image_generation_call output")
	}
	out.OutputFormat = firstFormat
	out.Size = firstSize
	if req.Quality != "" {
		out.Quality = req.Quality
	}
	return out, nil
}

// mergeUsage flattens upstream's split usage representation into the single
// dto.Usage shape new-api's billing path expects. /v1/responses splits the
// cost across two fields:
//   - response.usage          — LLM reasoning only (40-200 tokens)
//   - tool_usage.image_gen.*  — image cost (often thousands of tokens)
//
// Forwarding only response.usage means logs show prompt/completion tokens
// near 0 even when an actual high-res image was rendered. We merge both.
func mergeUsage(agg *UpstreamResponse) (*dto.Usage, error) {
	if agg == nil {
		return nil, errors.New("upstream image response is required")
	}
	u := &dto.Usage{}
	if agg.Usage != nil {
		copied := *agg.Usage
		if agg.Usage.InputTokensDetails != nil {
			details := *agg.Usage.InputTokensDetails
			copied.InputTokensDetails = &details
		}
		if agg.Usage.OutputTokensDetails != nil {
			details := *agg.Usage.OutputTokensDetails
			copied.OutputTokensDetails = &details
		}
		// billing_usage and its semantic/source selectors are gateway-internal.
		// A direct upstream must not override the canonical usage merged here.
		copied.BillingUsage = nil
		copied.UsageSemantic = ""
		copied.UsageSource = ""
		u = &copied
	}
	if err := validateImageUsage(u); err != nil {
		return nil, err
	}
	if u.InputTokens == 0 {
		u.InputTokens = u.PromptTokens
	}
	if u.OutputTokens == 0 {
		u.OutputTokens = u.CompletionTokens
	}
	if u.InputTokensDetails != nil {
		copyMissingImageInputDetails(&u.PromptTokensDetails, *u.InputTokensDetails)
	}
	if u.OutputTokensDetails != nil {
		copyMissingImageOutputDetails(&u.CompletionTokenDetails, *u.OutputTokensDetails)
	}
	if agg.ToolUsage != nil && agg.ToolUsage.ImageGen != nil {
		ig := agg.ToolUsage.ImageGen
		if err := validateImageGenUsage(ig); err != nil {
			return nil, err
		}
		// Add image-gen input/output to the running totals.
		if err := addImageUsageValue("input_tokens", &u.InputTokens, ig.InputTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("output_tokens", &u.OutputTokens, ig.OutputTokens); err != nil {
			return nil, err
		}
		// Surface details so per-modality logs can attribute image cost.
		if u.InputTokensDetails == nil {
			u.InputTokensDetails = &dto.InputTokenDetails{}
		}
		if err := addImageUsageValue("input_tokens_details.image_tokens", &u.InputTokensDetails.ImageTokens, ig.InputTokensDetails.ImageTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("input_tokens_details.text_tokens", &u.InputTokensDetails.TextTokens, ig.InputTokensDetails.TextTokens); err != nil {
			return nil, err
		}
		// Standard text billing reads the legacy prompt/completion detail
		// fields, while Responses exposes input/output detail fields. Mirror the
		// modality breakdown so image tokens receive the configured image ratio.
		if err := addImageUsageValue("prompt_tokens_details.image_tokens", &u.PromptTokensDetails.ImageTokens, ig.InputTokensDetails.ImageTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("prompt_tokens_details.text_tokens", &u.PromptTokensDetails.TextTokens, ig.InputTokensDetails.TextTokens); err != nil {
			return nil, err
		}
		if u.OutputTokensDetails == nil {
			u.OutputTokensDetails = &dto.OutputTokenDetails{}
		}
		if err := addImageUsageValue("output_tokens_details.image_tokens", &u.OutputTokensDetails.ImageTokens, ig.OutputTokensDetails.ImageTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("output_tokens_details.text_tokens", &u.OutputTokensDetails.TextTokens, ig.OutputTokensDetails.TextTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("completion_tokens_details.image_tokens", &u.CompletionTokenDetails.ImageTokens, ig.OutputTokensDetails.ImageTokens); err != nil {
			return nil, err
		}
		if err := addImageUsageValue("completion_tokens_details.text_tokens", &u.CompletionTokenDetails.TextTokens, ig.OutputTokensDetails.TextTokens); err != nil {
			return nil, err
		}
	}
	// This path consumes a Responses payload, so the input/output counters are
	// authoritative after tool usage has been merged.
	u.PromptTokens = u.InputTokens
	u.CompletionTokens = u.OutputTokens
	u.TotalTokens = 0
	if err := addImageUsageValue("total_tokens", &u.TotalTokens, u.PromptTokens); err != nil {
		return nil, err
	}
	if err := addImageUsageValue("total_tokens", &u.TotalTokens, u.CompletionTokens); err != nil {
		return nil, err
	}
	return u, nil
}

func validateImageUsage(usage *dto.Usage) error {
	if usage == nil {
		return nil
	}
	values := []struct {
		name  string
		value int
	}{
		{"prompt_tokens", usage.PromptTokens},
		{"completion_tokens", usage.CompletionTokens},
		{"total_tokens", usage.TotalTokens},
		{"input_tokens", usage.InputTokens},
		{"output_tokens", usage.OutputTokens},
		{"prompt_cache_hit_tokens", usage.PromptCacheHitTokens},
		{"claude_cache_creation_5_m_tokens", usage.ClaudeCacheCreation5mTokens},
		{"claude_cache_creation_1_h_tokens", usage.ClaudeCacheCreation1hTokens},
	}
	for _, value := range values {
		if value.value < 0 {
			return fmt.Errorf("upstream usage %s cannot be negative", value.name)
		}
	}
	if err := validateImageInputDetails("prompt_tokens_details", usage.PromptTokensDetails); err != nil {
		return err
	}
	if err := validateImageOutputDetails("completion_tokens_details", usage.CompletionTokenDetails); err != nil {
		return err
	}
	if usage.InputTokensDetails != nil {
		if err := validateImageInputDetails("input_tokens_details", *usage.InputTokensDetails); err != nil {
			return err
		}
	}
	if usage.OutputTokensDetails != nil {
		if err := validateImageOutputDetails("output_tokens_details", *usage.OutputTokensDetails); err != nil {
			return err
		}
	}
	return nil
}

func validateImageInputDetails(prefix string, details dto.InputTokenDetails) error {
	values := []struct {
		name  string
		value int
	}{
		{"cached_tokens", details.CachedTokens},
		{"cached_creation_tokens", details.CachedCreationTokens},
		{"cache_write_tokens", details.CacheWriteTokens},
		{"text_tokens", details.TextTokens},
		{"audio_tokens", details.AudioTokens},
		{"image_tokens", details.ImageTokens},
	}
	for _, value := range values {
		if value.value < 0 {
			return fmt.Errorf("upstream usage %s.%s cannot be negative", prefix, value.name)
		}
	}
	return nil
}

func validateImageOutputDetails(prefix string, details dto.OutputTokenDetails) error {
	values := []struct {
		name  string
		value int
	}{
		{"text_tokens", details.TextTokens},
		{"audio_tokens", details.AudioTokens},
		{"image_tokens", details.ImageTokens},
		{"reasoning_tokens", details.ReasoningTokens},
	}
	for _, value := range values {
		if value.value < 0 {
			return fmt.Errorf("upstream usage %s.%s cannot be negative", prefix, value.name)
		}
	}
	return nil
}

func validateImageGenUsage(usage *struct {
	InputTokens        int `json:"input_tokens"`
	InputTokensDetails struct {
		ImageTokens int `json:"image_tokens"`
		TextTokens  int `json:"text_tokens"`
	} `json:"input_tokens_details"`
	OutputTokens        int `json:"output_tokens"`
	OutputTokensDetails struct {
		ImageTokens int `json:"image_tokens"`
		TextTokens  int `json:"text_tokens"`
	} `json:"output_tokens_details"`
	TotalTokens int `json:"total_tokens"`
}) error {
	values := []struct {
		name  string
		value int
	}{
		{"tool_usage.image_gen.input_tokens", usage.InputTokens},
		{"tool_usage.image_gen.output_tokens", usage.OutputTokens},
		{"tool_usage.image_gen.total_tokens", usage.TotalTokens},
		{"tool_usage.image_gen.input_tokens_details.image_tokens", usage.InputTokensDetails.ImageTokens},
		{"tool_usage.image_gen.input_tokens_details.text_tokens", usage.InputTokensDetails.TextTokens},
		{"tool_usage.image_gen.output_tokens_details.image_tokens", usage.OutputTokensDetails.ImageTokens},
		{"tool_usage.image_gen.output_tokens_details.text_tokens", usage.OutputTokensDetails.TextTokens},
	}
	for _, value := range values {
		if value.value < 0 {
			return fmt.Errorf("upstream usage %s cannot be negative", value.name)
		}
	}
	return nil
}

func copyMissingImageInputDetails(target *dto.InputTokenDetails, source dto.InputTokenDetails) {
	if target.CachedTokens == 0 {
		target.CachedTokens = source.CachedTokens
	}
	if target.CachedCreationTokens == 0 {
		target.CachedCreationTokens = source.CachedCreationTokens
	}
	if target.CacheWriteTokens == 0 {
		target.CacheWriteTokens = source.CacheWriteTokens
	}
	if target.TextTokens == 0 {
		target.TextTokens = source.TextTokens
	}
	if target.AudioTokens == 0 {
		target.AudioTokens = source.AudioTokens
	}
	if target.ImageTokens == 0 {
		target.ImageTokens = source.ImageTokens
	}
}

func copyMissingImageOutputDetails(target *dto.OutputTokenDetails, source dto.OutputTokenDetails) {
	if target.TextTokens == 0 {
		target.TextTokens = source.TextTokens
	}
	if target.AudioTokens == 0 {
		target.AudioTokens = source.AudioTokens
	}
	if target.ImageTokens == 0 {
		target.ImageTokens = source.ImageTokens
	}
	if target.ReasoningTokens == 0 {
		target.ReasoningTokens = source.ReasoningTokens
	}
}

func addImageUsageValue(name string, target *int, delta int) error {
	if target == nil {
		return fmt.Errorf("upstream usage %s target is required", name)
	}
	if *target < 0 || delta < 0 {
		return fmt.Errorf("upstream usage %s cannot be negative", name)
	}
	maxInt := int(^uint(0) >> 1)
	if delta > maxInt-*target {
		return fmt.Errorf("upstream usage %s overflows int", name)
	}
	*target += delta
	return nil
}

// applyBilling triggers the standard quota-consume path so this endpoint
// integrates with the same billing system as everything else. Falls back to
// PromptTokens=1/TotalTokens=1 if upstream gave us nothing usable, matching
// the existing image-handler behavior.
func applyBilling(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage, req *dto.ImageRequest) {
	if usage.TotalTokens == 0 {
		usage.TotalTokens = 1
	}
	if usage.PromptTokens == 0 {
		usage.PromptTokens = 1
	}

	imageN := uint(1)
	if req.N != nil {
		imageN = *req.N
	}
	if info.PriceData.UsePrice {
		if !info.PriceData.HasOtherRatio("n") {
			info.PriceData.AddOtherRatio("n", float64(imageN))
		}
	}

	quality := "standard"
	if req.Quality == "hd" {
		quality = "hd"
	}
	var logContent []string
	if req.Size != "" {
		logContent = append(logContent, fmt.Sprintf("大小 %s", req.Size))
	}
	if quality != "" {
		logContent = append(logContent, fmt.Sprintf("品质 %s", quality))
	}
	if imageN > 0 {
		logContent = append(logContent, fmt.Sprintf("生成数量 %d", imageN))
	}
	logContent = append(logContent, "image_stream")

	service.PostTextConsumeQuota(c, info, usage, logContent)
}
