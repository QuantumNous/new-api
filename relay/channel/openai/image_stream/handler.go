package image_stream

// Entry point for gpt-image-* model requests on the /v1/images/{generations,edits}
// classic OpenAI surface. Bypasses the standard adaptor.DoRequest path and
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

// HandleImageStream is the entry point for both /v1/images/generations and
// /v1/images/edits when the request model matches the gpt-image-* family.
// The two relay modes share everything except request building, so the
// outer flow (early flush → upstream POST → SSE aggregate → envelope →
// billing) is centralized below.
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
		upstreamReq = buildGenerationsRequest(req, info.UpstreamModelName)

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

	applyBilling(c, info, aggregated, req)
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

// buildImagesResponse turns the aggregated /v1/responses payload into the
// classic OpenAI Images-API envelope. For each image_generation_call item,
// either uploads the bytes to R2 (returning a public URL) or surfaces the
// base64 inline as `b64_json` if the caller asked for that or R2 isn't
// configured.
func buildImagesResponse(ctx context.Context, agg *UpstreamResponse, req *dto.ImageRequest) (*imageEnvelope, error) {
	r2 := LoadR2Config()
	wantB64 := req.ResponseFormat == "b64_json" || !r2.Enabled()

	out := &imageEnvelope{
		Created: time.Now().Unix(),
		Model:   agg.Model,
		Usage:   mergeUsage(agg),
	}

	var firstFormat, firstSize string
	for _, item := range agg.Output {
		if item.Type != "image_generation_call" || len(item.Result) < 100 {
			continue
		}
		// Use the magic-byte sniffed extension as authoritative format —
		// upstream sometimes claims webp but returns PNG, so trusting
		// item.OutputFormat would mislabel.
		raw, err := base64.StdEncoding.DecodeString(item.Result)
		if err != nil {
			return nil, fmt.Errorf("decode image base64: %w", err)
		}
		ext := InferImageExt(item.OutputFormat, raw)
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
				return nil, fmt.Errorf("R2 upload: %w", err)
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
func mergeUsage(agg *UpstreamResponse) *dto.Usage {
	u := &dto.Usage{}
	if agg.Usage != nil {
		u = agg.Usage
	}
	if agg.ToolUsage != nil && agg.ToolUsage.ImageGen != nil {
		ig := agg.ToolUsage.ImageGen
		// Add image-gen input/output to the running totals.
		u.InputTokens += ig.InputTokens
		u.OutputTokens += ig.OutputTokens
		u.TotalTokens += ig.TotalTokens
		// Surface details so per-modality logs can attribute image cost.
		if u.InputTokensDetails == nil {
			u.InputTokensDetails = &dto.InputTokenDetails{}
		}
		u.InputTokensDetails.ImageTokens += ig.InputTokensDetails.ImageTokens
		u.InputTokensDetails.TextTokens += ig.InputTokensDetails.TextTokens
		u.CompletionTokenDetails.ImageTokens += ig.OutputTokensDetails.ImageTokens
		u.CompletionTokenDetails.TextTokens += ig.OutputTokensDetails.TextTokens
	}
	// new-api's billing path keys off PromptTokens/CompletionTokens (the
	// legacy chat-style names). Mirror the responses-API counts into them
	// so log_consume_log surfaces real numbers instead of zeros.
	if u.PromptTokens == 0 && u.InputTokens > 0 {
		u.PromptTokens = u.InputTokens
	}
	if u.CompletionTokens == 0 && u.OutputTokens > 0 {
		u.CompletionTokens = u.OutputTokens
	}
	if u.TotalTokens == 0 {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
	return u
}

// applyBilling triggers the standard quota-consume path so this endpoint
// integrates with the same billing system as everything else. Falls back to
// PromptTokens=1/TotalTokens=1 if upstream gave us nothing usable, matching
// the existing image-handler behavior.
func applyBilling(c *gin.Context, info *relaycommon.RelayInfo, agg *UpstreamResponse, req *dto.ImageRequest) {
	usage := mergeUsage(agg)
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
