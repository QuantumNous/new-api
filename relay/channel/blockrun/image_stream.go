package blockrun

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// imageHeartbeatInterval paces SSE keep-alive comments while the upstream
// generates. 10s sits safely under common LB idle timeouts. Var for tests.
var imageHeartbeatInterval = 10 * time.Second

func isImageStreamMode(c *gin.Context, info *relaycommon.RelayInfo) bool {
	return c != nil && isImageMode(info) && info.IsStream
}

// startImageHeartbeat begins emitting SSE comments so the client connection
// survives a multi-minute poll. Headers are written lazily here — only the
// slow path pays the "can't change status code anymore" cost; fast-path
// errors still return clean JSON errors. Returns an idempotent stop func.
func startImageHeartbeat(c *gin.Context) func() {
	if !c.Writer.Written() {
		helper.SetEventStreamHeaders(c)
	}
	_ = helper.PingData(c)
	done := make(chan struct{})
	var once sync.Once
	go func() {
		t := time.NewTicker(imageHeartbeatInterval)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-c.Request.Context().Done():
				return
			case <-t.C:
				_ = helper.PingData(c)
			}
		}
	}()
	return func() { once.Do(func() { close(done) }) }
}

// streamImageResponse converts the final image JSON into a minimal
// OpenAI-compatible image stream: zero partial_image events (legal — the final
// image may arrive before any partials), one completed event per data[] item,
// then [DONE]. Once we are here the upstream charge is committed, so local
// failures degrade (url fallback) instead of erroring, and genuine errors are
// emitted as SSE error events with SkipRetry.
func streamImageResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	body, err := readAndCloseBody(resp)
	if err != nil {
		writeImageStreamError(c, "image response could not be read")
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}
	var ir dto.ImageResponse
	if uerr := common.Unmarshal(body, &ir); uerr != nil || len(ir.Data) == 0 {
		writeImageStreamError(c, "image generation returned no image")
		return nil, types.NewError(fmt.Errorf("blockrun: empty image result in stream mode"), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}

	if !c.Writer.Written() {
		helper.SetEventStreamHeaders(c)
	}
	eventType := "image_generation.completed"
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		eventType = "image_edit.completed"
	}
	for idx, item := range ir.Data {
		evt := map[string]interface{}{
			"type":       eventType,
			"created_at": ir.Created,
		}
		b64 := item.B64Json
		if b64 == "" && item.Url != "" {
			if fetched, ferr := downloadImageAsBase64(c, info, item.Url); ferr == nil {
				b64 = fetched
			} else {
				// Degrade rather than fail: settlement is already committed.
				evt["url"] = item.Url
			}
		}
		if b64 != "" {
			evt["b64_json"] = b64
		}
		if len(ir.Data) > 1 {
			evt["index"] = idx
		}
		_ = helper.ObjectData(c, evt)
	}
	helper.Done(c)
	// Zero usage: ImageHelper's per-image fallback prices by model/n, and the
	// settlement signals were already captured into the gin context.
	return &dto.Usage{}, nil
}

// writeImageStreamError emits a whitelabel-safe SSE error event. Used once the
// stream has (or may have) started and the status code can no longer change.
func writeImageStreamError(c *gin.Context, msg string) {
	if !c.Writer.Written() {
		helper.SetEventStreamHeaders(c)
	}
	_ = helper.ObjectData(c, map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"type":    "image_generation_error",
			"message": msg,
		},
	})
	helper.Done(c)
}

// downloadImageAsBase64 fetches the upstream-hosted image and returns its bytes
// base64-encoded, bounded by maxImageBodyBytes. Also a whitelabel win: the
// client receives bytes, not the upstream CDN URL.
func downloadImageAsBase64(c *gin.Context, info *relaycommon.RelayInfo, imageURL string) (string, error) {
	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return "", err
	}
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, imageURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("image download status %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBodyBytes+1))
	if err != nil {
		return "", err
	}
	if len(raw) > maxImageBodyBytes {
		return "", fmt.Errorf("image exceeds %d bytes", maxImageBodyBytes)
	}
	return base64.StdEncoding.EncodeToString(raw), nil
}
