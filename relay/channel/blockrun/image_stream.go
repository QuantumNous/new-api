package blockrun

import (
	"context"
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
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// imageHeartbeatInterval paces SSE keep-alive comments while the upstream
// generates. 10s sits safely under common LB idle timeouts. Var for tests.
var imageHeartbeatInterval = 10 * time.Second

// imageDownloadTimeout bounds a single upstream-image fetch on the b64-synthesis
// path so a slow/hung CDN cannot occupy the request goroutine indefinitely when
// the shared relay client has no Timeout (RelayTimeout=0).
const imageDownloadTimeout = 60 * time.Second

func isImageStreamMode(c *gin.Context, info *relaycommon.RelayInfo) bool {
	return c != nil && isImageMode(info) && info.IsStream
}

// startImageHeartbeat begins emitting SSE comments so the client connection
// survives a multi-minute poll. Headers are written lazily here — only the
// slow path pays the "can't change status code anymore" cost; fast-path
// errors still return clean JSON errors. Returns an idempotent stop func that
// is SYNCHRONOUS: it blocks until the heartbeat goroutine has fully exited,
// because gin's ResponseWriter is not safe for concurrent writes — the caller
// must not write the next SSE event while a PingData may still be in flight
// (cf. the mutex guarding PingData in relay/helper/stream_scanner.go).
func startImageHeartbeat(c *gin.Context) func() {
	if !c.Writer.Written() {
		helper.SetEventStreamHeaders(c)
	}
	_ = helper.PingData(c)
	done := make(chan struct{})
	exited := make(chan struct{})
	var once sync.Once
	go func() {
		defer close(exited)
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
	return func() {
		once.Do(func() { close(done) })
		// Wait for the goroutine to stop writing. The ctx.Done exit path also
		// closes exited, so this never deadlocks.
		<-exited
	}
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
	// Serial downloads are fine here: n is small for image generation (1-4).
	for idx := range ir.Data {
		ensureImageB64(c, info, &ir.Data[idx])
		item := ir.Data[idx]
		evt := map[string]interface{}{
			"type":       eventType,
			"created_at": ir.Created,
		}
		if item.B64Json != "" {
			evt["b64_json"] = item.B64Json
		} else if item.Url != "" {
			// Degrade rather than fail: settlement is already committed.
			evt["url"] = item.Url
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
//
// The image URL is upstream-supplied, so it is run through the global SSRF
// filter before the request (a tampered/compromised upstream must not steer a
// server-side GET at internal/metadata addresses), and the fetch is bounded by
// imageDownloadTimeout independent of the shared client's (possibly zero) Timeout.
func downloadImageAsBase64(c *gin.Context, info *relaycommon.RelayInfo, imageURL string) (string, error) {
	fs := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(imageURL, fs.EnableSSRFProtection, fs.AllowPrivateIp, fs.DomainFilterMode, fs.IpFilterMode, fs.DomainList, fs.IpList, fs.AllowedPorts, fs.ApplyIPFilterForDomain); err != nil {
		return "", fmt.Errorf("blockrun: image download url blocked: %w", err)
	}
	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return "", err
	}
	if client == nil {
		client = http.DefaultClient
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), imageDownloadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
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
