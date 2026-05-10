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
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

// HandleImageStream is the Phase-2 entry point. It currently supports
// /v1/images/generations only; /v1/images/edits will land in Phase 3.
func HandleImageStream(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ImageRequest) *types.NewAPIError {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return types.NewError(
			fmt.Errorf("image_stream: relay mode %d not yet supported (only generations)", info.RelayMode),
			types.ErrorCodeInvalidApiType,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if info.ChannelBaseUrl == "" {
		return types.NewError(
			errors.New("image_stream: channel base_url is empty"),
			types.ErrorCodeInvalidApiType,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if req.Prompt == "" {
		return types.NewErrorWithStatusCode(
			errors.New("prompt is required"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	upstreamReq := buildGenerationsRequest(req, info.UpstreamModelName)
	body, err := common.Marshal(upstreamReq)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	url := strings.TrimRight(info.ChannelBaseUrl, "/") + "/v1/responses"
	if common.DebugEnabled {
		logger.LogDebug(c, fmt.Sprintf("image_stream: POST %s body=%dB", url, len(body)))
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
		return types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	httpReq.Header.Set("Authorization", "Bearer "+info.ApiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	upstreamResp, err := httpClient.Do(httpReq)
	if err != nil {
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

// buildImagesResponse turns the aggregated /v1/responses payload into the
// classic OpenAI Images-API envelope. For each image_generation_call item,
// either uploads the bytes to R2 (returning a public URL) or surfaces the
// base64 inline as `b64_json` if the caller asked for that or R2 isn't
// configured.
func buildImagesResponse(ctx context.Context, agg *UpstreamResponse, req *dto.ImageRequest) (*dto.ImageResponse, error) {
	r2 := LoadR2Config()
	wantB64 := req.ResponseFormat == "b64_json" || !r2.Enabled()

	out := &dto.ImageResponse{
		Created: time.Now().Unix(),
	}

	for _, item := range agg.Output {
		if item.Type != "image_generation_call" || len(item.Result) < 100 {
			continue
		}
		entry := dto.ImageData{}
		if wantB64 {
			entry.B64Json = item.Result
		} else {
			raw, err := base64.StdEncoding.DecodeString(item.Result)
			if err != nil {
				return nil, fmt.Errorf("decode image base64: %w", err)
			}
			url, _, err := r2.PutImageDeduped(ctx, raw, item.OutputFormat)
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
	return out, nil
}

// applyBilling triggers the standard quota-consume path so this endpoint
// integrates with the same billing system as everything else. Falls back to
// PromptTokens=1/TotalTokens=1 if upstream gave us nothing usable, matching
// the existing image-handler behavior.
func applyBilling(c *gin.Context, info *relaycommon.RelayInfo, agg *UpstreamResponse, req *dto.ImageRequest) {
	usage := &dto.Usage{}
	if agg.Usage != nil {
		usage = agg.Usage
	}
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
		if _, hasN := info.PriceData.OtherRatios["n"]; !hasN {
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

// silence unused-import warnings until Phase 3 lands the edits path
var _ = constant.ContextKeyChannelBaseUrl
