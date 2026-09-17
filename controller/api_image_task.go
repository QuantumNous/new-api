package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	localtypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func apiImageTaskFile(id, suffix string) string {
	return filepath.Join(service.DrawingStorageDir(), "api-tasks", id+suffix)
}

func apiImageTaskError(c *gin.Context, status int, code, message string) {
	c.Header("x-should-retry", "false")
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}

func CreateAPIImageTask(c *gin.Context) {
	key, err := uuid.Parse(c.GetHeader("Idempotency-Key"))
	if err != nil {
		apiImageTaskError(c, 400, "invalid_idempotency_key", "Idempotency-Key must be a UUID; reuse it when checking an uncertain submission")
		return
	}
	if c.ContentType() != "application/json" {
		apiImageTaskError(c, 415, "invalid_content_type", "This endpoint accepts JSON image generation requests")
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, service.MaxDrawingBytes+1))
	if err != nil || int64(len(body)) > service.MaxDrawingBytes {
		apiImageTaskError(c, 413, "request_too_large", "Unable to read image request or request exceeds 32 MiB")
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	input, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	if err != nil {
		apiImageTaskError(c, 400, "invalid_request", "Invalid image generation request")
		return
	}
	if input.Stream != nil && *input.Stream {
		apiImageTaskError(c, 400, "invalid_request", "Async tasks return JSON; stream must be false")
		return
	}
	count := 1
	if input.N != nil {
		count = int(*input.N)
	}
	if c.GetBool("token_model_limit_enabled") {
		value, _ := c.Get("token_model_limit")
		limits, _ := value.(map[string]bool)
		if !limits[input.Model] {
			apiImageTaskError(c, 403, "model_not_allowed", "This API key cannot use the requested model")
			return
		}
	}
	now := time.Now().Unix()
	task := &model.APIImageTask{ID: uuid.NewString(), UserID: c.GetInt("id"), TokenID: c.GetInt("token_id"), SubmissionID: key.String(), RequestHash: fmt.Sprintf("%x", sha256.Sum256(body)), ClientIP: c.ClientIP(), Model: input.Model, Count: count, Status: "queued", CreatedAt: now, ExpiresAt: now + 24*3600, RequestID: common.NewRequestId()}
	if input.Model == model.AgentImageModel {
		quote, quoteErr := service.ResolveAgentImageQuote(task.UserID, input.Model)
		if quoteErr != nil {
			apiImageTaskError(c, 503, "price_unavailable", "Unable to determine image price")
			return
		}
		task.QuoteLocked = true
		if quote != nil {
			data, e := common.Marshal(quote)
			if e != nil {
				apiImageTaskError(c, 500, "price_unavailable", "Unable to save image price")
				return
			}
			task.QuoteJSON = string(data)
		}
	}
	path := apiImageTaskFile(task.ID, ".request")
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		apiImageTaskError(c, 503, "storage_unavailable", "Unable to save image task")
		return
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		apiImageTaskError(c, 503, "storage_unavailable", "Unable to save image task")
		return
	}
	_, writeErr := f.Write(body)
	syncErr := f.Sync()
	closeErr := f.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		_ = os.Remove(path)
		apiImageTaskError(c, 503, "storage_unavailable", "Unable to save image task")
		return
	}
	originalID := task.ID
	task, err = model.CreateAPIImageTask(task)
	if err != nil || task.ID != originalID {
		_ = os.Remove(path)
	}
	if err != nil {
		apiImageTaskError(c, 409, "task_conflict", err.Error())
		return
	}
	if task.ExpiresAt <= now {
		apiImageTaskError(c, 410, "task_expired", "This task has expired; it will not be generated again")
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Location", "/v1/images/tasks/"+task.ID)
	c.JSON(http.StatusAccepted, task)
}

func GetAPIImageTask(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	idValue := c.Param("id")
	bySubmission := c.Param("submission") != ""
	if bySubmission {
		idValue = c.Param("submission")
	}
	id, err := uuid.Parse(idValue)
	if err != nil {
		apiImageTaskError(c, 404, "task_not_found", "Image task not found")
		return
	}
	token, err := model.GetTokenByIds(c.GetInt("token_id"), c.GetInt("id"))
	if err != nil {
		apiImageTaskError(c, 401, "invalid_token", "Invalid API key")
		return
	}
	if ips := token.GetIpLimits(); len(ips) > 0 && !common.IsIpInCIDRList(net.ParseIP(c.ClientIP()), ips) {
		apiImageTaskError(c, 403, "access_denied", "IP not allowed")
		return
	}
	var task *model.APIImageTask
	if bySubmission {
		task = &model.APIImageTask{}
		err = model.DB.Where("user_id = ? AND token_id = ? AND submission_id = ?", c.GetInt("id"), c.GetInt("token_id"), id.String()).First(task).Error
	} else {
		task, err = model.GetAPIImageTask(c.GetInt("id"), c.GetInt("token_id"), id.String())
	}
	if err != nil {
		apiImageTaskError(c, 404, "task_not_found", "Image task not found")
		return
	}
	if task.ExpiresAt <= time.Now().Unix() {
		apiImageTaskError(c, 410, "task_expired", "Image task expired")
		return
	}
	if c.FullPath() != "/v1/images/tasks/:id/result" {
		c.JSON(200, task)
		return
	}
	if task.Status == "queued" || task.Status == "running" {
		c.Header("Retry-After", "2")
		c.JSON(202, task)
		return
	}
	if task.Status != "succeeded" && task.Status != "failed" {
		apiImageTaskError(c, 409, "task_outcome_unknown", "Task outcome is unknown; check usage before submitting another task")
		return
	}
	data, err := os.ReadFile(apiImageTaskFile(task.ID, ".result"))
	if err != nil {
		apiImageTaskError(c, 503, "result_unavailable", "Saved result is unavailable; do not generate again automatically")
		return
	}
	c.Header("x-should-retry", "false")
	c.Header("X-Request-Id", task.RequestID)
	c.Data(task.HTTPStatus, "application/json", data)
}

type apiImageTaskIdentity struct{}

var apiImageRelayOnce sync.Once
var apiImageRelay *gin.Engine

func getAPIImageRelay() *gin.Engine {
	apiImageRelayOnce.Do(func() {
		r := gin.New()
		r.Use(gin.Recovery(), middleware.BodyStorageCleanup(), middleware.TokenAuth())
		r.Use(func(c *gin.Context) {
			identity, ok := c.Request.Context().Value(apiImageTaskIdentity{}).(*model.APIImageTask)
			if !ok || identity.UserID != c.GetInt("id") || identity.TokenID != c.GetInt("token_id") {
				c.AbortWithStatus(403)
				return
			}
			c.Set(common.RequestIdKey, identity.RequestID)
			c.Set("drawing_no_upstream_retry", true)
			c.Set("async_image_task", true)
			if identity.QuoteLocked {
				var quote *localtypes.AgentImageQuote
				if identity.QuoteJSON != "" {
					quote = &localtypes.AgentImageQuote{}
					if common.UnmarshalJsonStr(identity.QuoteJSON, quote) != nil {
						c.AbortWithStatus(500)
						return
					}
				}
				service.SetLockedAgentImageQuote(c, quote)
			}
			c.Next()
		})
		r.POST("/v1/images/generations", middleware.ModelRequestRateLimit(), middleware.Distribute(), func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
		r.POST("/v1/images/edits", middleware.ModelRequestRateLimit(), middleware.Distribute(), func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
		apiImageRelay = r
	})
	return apiImageRelay
}

func executeAPIImageTask(task *model.APIImageTask) {
	task.Status, task.Error = "unknown", "Generation interrupted; check usage before submitting another task"
	defer func() {
		if recover() != nil {
			task.Status = "unknown"
		}
		if err := model.FinishAPIImageTask(task); err != nil {
			common.SysError("async image task settlement failed: " + task.ID)
		}
	}()
	token, err := model.GetTokenByIds(task.TokenID, task.UserID)
	if err != nil {
		return
	}
	body, err := os.ReadFile(apiImageTaskFile(task.ID, ".request"))
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	ctx = context.WithValue(ctx, apiImageTaskIdentity{}, task)
	ctx = context.WithValue(ctx, common.RequestIdKey, task.RequestID)
	var input struct {
		Images json.RawMessage `json:"images"`
	}
	if common.Unmarshal(body, &input) != nil {
		return
	}
	requestPath := "/v1/images/generations"
	if service.HasJSONImageReferences(input.Images) {
		requestPath = "/v1/images/edits"
	}
	req, err := http.NewRequestWithContext(ctx, "POST", requestPath, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.RemoteAddr = net.JoinHostPort(task.ClientIP, "0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sk-"+token.Key)
	path := apiImageTaskFile(task.ID, ".result.tmp")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	w := &drawingResponseWriter{header: make(http.Header), writer: f, limit: service.MaxDrawingResponseBytes + (1 << 20)}
	getAPIImageRelay().ServeHTTP(w, req)
	syncErr := f.Sync()
	closeErr := f.Close()
	if w.err != nil || syncErr != nil || closeErr != nil || ctx.Err() != nil {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var envelope map[string]any
	if common.Unmarshal(data, &envelope) != nil {
		return
	}
	if err = os.Rename(path, apiImageTaskFile(task.ID, ".result")); err != nil {
		return
	}
	task.HTTPStatus = w.status
	task.Status, task.Error = "succeeded", ""
	if w.status < 200 || w.status >= 300 {
		task.Status, task.Error = "failed", "Image request failed; retrieve the saved error result"
	}
	_ = os.Remove(apiImageTaskFile(task.ID, ".request"))
}

func StartAPIImageWorker() {
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		var cleanupAt int64
		for range ticker.C {
			now := time.Now().Unix()
			if now-cleanupAt >= 60 {
				cleanupAt = now
				var expired []model.APIImageTask
				if model.DB.Where("expires_at <= ? AND status NOT IN ?", now, []string{"running", "queued", "expired"}).Limit(500).Find(&expired).Error == nil {
					for _, task := range expired {
						removed := true
						for _, suffix := range []string{".request", ".result", ".result.tmp"} {
							if e := os.Remove(apiImageTaskFile(task.ID, suffix)); e != nil && !os.IsNotExist(e) {
								removed = false
							}
						}
						if removed {
							_ = model.DB.Model(&model.APIImageTask{}).Where("id = ?", task.ID).Updates(map[string]any{"status": "expired", "quote_json": "", "client_ip": ""}).Error
						}
					}
				}
				_ = model.DB.Where("expires_at < ? AND status NOT IN ?", now-6*24*3600, []string{"running", "queued"}).Delete(&model.APIImageTask{}).Error
			}
			for {
				task, err := model.ClaimAPIImageTask(time.Now().Unix())
				if err != nil {
					common.SysError("async image queue claim failed")
					break
				}
				if task == nil {
					break
				}
				go executeAPIImageTask(task)
			}
		}
	}()
}
