package controller

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// fakeResponseWriter — implements gin.ResponseWriter for background goroutines
// ---------------------------------------------------------------------------

// fakeResponseWriter wraps the underlying http.ResponseWriter so that a
// background goroutine can call adaptor.DoRequest (which may inspect or write
// to the response writer) without writing to the already-closed client
// connection.
type fakeResponseWriter struct {
	http.ResponseWriter
	status int
	size   int
}

func newFakeResponseWriter(w http.ResponseWriter) *fakeResponseWriter {
	return &fakeResponseWriter{
		ResponseWriter: w,
		status:         http.StatusOK,
		size:           -1,
	}
}

func (w *fakeResponseWriter) Status() int              { return w.status }
func (w *fakeResponseWriter) Size() int                { return w.size }
func (w *fakeResponseWriter) Written() bool            { return w.size != -1 }
func (w *fakeResponseWriter) WriteHeaderNow()          {}
func (w *fakeResponseWriter) Pusher() http.Pusher      { return nil }

func (w *fakeResponseWriter) WriteHeader(code int) {
	if code > 0 {
		w.status = code
	}
}

func (w *fakeResponseWriter) Write(data []byte) (int, error) {
	if w.size == -1 {
		w.size = 0
	}
	n, err := w.ResponseWriter.Write(data)
	w.size += n
	return n, err
}

func (w *fakeResponseWriter) WriteString(s string) (int, error) {
	if w.size == -1 {
		w.size = 0
	}
	n, err := io.WriteString(w.ResponseWriter, s)
	w.size += n
	return n, err
}

func (w *fakeResponseWriter) Flush() {
	if fw, ok := w.ResponseWriter.(http.Flusher); ok {
		fw.Flush()
	}
}

func (w *fakeResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if w.size < 0 {
		w.size = 0
	}
	if hj, ok := w.ResponseWriter.(http.Hijacker); ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
}

func (w *fakeResponseWriter) CloseNotify() <-chan bool {
	if cn, ok := w.ResponseWriter.(http.CloseNotifier); ok {
		return cn.CloseNotify()
	}
	ch := make(chan bool, 1)
	ch <- false
	return ch
}

// ---------------------------------------------------------------------------
// buildBackgroundContext — creates a gin.Context for background goroutines
// ---------------------------------------------------------------------------

// buildBackgroundContext creates a minimal gin.Context suitable for use in a
// background goroutine. It copies all context keys from the original request
// (set by middleware: auth, distribute, channel selection, etc.) and attaches
// a fresh request body from the captured bytes.
func buildBackgroundContext(c *gin.Context, bodyBytes []byte) *gin.Context {
	bg := &gin.Context{}
	bg.Keys = make(map[string]any, len(c.Keys))
	for k, v := range c.Keys {
		bg.Keys[k] = v
	}

	// Build a fresh *http.Request with the captured body.
	origReq := c.Request
	freshBody := io.NopCloser(bytes.NewReader(bodyBytes))
	freshReq := &http.Request{
		Method:           origReq.Method,
		URL:              origReq.URL,
		Proto:            origReq.Proto,
		ProtoMajor:       origReq.ProtoMajor,
		ProtoMinor:       origReq.ProtoMinor,
		Header:           origReq.Header.Clone(),
		Body:             freshBody,
		ContentLength:    int64(len(bodyBytes)),
		TransferEncoding: origReq.TransferEncoding,
		Host:             origReq.Host,
		RemoteAddr:       origReq.RemoteAddr,
		RequestURI:       "", // must be empty for non-initial requests
	}
	bg.Request = freshReq

	// Attach a fake response writer so any accidental writes don't panic.
	// Type-assert to access the Unwrap method that returns the underlying http.ResponseWriter.
	type unwrappable interface {
		Unwrap() http.ResponseWriter
	}
	if uw, ok := c.Writer.(unwrappable); ok {
		bg.Writer = newFakeResponseWriter(uw.Unwrap())
	} else {
		bg.Writer = newFakeResponseWriter(c.Writer)
	}

	return bg
}

// ---------------------------------------------------------------------------
// RelayAsyncImage — POST /v1/images/generations with async: true
// ---------------------------------------------------------------------------

// RelayAsyncImage handles POST /v1/images/generations with async: true.
//
// Phase 1 (sync): parse, validate, billing pre-consume, channel selection,
//   create Task as IN_PROGRESS, return 202 Accepted with task_id.
//
// Phase 2 (async goroutine): run ImageAsyncHelper, update Task to
//   SUCCESS/FAILURE, settle/refund billing.
func RelayAsyncImage(c *gin.Context) {
	logger.LogInfo(c, "async image: handler entered")
	requestId := c.GetString(common.RequestIdKey)

	var newAPIError *types.NewAPIError

	defer func() {
		if r := recover(); r != nil {
			buf := make([]byte, 2048)
			n := runtime.Stack(buf, false)
			logger.LogError(c, fmt.Sprintf("async image PANIC: %v\n%s", r, buf[:n]))
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": &types.OpenAIError{
					Message: fmt.Sprintf("internal panic: %v", r),
					Type:    "internal_server_error",
				},
			})
			return
		}
		if newAPIError != nil {
			logger.LogError(c, fmt.Sprintf("async image relay error: %s", common.LocalLogPreview(newAPIError.Error())))
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	// 1. Parse and validate request
	request, err := helper.GetAndValidateRequest(c, types.RelayFormatOpenAIImage)
	if err != nil {
		if common.IsRequestBodyTooLargeError(err) || errors.Is(err, common.ErrRequestBodyTooLarge) {
			newAPIError = types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
		} else {
			newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest)
		}
		return
	}

	// Verify async flag
	imageReq, ok := request.(*dto.ImageRequest)
	if !ok || !imageReq.IsAsync() {
		newAPIError = types.NewError(fmt.Errorf("async mode not enabled"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	// 2. Generate relay info
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, request, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}
	if relayInfo == nil {
		newAPIError = types.NewError(fmt.Errorf("GenRelayInfo returned nil relayInfo"), types.ErrorCodeGenRelayInfoFailed)
		return
	}

	// Initialize TaskRelayInfo (embedded pointer, not set by GenRelayInfoImage)
	if relayInfo.TaskRelayInfo == nil {
		relayInfo.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}

	// Set action for image generation task
	relayInfo.Action = constant.TaskActionImageGenerate

	// Pre-generate public task ID
	relayInfo.PublicTaskID = model.GenerateTaskID()

	// 3. Token estimation and pricing
	needSensitiveCheck := setting.ShouldCheckPromptSensitive()
	needCountToken := constant.CountToken
	var meta *types.TokenCountMeta
	if needSensitiveCheck || needCountToken {
		meta = request.GetTokenCountMeta()
	} else {
		meta = fastTokenCountMetaForPricing(request)
	}

	if needSensitiveCheck && meta != nil {
		contains, words := service.CheckSensitiveText(meta.CombineText)
		if contains {
			logger.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			newAPIError = types.NewError(nil, types.ErrorCodeSensitiveWordsDetected)
			return
		}
	}

	tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeCountTokenFailed)
		return
	}
	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
		return
	}

	// 4. Pre-consume billing
	if priceData.FreeModel {
		logger.LogInfo(c, fmt.Sprintf("模型 %s 免费，跳过预扣费", relayInfo.OriginModelName))
	} else {
		newAPIError = service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)
		if newAPIError != nil {
			return
		}
	}

	// 5. Channel selection with retry (sync — must select channel before returning 202)
	var capturedBodyBytes []byte

	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: relayInfo.TokenGroup,
		ModelName:  relayInfo.OriginModelName,
		Retry:      common.GetPointer(0),
	}
	relayInfo.RetryIndex = 0
	relayInfo.LastError = nil

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		relayInfo.RetryIndex = retryParam.GetRetry()
		channel, channelErr := getChannel(c, relayInfo, retryParam)
		if channelErr != nil {
			logger.LogError(c, channelErr.Error())
			newAPIError = channelErr
			break
		}

		addUsedChannel(c, channel.Id)
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
			} else {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			break
		}

		// Capture body bytes for the goroutine (doRequest may close the body)
		bodyBytes, bodyErr := bodyStorage.Bytes()
		if bodyErr != nil {
			newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			break
		}

		capturedBodyBytes = bodyBytes
		break
	}

	if newAPIError != nil {
		// Refund pre-consumed billing on channel selection failure
		newAPIError = service.NormalizeViolationFeeError(newAPIError)
		if relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
		service.ChargeViolationFeeIfNeeded(c, relayInfo, newAPIError)
		return
	}

	// 6. Create Task record as IN_PROGRESS
	if relayInfo == nil {
		newAPIError = types.NewError(fmt.Errorf("relayInfo is nil before InitTask"), types.ErrorCodeGenRelayInfoFailed)
		return
	}
	// Initialize ChannelMeta (not set by GenRelayInfoImage; InitTask reads ChannelId from it)
	if relayInfo.ChannelMeta == nil {
		relayInfo.InitChannelMeta(c)
	}
	task := model.InitTask(constant.TaskPlatformImage, relayInfo)
	task.PrivateData.UpstreamTaskID = relayInfo.UpstreamModelName
	task.PrivateData.BillingSource = relayInfo.BillingSource
	task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
	task.PrivateData.TokenId = relayInfo.TokenId
	task.PrivateData.CallbackURL = relayInfo.CallbackURL
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice:      relayInfo.PriceData.ModelPrice,
		GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
		ModelRatio:      relayInfo.PriceData.ModelRatio,
		OtherRatios:     relayInfo.PriceData.OtherRatios,
		OriginModelName: relayInfo.OriginModelName,
		PerCallBilling:  common.StringsContains(constant.TaskPricePatches, relayInfo.OriginModelName) || relayInfo.PriceData.UsePrice,
	}
	task.Quota = relayInfo.PriceData.Quota
	task.Action = relayInfo.Action
	task.Status = model.TaskStatusInProgress
	task.Progress = "0%"

	if insertErr := task.Insert(); insertErr != nil {
		common.SysError("insert async image task error: " + insertErr.Error())
		newAPIError = types.NewErrorWithStatusCode(insertErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
		// Refund billing on task insert failure
		newAPIError = service.NormalizeViolationFeeError(newAPIError)
		if relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
		return
	}

	// 7. Return 202 Accepted
	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"data": map[string]any{
			"task_id":    task.TaskID,
			"status":     "submitted",
			"created_at": time.Now().Unix(),
		},
	})

	// 8. Launch background goroutine for image generation
	taskID := task.TaskID
	relayInfoCopy := *relayInfo // shallow copy to avoid race on relayInfo fields

	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				common.SysError(fmt.Sprintf("async image goroutine panic: %v", r))
				updated, casErr := updateAsyncTaskStatus(relayInfoCopy.UserId, taskID,
					model.TaskStatusInProgress, model.TaskStatusFailure, map[string]any{
						"fail_reason": fmt.Sprintf("internal panic: %v", r),
						"finish_time": time.Now().Unix(),
					})
				if casErr != nil {
					common.SysError("CAS update task to failure (panic) error: " + casErr.Error())
				} else if updated {
					relayInfoCopy.Billing.Refund(c)
				}
			}
		}()

		// Build background gin.Context with captured body and channel keys
		bgCtx := buildBackgroundContext(c, capturedBodyBytes)

		// Run image generation
		result, helperErr := relay.ImageAsyncHelper(bgCtx, &relayInfoCopy, taskID)

		if helperErr != nil {
			// Failure — update task to FAILURE, refund billing
			logger.LogError(c, fmt.Sprintf("async image generation failed: %s", common.LocalLogPreview(helperErr.Error())))

			updated, casErr := updateAsyncTaskStatus(relayInfoCopy.UserId, taskID,
				model.TaskStatusInProgress, model.TaskStatusFailure, map[string]any{
					"fail_reason": helperErr.Error(),
					"finish_time": time.Now().Unix(),
				})
			if casErr != nil {
				common.SysError("CAS update task to failure error: " + casErr.Error())
			} else if updated {
				relayInfoCopy.Billing.Refund(c)
				service.ChargeViolationFeeIfNeeded(c, &relayInfoCopy, helperErr)
			}

			// Send callback on failure
			sendCallback(c, relayInfoCopy.CallbackURL, taskID, "failed", nil, helperErr.Error())

			gopool.Go(func() {
				perfmetrics.RecordRelaySample(&relayInfoCopy, false, 0)
			})
			return
		}

		// Success — update task to SUCCESS
		extraUpdates := map[string]any{
			"data":        result.RawBody,
			"progress":    "100%",
			"finish_time": time.Now().Unix(),
		}

		// Parse image response to extract URL (store in fail_reason as fallback
		// for GetResultURL — avoids overwriting private_data JSON column)
		var imageResp dto.ImageResponse
		if err := common.Unmarshal(result.RawBody, &imageResp); err == nil {
			if len(imageResp.Data) > 0 && imageResp.Data[0].Url != "" {
				extraUpdates["fail_reason"] = imageResp.Data[0].Url
			}
		}

		updated, casErr := updateAsyncTaskStatus(relayInfoCopy.UserId, taskID,
			model.TaskStatusInProgress, model.TaskStatusSuccess, extraUpdates)
		if casErr != nil {
			common.SysError("CAS update task to success error: " + casErr.Error())
			return
		}
		if !updated {
			common.SysError("CAS update task to success: no rows affected (task may have been updated already)")
			return
		}

		// Settle billing (pre-consume was done, now settle with actual quota)
		if settleErr := service.SettleBilling(c, &relayInfoCopy, relayInfoCopy.PriceData.Quota); settleErr != nil {
			common.SysError("settle async image billing error: " + settleErr.Error())
		}
		service.LogTaskConsumption(c, &relayInfoCopy)

		// Send callback on success
		sendCallback(c, relayInfoCopy.CallbackURL, taskID, "succeeded", imageResp, "")

		gopool.Go(func() {
			perfmetrics.RecordRelaySample(&relayInfoCopy, true, 0)
		})
	})
}

// ---------------------------------------------------------------------------
// RelayAsyncImageFetch — GET /v1/images/generations/:task_id
// ---------------------------------------------------------------------------

// RelayAsyncImageFetch handles GET /v1/images/generations/:task_id.
// Returns the task status and image result in a standard format.
func RelayAsyncImageFetch(c *gin.Context) {
	taskId := c.Param("task_id")
	if taskId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": &types.OpenAIError{
				Message: "task_id is required",
				Type:    "invalid_request_error",
			},
		})
		return
	}

	userId := c.GetInt("id")
	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": &types.OpenAIError{
				Message: fmt.Sprintf("failed to get task: %s", err.Error()),
				Type:    "internal_server_error",
			},
		})
		return
	}
	if !exist {
		c.JSON(http.StatusNotFound, gin.H{
			"error": &types.OpenAIError{
				Message: fmt.Sprintf("task not found: %s", taskId),
				Type:    "invalid_request_error",
			},
		})
		return
	}

	// Check if the task is still in progress
	if originTask.Status != model.TaskStatusSuccess && originTask.Status != model.TaskStatusFailure {
		c.JSON(http.StatusOK, map[string]any{
			"success": true,
			"data": map[string]any{
				"task_id":    originTask.TaskID,
				"status":     taskStatusToSimple(originTask.Status),
				"progress":   originTask.Progress,
				"created_at": originTask.CreatedAt,
			},
		})
		return
	}

	// For completed tasks, check the request path to determine response format
	isOpenAIImageAPI := strings.HasPrefix(c.Request.URL.Path, "/v1/images/")

	if isOpenAIImageAPI {
		// Return in OpenAI Image API format
		var imageResp dto.ImageResponse
		if err := common.Unmarshal(originTask.Data, &imageResp); err == nil {
			c.JSON(http.StatusOK, imageResp)
			return
		}
		// Fallback: construct response from task data
		c.JSON(http.StatusOK, map[string]any{
			"data": map[string]any{
				"url": originTask.GetResultURL(),
			},
			"created": originTask.CreatedAt,
		})
		return
	}

	// Generic task format
	c.JSON(http.StatusOK, relay.TaskModel2Dto(originTask))
}

// taskStatusToSimple maps internal TaskStatus to simplified status strings.
func taskStatusToSimple(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusQueued, model.TaskStatusSubmitted:
		return "queued"
	default:
		return "processing"
	}
}

// updateAsyncTaskStatus performs a CAS status update on a task using a map-based
// update. This avoids GORM's Select("*") primary key issue where a zero-value
// ID in the struct causes Model(t) to add WHERE id = 0, matching no rows.
func updateAsyncTaskStatus(userId int, taskId string, fromStatus, toStatus model.TaskStatus, extra map[string]any) (bool, error) {
	updates := map[string]any{
		"status": toStatus,
	}
	for k, v := range extra {
		updates[k] = v
	}
	result := model.DB.Model(&model.Task{}).
		Where("user_id = ? AND task_id = ? AND status = ?", userId, taskId, fromStatus).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

// sendCallback POSTs the task result to the callback_url (if configured).
// Non-blocking: failures are logged but never propagated.
func sendCallback(c *gin.Context, callbackURL string, taskID string, status string, data any, failReason string) {
	if callbackURL == "" {
		return
	}

	payload := map[string]any{
		"task_id": taskID,
		"status":  status,
	}
	if status == "succeeded" {
		payload["data"] = data
	} else if status == "failed" {
		payload["error"] = map[string]any{
			"message": failReason,
		}
	}

	body, err := common.Marshal(payload)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("callback: failed to marshal payload for task %s: %s", taskID, err.Error()))
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(callbackURL, "application/json", bytes.NewReader(body))
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("callback: POST to %s failed for task %s: %s", callbackURL, taskID, err.Error()))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		logger.LogWarn(c, fmt.Sprintf("callback: POST to %s returned HTTP %d for task %s: %s", callbackURL, resp.StatusCode, taskID, common.LocalLogPreview(string(respBody))))
	}
}
