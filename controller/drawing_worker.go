package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type drawingIdentityKey struct{}
type drawingIdentity struct {
	QuoteLocked bool
	Quote       *types.AgentImageQuote
	UserID      int
	Group       string
	ItemID      string
	RequestID   string
}

// This in-process router is never mounted on the public server. It reconstructs
// user context per job, then uses the existing distributor, relay and billing.
var drawingRelayOnce sync.Once
var drawingRelayEngine *gin.Engine

func getDrawingRelay() *gin.Engine {
	drawingRelayOnce.Do(func() {
		r := gin.New()
		r.Use(gin.Recovery(), middleware.BodyStorageCleanup(), middleware.SystemPerformanceCheck())
		r.Use(func(c *gin.Context) {
			identity, ok := c.Request.Context().Value(drawingIdentityKey{}).(drawingIdentity)
			if !ok {
				c.AbortWithStatus(http.StatusUnauthorized)
				return
			}
			user, err := model.GetUserCache(identity.UserID)
			if err != nil || user.Status != common.UserStatusEnabled {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			if identity.Group != user.Group && !service.GroupInUserUsableGroups(user.Group, identity.Group) {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			user.WriteContext(c)
			c.Set("id", identity.UserID)
			c.Set("group", user.Group)
			c.Set("user_group", user.Group)
			common.SetContextKey(c, constant.ContextKeyUsingGroup, identity.Group)
			common.SetContextKey(c, constant.ContextKeyTokenGroup, identity.Group)
			c.Set(common.RequestIdKey, identity.RequestID)
			if identity.QuoteLocked {
				service.SetLockedAgentImageQuote(c, identity.Quote)
			}
			c.Set("drawing_no_upstream_retry", true)
			c.Set(service.DrawingResponseSpoolContextKey, true)
			c.Next()
		})
		r.Use(middleware.ModelRequestRateLimit(), middleware.Distribute())
		r.Use(func(c *gin.Context) {
			identity := c.Request.Context().Value(drawingIdentityKey{}).(drawingIdentity)
			if identity.ItemID != "" {
				ok, err := model.ReserveDrawingChannel(identity.ItemID, c.GetInt("channel_id"))
				if err != nil {
					c.AbortWithStatus(http.StatusServiceUnavailable)
					return
				}
				if !ok {
					c.Header("X-Drawing-Queue-Busy", "1")
					c.AbortWithStatus(http.StatusTooManyRequests)
					return
				}
			}
			c.Next()
		})
		r.POST("/pg/images/generations", PlaygroundImageGenerations)
		r.POST("/pg/images/edits", PlaygroundImageEdits)
		drawingRelayEngine = r
	})
	return drawingRelayEngine
}

type drawingResponseWriter struct {
	header http.Header
	status int
	writer io.Writer
	size   int64
	limit  int64
	err    error
}

func (w *drawingResponseWriter) Header() http.Header { return w.header }
func (w *drawingResponseWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
}
func (w *drawingResponseWriter) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	if w.err != nil {
		return 0, w.err
	}
	if w.size+int64(len(data)) > w.limit {
		w.err = errors.New("Drawing response exceeds limit")
		return 0, w.err
	}
	n, err := w.writer.Write(data)
	w.size += int64(n)
	w.err = err
	return n, err
}
func (w *drawingResponseWriter) Flush() {}

func runDrawingRelay(ctx context.Context, identity drawingIdentity, path, contentType string, body io.Reader, output io.Writer, limit int64) *drawingResponseWriter {
	ctx = context.WithValue(ctx, drawingIdentityKey{}, identity)
	ctx = context.WithValue(ctx, common.RequestIdKey, identity.RequestID)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, path, body)
	w := &drawingResponseWriter{header: make(http.Header), writer: output, limit: limit}
	if err != nil {
		w.err = err
		return w
	}
	request.Header.Set("Content-Type", contentType)
	getDrawingRelay().ServeHTTP(w, request)
	return w
}

func drawingRequestBody(batch *model.DrawingBatch, item *model.DrawingItem) (string, string, io.Reader, error) {
	size, err := service.DrawingSize(batch.Model, batch.Ratio)
	if err != nil {
		return "", "", nil, err
	}
	prompt := item.Prompt
	if !batch.HasReference {
		body, err := common.Marshal(map[string]any{"model": batch.Model, "group": batch.Group, "prompt": prompt, "size": size, "n": 1, "response_format": "b64_json"})
		return "/pg/images/generations", "application/json", bytes.NewReader(body), err
	}
	path, err := service.DrawingFile(batch.ID, ".input")
	if err != nil {
		return "", "", nil, err
	}
	file, err := os.Open(path)
	if err != nil {
		return "", "", nil, err
	}
	defer file.Close()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	for key, value := range map[string]string{"model": batch.Model, "group": batch.Group, "prompt": prompt, "size": size, "n": "1", "response_format": "b64_json"} {
		if err = form.WriteField(key, value); err != nil {
			return "", "", nil, err
		}
	}
	reference, err := io.ReadAll(io.LimitReader(file, service.MaxDrawingBytes+1))
	if err != nil {
		return "", "", nil, err
	}
	_, mime, err := service.DrawingImageInfo(reference)
	if err != nil {
		return "", "", nil, err
	}
	image, err := form.CreateFormFile("image", "reference."+drawingExtension(mime))
	if err != nil {
		return "", "", nil, err
	}
	if _, err = io.Copy(image, bytes.NewReader(reference)); err != nil {
		return "", "", nil, err
	}
	if err = form.Close(); err != nil {
		return "", "", nil, err
	}
	return "/pg/images/edits", form.FormDataContentType(), &body, nil
}

func executeDrawingItem(item *model.DrawingItem) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	item.ExpiresAt = service.DrawingNow() + model.DrawingLifetime
	item.Status, item.Error = "failed", "Image generation failed; see usage log"
	defer func() {
		if recover() != nil {
			item.Status, item.Error = "unknown", "Generation interrupted; check usage before retrying"
		}
		if item.Status == "queued" {
			return
		}
		item.ExpiresAt = service.DrawingNow() + model.DrawingLifetime
		if err := model.FinishDrawingItem(item); err != nil {
			common.SysError("drawing metadata settlement failed: " + item.ID)
		}
	}()
	batch, err := model.GetDrawingBatch(item.UserID, item.BatchID)
	if err != nil {
		return
	}
	path, contentType, body, err := drawingRequestBody(batch, item)
	if err != nil {
		item.Error = "Reference image unavailable or ratio unsupported"
		return
	}
	responsePath, err := service.DrawingFile(item.ID, ".response")
	if err != nil {
		return
	}
	if err = os.MkdirAll(service.DrawingStorageDir(), 0700); err != nil {
		return
	}
	file, err := os.OpenFile(responsePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return
	}
	defer file.Close()
	identity := drawingIdentity{UserID: item.UserID, Group: batch.Group, ItemID: item.ID, RequestID: item.RequestID, QuoteLocked: batch.AgentQuoteLocked}
	if batch.AgentQuoteJSON != "" {
		var quote types.AgentImageQuote
		if err = common.UnmarshalJsonStr(batch.AgentQuoteJSON, &quote); err != nil {
			item.Error = "Unable to read the locked image price"
			return
		}
		identity.Quote = &quote
	}
	response := runDrawingRelay(ctx, identity, path, contentType, body, file, service.MaxDrawingResponseBytes)
	syncErr := file.Sync()
	closeErr := file.Close()
	if response.header.Get("X-Drawing-Queue-Busy") == "1" {
		err = model.DB.Model(&model.DrawingItem{}).Where("id = ? AND status = ?", item.ID, "running").Updates(map[string]any{"status": "queued", "channel_id": 0, "available_at": service.DrawingNow() + 5, "attempts": item.Attempts - 1}).Error
		if err == nil {
			item.Status = "queued"
		}
		return
	}
	if response.err != nil || syncErr != nil || closeErr != nil || response.status >= 500 || ctx.Err() != nil {
		item.Status, item.Error = "unknown", "Generation interrupted; check usage before retrying"
		return
	}
	if response.status < 200 || response.status >= 300 {
		switch response.status {
		case 401, 403:
			item.Error = "Model or group access denied"
		case 402:
			item.Error = "Insufficient quota"
		case 429:
			item.Error = "Rate limit reached; retry later"
		}
		return
	}
	if err = service.SaveDrawingResponse(ctx, item); err != nil {
		item.Status, item.Error = "storage_failed", "Image received but not saved; recover without generating again"
		return
	}
	item.Status, item.Error = "succeeded", ""
}

// Multiple instances may poll; database claims enforce global/user concurrency.
// All instances must use the same DRAWING_STORAGE_DIR volume.
func StartDrawingWorker() error {
	if err := model.InitDrawingQueue(); err != nil {
		return err
	}
	if err := os.MkdirAll(service.DrawingStorageDir(), 0700); err != nil {
		return err
	}
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		lastCleanup := int64(0)
		for range ticker.C {
			now := service.DrawingNow()
			if now-lastCleanup >= 60 {
				if err := service.CleanupDrawings(now); err != nil {
					common.SysError("drawing cleanup failed; will retry next minute")
				}
				lastCleanup = now
			}
			for i := 0; i < service.DrawingConcurrency(); i++ {
				item, err := model.ClaimDrawingItem(now, service.DrawingConcurrency())
				if err != nil {
					common.SysError("drawing queue claim failed")
					break
				}
				if item == nil {
					break
				}
				go executeDrawingItem(item)
			}
		}
	}()
	return nil
}
