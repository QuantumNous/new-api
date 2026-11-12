package minimax

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// H3ImageHasOutput distinguishes billable final images from failure notices.
// An interrupted request may have images even without its final usage summary.
func H3ImageHasOutput(c *gin.Context) bool { return c.GetBool("minimax_h3_image_output") }

type h3ImageUsage struct {
	dto.Usage
	GeneratedImages *int `json:"generated_images"`
}

// handleH3ImageResponse keeps H3's per-image events and summary separate: a
// partial_succeeded carries a final image, while completed carries only usage.
func handleH3ImageResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, h3ImageError("invalid MiniMax H3 response")
	}
	if !strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/event-stream") {
		defer service.CloseResponseBodyGracefully(resp)
		body, err := io.ReadAll(io.LimitReader(resp.Body, 128<<20+1))
		if err != nil || len(body) > 128<<20 {
			return nil, h3ImageError("cannot read MiniMax H3 image response")
		}
		var result struct {
			Usage *h3ImageUsage `json:"usage"`
			Data  []struct {
				URL string `json:"url"`
				B64 string `json:"b64_json"`
			} `json:"data"`
		}
		if err := common.Unmarshal(body, &result); err != nil {
			return nil, h3ImageError("invalid MiniMax H3 image JSON")
		}
		var urls, b64s int
		for _, item := range result.Data {
			if item.URL != "" {
				urls++
			}
			if item.B64 != "" {
				b64s++
			}
		}
		count := max(urls, b64s)
		if count == 0 || validateH3Usage(result.Usage, count) != nil {
			return nil, h3ImageError("invalid MiniMax H3 image usage")
		}
		c.Set("minimax_h3_image_output", true)
		copyResp := *resp
		copyResp.Body = io.NopCloser(bytes.NewReader(body))
		return openai.OpenaiImageHandler(c, info, &copyResp)
	}
	var usage *dto.Usage
	var failure *types.NewAPIError
	var completed bool
	succeeded := map[int]string{}
	failed := map[int]bool{}
	prefix := "image_generation."
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		prefix = "image_edit."
	}
	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var event struct {
			Type       string          `json:"type"`
			ImageIndex *int            `json:"image_index"`
			URL        string          `json:"url"`
			Code       string          `json:"code"`
			Message    string          `json:"message"`
			Usage      *h3ImageUsage   `json:"usage"`
			Error      json.RawMessage `json:"error"`
		}
		info.StreamStatus.RequireTerminal()
		if err := common.Unmarshal([]byte(data), &event); err != nil {
			failure = h3ImageError("invalid MiniMax H3 stream JSON")
			sr.Stop(failure)
			return
		}
		terminal := false
		switch event.Type {
		case prefix + "partial_succeeded", prefix + "partial_failed":
			if event.ImageIndex == nil || *event.ImageIndex < 0 || *event.ImageIndex >= 10 {
				failure = h3ImageError("invalid MiniMax H3 image index")
				sr.Stop(failure)
				return
			}
			index := *event.ImageIndex
			if event.Type == prefix+"partial_succeeded" {
				if event.URL == "" || failed[index] {
					failure = h3ImageError("invalid MiniMax H3 successful image")
					sr.Stop(failure)
					return
				}
				if previous, exists := succeeded[index]; exists {
					if previous != event.URL {
						failure = h3ImageError("conflicting MiniMax H3 image result")
						sr.Stop(failure)
					}
					return
				}
				succeeded[index] = event.URL
				c.Set("minimax_h3_image_output", true)
			} else {
				if event.Code == "" || event.Message == "" || succeeded[index] != "" {
					failure = h3ImageError("invalid MiniMax H3 failed image")
					sr.Stop(failure)
					return
				}
				if failed[index] {
					return
				}
				failed[index] = true
			}
		case prefix + "completed":
			if len(succeeded) == 0 || validateH3Usage(event.Usage, len(succeeded)) != nil {
				failure = h3ImageError("invalid MiniMax H3 final usage")
				sr.Stop(failure)
				return
			}
			usage = &event.Usage.Usage
			usage.PromptTokens, usage.CompletionTokens = usage.InputTokens, usage.OutputTokens
			if usage.InputTokensDetails != nil {
				usage.PromptTokensDetails = usage.InputTokensDetails.Clone()
			}
			if usage.OutputTokensDetails != nil {
				usage.CompletionTokenDetails = *usage.OutputTokensDetails
			}
			completed, terminal = true, true
		case "error":
			failure = h3ImageError("MiniMax H3 image generation failed")
			if len(succeeded) > 0 || len(event.Error) == 0 {
				sr.Stop(failure)
				return
			}
			terminal = true
		default:
			failure = h3ImageError("unknown MiniMax H3 image event")
			sr.Stop(failure)
			return
		}
		if err := helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: event.Type}, data); err != nil {
			failure = h3ImageError("MiniMax H3 downstream delivery failed")
			sr.Stop(failure)
			return
		}
		if terminal {
			if failure != nil {
				sr.Stop(failure)
			} else {
				info.StreamStatus.MarkCompleted()
				sr.Done()
			}
		}
	})
	if failure != nil {
		return usage, failure
	}
	if !completed || info.StreamStatus == nil || (info.StreamStatus.EndReason != relaycommon.StreamEndReasonDone && info.StreamStatus.EndReason != relaycommon.StreamEndReasonEOF) {
		return usage, h3ImageError("MiniMax H3 stream ended before completion")
	}
	info.UpdateImageCount(int64(len(succeeded)))
	return usage, nil
}

// validateH3Usage accepts only a bounded summary consistent with received images.
func validateH3Usage(usage *h3ImageUsage, count int) error {
	if usage == nil || usage.GeneratedImages == nil || *usage.GeneratedImages != count || count < 0 || count > 10 || usage.InputTokens < 0 || usage.OutputTokens < 0 || usage.TotalTokens < 0 {
		return fmt.Errorf("invalid H3 image usage")
	}
	return nil
}

// h3ImageError prevents replay after MiniMax may already have generated images.
func h3ImageError(message string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(fmt.Errorf("%s", message), types.ErrorCodeBadResponseBody, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
}
