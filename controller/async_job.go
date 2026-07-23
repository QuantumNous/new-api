package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/storage"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type asyncControllerError struct {
	status  int
	code    string
	message string
}

func (e *asyncControllerError) Error() string { return e.message }

var newAsyncArtifactStore = func(ctx context.Context) (storage.ArtifactStore, error) {
	return storage.NewS3ArtifactStore(ctx)
}

func respondAsyncError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{
		"message": message,
		"type":    "async_task_error",
		"code":    code,
	}})
}

func asyncStatusText(status model.AsyncExecutionStatus) string {
	return strings.ToLower(string(status))
}

func asyncSubmitResponse(job *model.AsyncJob) dto.AsyncSubmitResponse {
	publicID := job.Task.TaskID
	return dto.AsyncSubmitResponse{
		ID:        publicID,
		Status:    asyncStatusText(job.ExecutionStatus),
		StatusURL: "/v1/async/tasks/" + publicID,
		ResultURL: "/v1/async/tasks/" + publicID + "/result",
	}
}

func SubmitAsyncImageTask(c *gin.Context) {
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		respondAsyncError(c, http.StatusBadRequest, "idempotency_key_required", "Idempotency-Key header is required")
		return
	}
	if len(idempotencyKey) > 191 {
		respondAsyncError(c, http.StatusBadRequest, "idempotency_key_too_long", "Idempotency-Key must not exceed 191 bytes")
		return
	}
	if common.BatchUpdateEnabled {
		respondAsyncError(c, http.StatusServiceUnavailable, "async_immediate_billing_required", "asynchronous image tasks require BATCH_UPDATE_ENABLED=false")
		return
	}

	request, err := helper.GetAndValidOpenAIImageRequest(c, 0)
	if err != nil {
		respondAsyncError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	bodyStorage, err := common.GetBodyStorage(c)
	if err != nil {
		respondAsyncError(c, http.StatusBadRequest, "read_request_body_failed", err.Error())
		return
	}
	rawBody, err := bodyStorage.Bytes()
	if err != nil {
		respondAsyncError(c, http.StatusBadRequest, "read_request_body_failed", err.Error())
		return
	}
	if err := service.ValidateAsyncImageRequest(request, rawBody); err != nil {
		respondAsyncError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	requestHash, err := service.HashAsyncRequest(rawBody)
	if err != nil {
		respondAsyncError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	encryptedPayload, err := service.EncryptAsyncPayload(rawBody)
	if err != nil {
		respondAsyncError(c, http.StatusServiceUnavailable, "async_encryption_unavailable", err.Error())
		return
	}

	tokenID := c.GetInt("token_id")
	var queuedJob *model.AsyncJob
	err = model.WithAsyncIdempotencyLock(c.Request.Context(), tokenID, idempotencyKey, func() error {
		existing, lookupErr := model.GetAsyncJobByTokenAndKey(c.Request.Context(), tokenID, idempotencyKey)
		if lookupErr != nil {
			return lookupErr
		}
		if existing != nil {
			if existing.RequestHash != requestHash {
				return &asyncControllerError{status: http.StatusConflict, code: "idempotency_key_conflict", message: "Idempotency-Key was already used with a different request"}
			}
			queuedJob = existing
			return nil
		}

		relayInfo, infoErr := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, request, nil)
		if infoErr != nil {
			return &asyncControllerError{status: http.StatusInternalServerError, code: "relay_context_failed", message: infoErr.Error()}
		}
		relayInfo.InitChannelMeta(c)
		provider, allowedProvider := service.AsyncImageProviderForBaseURL(relayInfo.ChannelBaseUrl)
		if relayInfo.ChannelMeta == nil || !allowedProvider {
			return &asyncControllerError{status: http.StatusBadRequest, code: "async_image_channel_required", message: "selected channel is not an allowed synchronous image wrapper channel"}
		}
		if validationErr := service.ValidateAsyncImageProviderRequest(request, provider); validationErr != nil {
			return &asyncControllerError{status: http.StatusBadRequest, code: "invalid_provider_request", message: validationErr.Error()}
		}

		meta := request.GetTokenCountMeta()
		tokens, countErr := service.EstimateRequestToken(c, meta, relayInfo)
		if countErr != nil {
			return &asyncControllerError{status: http.StatusBadRequest, code: "count_token_failed", message: countErr.Error()}
		}
		relayInfo.SetEstimatePromptTokens(tokens)
		priceData, priceErr := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
		if priceErr != nil {
			return &asyncControllerError{status: http.StatusBadRequest, code: "model_price_error", message: priceErr.Error()}
		}
		relayInfo.ForcePreConsume = true
		if !priceData.FreeModel {
			if apiErr := service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo); apiErr != nil {
				return &asyncControllerError{status: apiErr.StatusCode, code: string(apiErr.GetErrorCode()), message: apiErr.Error()}
			}
		}

		refundOnFailure := true
		defer func() {
			if refundOnFailure && relayInfo.Billing != nil {
				relayInfo.Billing.Refund(c)
			}
		}()

		task := model.InitTask(constant.TaskPlatformAsyncImage, relayInfo)
		task.Status = model.TaskStatusQueued
		task.Progress = "0%"
		task.Action = model.AsyncEndpointImageGeneration
		task.Quota = relayInfo.FinalPreConsumedQuota
		task.PrivateData.BillingSource = relayInfo.BillingSource
		task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
		task.PrivateData.TokenId = relayInfo.TokenId
		task.PrivateData.NodeName = common.NodeName
		task.PrivateData.BillingContext = &model.TaskBillingContext{
			ModelPrice:      relayInfo.PriceData.ModelPrice,
			GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
			ModelRatio:      relayInfo.PriceData.ModelRatio,
			OtherRatios:     relayInfo.PriceData.OtherRatios(),
			OriginModelName: relayInfo.OriginModelName,
			PerCallBilling:  relayInfo.PriceData.UsePrice,
		}
		task.SetData(map[string]any{"model": request.Model, "endpoint_type": model.AsyncEndpointImageGeneration})

		job := &model.AsyncJob{
			TokenID:          relayInfo.TokenId,
			ChannelID:        relayInfo.ChannelId,
			EndpointType:     model.AsyncEndpointImageGeneration,
			RequestPayload:   encryptedPayload,
			RequestHash:      requestHash,
			IdempotencyKey:   idempotencyKey,
			ExecutionStatus:  model.AsyncStatusQueued,
			BillingStatus:    model.AsyncBillingReserved,
			BillingRequestID: relayInfo.RequestId,
		}
		if createErr := model.CreateAsyncTask(task, job); createErr != nil {
			return createErr
		}
		job.Task = *task
		queuedJob = job
		refundOnFailure = false
		return nil
	})
	if err != nil {
		var controllerErr *asyncControllerError
		if errors.As(err, &controllerErr) {
			respondAsyncError(c, controllerErr.status, controllerErr.code, controllerErr.message)
			return
		}
		logger.LogError(c, "create async image task failed: "+err.Error())
		respondAsyncError(c, http.StatusInternalServerError, "create_task_failed", "failed to persist async image task")
		return
	}
	c.JSON(http.StatusAccepted, asyncSubmitResponse(queuedJob))
}

func GetAsyncTask(c *gin.Context) {
	job := ownedAsyncJob(c)
	if job == nil {
		return
	}
	c.JSON(http.StatusOK, asyncTaskStatusResponse(job))
}

func asyncTaskStatusResponse(job *model.AsyncJob) dto.AsyncTaskStatusResponse {
	response := dto.AsyncTaskStatusResponse{
		ID:        job.Task.TaskID,
		Status:    asyncStatusText(job.ExecutionStatus),
		Progress:  parseTaskProgress(job.Task.Progress),
		CreatedAt: job.Task.SubmitTime,
	}
	if job.Task.StartTime > 0 {
		started := job.Task.StartTime
		response.StartedAt = &started
	}
	if job.Task.FinishTime > 0 {
		finished := job.Task.FinishTime
		response.FinishedAt = &finished
	}
	if job.ErrorCode != "" || job.Task.FailReason != "" {
		response.Error = &dto.AsyncTaskError{Phase: job.ErrorPhase, Code: job.ErrorCode, Message: job.Task.FailReason}
	}
	return response
}

func parseTaskProgress(raw string) int {
	value, _ := strconv.Atoi(strings.TrimSuffix(raw, "%"))
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func ownedAsyncJob(c *gin.Context) *model.AsyncJob {
	publicID := c.Param("task_id")
	job, err := model.GetAsyncJobByPublicTaskID(c.Request.Context(), publicID, c.GetInt("token_id"))
	if err != nil {
		logger.LogError(c, "query async task failed: "+err.Error())
		respondAsyncError(c, http.StatusInternalServerError, "query_task_failed", "failed to query async task")
		return nil
	}
	if job == nil {
		respondAsyncError(c, http.StatusNotFound, "task_not_found", "async task was not found")
		return nil
	}
	return job
}

func GetAsyncTaskResult(c *gin.Context) {
	job := ownedAsyncJob(c)
	if job == nil {
		return
	}
	switch job.ExecutionStatus {
	case model.AsyncStatusFailure:
		respondAsyncError(c, http.StatusUnprocessableEntity, defaultString(job.ErrorCode, "task_failed"), defaultString(job.Task.FailReason, "async task failed"))
		return
	case model.AsyncStatusUncertain:
		respondAsyncError(c, http.StatusConflict, defaultString(job.ErrorCode, "task_uncertain"), "the upstream request may have executed; automatic retry is unsafe")
		return
	case model.AsyncStatusCancelled:
		respondAsyncError(c, http.StatusConflict, "task_cancelled", "async task was cancelled before execution")
		return
	case model.AsyncStatusSuccess:
		// continue below
	default:
		respondAsyncError(c, http.StatusConflict, "task_not_ready", "async task is "+asyncStatusText(job.ExecutionStatus))
		return
	}

	artifacts, err := model.ListArtifactsByTaskID(c.Request.Context(), job.TaskID)
	if err != nil {
		respondAsyncError(c, http.StatusInternalServerError, "artifact_query_failed", "failed to query task artifacts")
		return
	}
	for _, artifact := range artifacts {
		if artifact.ExpiresAt <= time.Now().Unix() {
			respondAsyncError(c, http.StatusGone, "result_expired", "async task result has expired")
			return
		}
	}
	if len(artifacts) == 0 && len(job.ResultPayload) == 0 {
		respondAsyncError(c, http.StatusGone, "result_expired", "async task result has expired")
		return
	}
	store, err := newAsyncArtifactStore(c.Request.Context())
	if err != nil {
		respondAsyncError(c, http.StatusServiceUnavailable, "artifact_store_unavailable", "artifact store is unavailable")
		return
	}
	ttl := time.Duration(common.GetEnvOrDefault("ASYNC_SIGNED_URL_TTL_SECONDS", 900)) * time.Second
	artifactResponses := make([]dto.AsyncArtifactResponse, 0, len(artifacts))
	signedURLs := make([]string, 0, len(artifacts))
	for _, artifact := range artifacts {
		signedURL, signErr := store.SignedURL(c.Request.Context(), artifact.ObjectKey, ttl)
		if signErr != nil {
			respondAsyncError(c, http.StatusServiceUnavailable, "artifact_sign_failed", "failed to create artifact download URL")
			return
		}
		signedURLs = append(signedURLs, signedURL)
		artifactResponses = append(artifactResponses, dto.AsyncArtifactResponse{
			ContentType: artifact.ContentType,
			SizeBytes:   artifact.SizeBytes,
			SHA256:      artifact.SHA256,
			ExpiresAt:   artifact.ExpiresAt,
			URL:         signedURL,
		})
	}
	upstreamResponse := json.RawMessage(job.ResultPayload)
	normalized := normalizedAsyncImageResponse(upstreamResponse, signedURLs)
	if c.Query("include_upstream") == "false" {
		upstreamResponse = nil
	}
	c.JSON(http.StatusOK, dto.AsyncTaskResultResponse{
		ID:               job.Task.TaskID,
		Status:           asyncStatusText(job.ExecutionStatus),
		Response:         normalized,
		UpstreamResponse: upstreamResponse,
		Artifacts:        artifactResponses,
	})
}

func normalizedAsyncImageResponse(raw json.RawMessage, signedURLs []string) json.RawMessage {
	var response map[string]any
	if err := common.Unmarshal(raw, &response); err != nil {
		return raw
	}
	data, ok := response["data"].([]any)
	if ok {
		for index, value := range data {
			if index >= len(signedURLs) {
				break
			}
			if item, ok := value.(map[string]any); ok {
				item["url"] = signedURLs[index]
				delete(item, "b64_json")
			}
		}
	} else if len(signedURLs) > 0 {
		data = make([]any, 0, len(signedURLs))
		for _, signedURL := range signedURLs {
			data = append(data, map[string]any{"url": signedURL})
		}
		response = map[string]any{"data": data}
	}
	encoded, err := common.Marshal(response)
	if err != nil {
		return raw
	}
	return encoded
}

func CancelAsyncTask(c *gin.Context) {
	job := ownedAsyncJob(c)
	if job == nil {
		return
	}
	if job.ExecutionStatus == model.AsyncStatusRunning {
		respondAsyncError(c, http.StatusConflict, "upstream_cancel_unsupported", "the upstream has no cancellation API; the running request was not interrupted")
		return
	}
	if job.ExecutionStatus != model.AsyncStatusQueued {
		c.JSON(http.StatusOK, asyncTaskStatusResponse(job))
		return
	}
	cancelled, changed, err := model.CancelQueuedAsyncJob(c.Request.Context(), job.Task.TaskID, c.GetInt("token_id"))
	if err != nil {
		respondAsyncError(c, http.StatusInternalServerError, "cancel_task_failed", "failed to cancel async task")
		return
	}
	if !changed {
		latest := ownedAsyncJob(c)
		if latest != nil {
			c.JSON(http.StatusOK, asyncTaskStatusResponse(latest))
		}
		return
	}
	if _, err := model.RefundAsyncJobBilling(c.Request.Context(), cancelled.ID); err != nil {
		logger.LogError(c, fmt.Sprintf("refund cancelled async task %s failed: %v", cancelled.Task.TaskID, err))
		respondAsyncError(c, http.StatusInternalServerError, "refund_failed", "task was cancelled but quota refund is pending reconciliation")
		return
	}
	refreshed, err := model.GetAsyncJobByPublicTaskID(c.Request.Context(), cancelled.Task.TaskID, c.GetInt("token_id"))
	if err != nil || refreshed == nil {
		respondAsyncError(c, http.StatusInternalServerError, "query_task_failed", "task was cancelled but its final state could not be loaded")
		return
	}
	c.JSON(http.StatusOK, asyncTaskStatusResponse(refreshed))
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
