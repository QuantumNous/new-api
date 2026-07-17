package image_stream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	asyncImageBatchSize             = 64
	asyncImageMaxConcurrency        = 16
	asyncImageWebhookBatch          = 100
	asyncImageWebhookAttempts       = 5
	asyncImageWebhookLease          = 5 * time.Minute
	asyncImageUpstreamTimeout       = 5 * time.Minute
	asyncImageUploadTimeout         = 5 * time.Minute
	asyncImageReservationStaleAfter = 5 * time.Minute
	asyncImageWorkerStaleAfter      = 20 * time.Minute
	asyncImageProviderAttempts      = 6
	asyncImageDownloadAttempts      = 6
	asyncImageUploadAttempts        = 6
	asyncImageWorkerAttempts        = 6
)

const ContextKeyAsyncImageSubmitted = "async_image_submitted"

var sendAsyncImageWebhook = service.SendJSONWebhookWithDeliveryID

type asyncImageRunResult struct {
	Completed         int `json:"completed"`
	Failed            int `json:"failed"`
	WebhooksDelivered int `json:"webhooks_delivered"`
	WebhooksRetried   int `json:"webhooks_retried"`
}

type asyncImageTaskPayload struct {
	Version           int                        `json:"version,omitempty"`
	Executor          string                     `json:"executor,omitempty"`
	Request           *dto.ImageRequest          `json:"request"`
	RequestExtra      map[string]json.RawMessage `json:"request_extra,omitempty"`
	PreparedRequest   *PreparedAsyncImageRequest `json:"prepared_request,omitempty"`
	ChannelBaseURL    string                     `json:"channel_base_url,omitempty"`
	ChannelProxy      string                     `json:"channel_proxy,omitempty"`
	ChannelType       int                        `json:"channel_type,omitempty"`
	ChannelCreateTime int64                      `json:"channel_create_time,omitempty"`
	ProviderStored    bool                       `json:"provider_response_stored,omitempty"`
	ArtifactStored    bool                       `json:"artifact_stored,omitempty"`
	// Upstream is read only for tasks checkpointed by earlier versions. New
	// tasks never persist image base64 in the task row.
	Upstream *UpstreamResponse `json:"upstream,omitempty"`
}

type genericImageArtifact struct {
	Response    *dto.ImageResponse `json:"response"`
	Usage       *dto.Usage         `json:"usage,omitempty"`
	OtherRatios map[string]float64 `json:"other_ratios,omitempty"`
}

type genericStoredImageEnvelope struct {
	Created int64           `json:"created"`
	Data    []dto.ImageData `json:"data"`
	Usage   *dto.Usage      `json:"usage,omitempty"`
}

const (
	asyncImageRouteSnapshotVersion = 3
	asyncImagePayloadVersion       = 4
	AsyncImageExecutorResponses    = "responses_sse"
	AsyncImageExecutorAdaptor      = "adaptor"
)

// PreparedAsyncImageRequest is the provider-facing request captured after
// model mapping, provider conversion and parameter overrides. Keeping this
// exact body makes background execution deterministic and avoids losing
// ImageRequest.Extra during JSON persistence.
type PreparedAsyncImageRequest struct {
	Body                 []byte                    `json:"body"`
	ContentType          string                    `json:"content_type,omitempty"`
	ClientHeaders        map[string]string         `json:"client_headers,omitempty"`
	RequestURLPath       string                    `json:"request_url_path,omitempty"`
	ChannelBaseURL       string                    `json:"channel_base_url,omitempty"`
	APIType              int                       `json:"api_type"`
	ChannelType          int                       `json:"channel_type"`
	ChannelCreateTime    int64                     `json:"channel_create_time,omitempty"`
	ConfigurationStored  bool                      `json:"configuration_stored,omitempty"`
	APIVersion           string                    `json:"api_version,omitempty"`
	Organization         string                    `json:"organization,omitempty"`
	HeadersOverride      map[string]interface{}    `json:"headers_override,omitempty"`
	ChannelSetting       *dto.ChannelSettings      `json:"channel_setting,omitempty"`
	ChannelOtherSettings *dto.ChannelOtherSettings `json:"channel_other_settings,omitempty"`
	AdvancedRoute        *dto.AdvancedCustomRoute  `json:"advanced_route,omitempty"`
}

type asyncImageUpstreamError struct {
	statusCode int
	err        error
}

func (e *asyncImageUpstreamError) Error() string { return e.err.Error() }

func (e *asyncImageUpstreamError) Unwrap() error { return e.err }

type asyncImageSystemTaskHandler struct{}

func (asyncImageSystemTaskHandler) Type() string { return model.SystemTaskTypeAsyncImage }

func (asyncImageSystemTaskHandler) Enabled() bool {
	return model.HasPendingImageWork(time.Now().Add(-asyncImageWorkerStaleAfter).Unix()) ||
		model.HasStaleImageBillingReservations(time.Now().Add(-asyncImageReservationStaleAfter).Unix()) ||
		model.HasDueImageTaskBillingLogOutbox(common.GetTimestamp())
}

func (asyncImageSystemTaskHandler) Interval() time.Duration { return 15 * time.Second }

func (asyncImageSystemTaskHandler) NewPayload() any { return nil }

func (asyncImageSystemTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	result, err := runAsyncImageWork(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return
		}
		if finishErr := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, result, err.Error()); finishErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("async image system task finish failed: %v", finishErr))
		}
		return
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("async image system task finish failed: %v", err))
	}
}

func init() {
	service.RegisterSystemTaskHandler(asyncImageSystemTaskHandler{})
}

func SubmitAsyncImage(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ImageRequest, prepared ...*PreparedAsyncImageRequest) *types.NewAPIError {
	if info == nil || req == nil {
		return types.NewErrorWithStatusCode(errors.New("async image request is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if err := validateAsyncImageRequest(req); err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if !LoadR2Config().Enabled() {
		return types.NewErrorWithStatusCode(
			errors.New("async image generation requires CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, and CLOUDFLARE_R2_PUBLIC_BASE"),
			types.ErrorCodeInvalidRequest,
			http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry(),
		)
	}

	req.WebhookURL = strings.TrimSpace(req.WebhookURL)
	if len(req.WebhookURL) > 2048 {
		return types.NewErrorWithStatusCode(errors.New("webhook_url is too long"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if len(req.WebhookSecret) > 512 {
		return types.NewErrorWithStatusCode(errors.New("webhook_secret is too long"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if req.WebhookURL == "" && req.WebhookSecret != "" {
		return types.NewErrorWithStatusCode(errors.New("webhook_url is required when webhook_secret is set"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if req.WebhookURL != "" {
		if err := service.ValidateJSONWebhookURL(req.WebhookURL); err != nil {
			return types.NewErrorWithStatusCode(fmt.Errorf("invalid webhook_url: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}

	expectedQuota := info.PriceData.QuotaToPreConsume
	if expectedQuota < 0 || expectedQuota > common.MaxQuota {
		return types.NewError(errors.New("async image quota is out of range"), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}

	identityRequest := req
	if originalRequest, ok := info.Request.(*dto.ImageRequest); ok {
		identityRequest = originalRequest
	}
	clientRequestID, clientRequestHash, err := asyncImageIdempotency(c, identityRequest)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if clientRequestID != nil {
		existing, exists, err := model.GetImageTaskByClientRequestID(info.UserId, *clientRequestID)
		if err != nil {
			return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
		if exists {
			return replayAsyncImageTask(c, info, existing, clientRequestHash)
		}
	}

	task := model.InitTask(constant.TaskPlatformOpenAIImage, info)
	// Async image workers reselect the submitted channel key by HMAC. The raw
	// Gemini/Vertex key populated by the generic task initializer is not needed.
	task.PrivateData.Key = ""
	task.ClientRequestID = clientRequestID
	task.Action = constant.TaskActionGenerate
	task.Status = model.TaskStatusReserving
	task.Quota = expectedQuota
	task.PrivateData.TokenId = info.TokenId
	task.PrivateData.TokenBillingEnabled = expectedQuota > 0 && !info.IsPlayground && info.TokenId > 0
	task.PrivateData.NodeName = common.NodeName
	task.PrivateData.ClientRequestHash = clientRequestHash
	task.PrivateData.ChannelMultiKeyIndex = info.ChannelMultiKeyIndex
	if info.ApiKey != "" {
		task.PrivateData.ChannelKeyHash = common.GenerateHMAC(info.ApiKey)
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice:           info.PriceData.ModelPrice,
		GroupRatio:           info.PriceData.GroupRatioInfo.GroupRatio,
		ModelRatio:           info.PriceData.ModelRatio,
		CompletionRatio:      info.PriceData.CompletionRatio,
		CacheRatio:           info.PriceData.CacheRatio,
		CacheCreationRatio:   info.PriceData.CacheCreationRatio,
		CacheCreation5mRatio: info.PriceData.CacheCreation5mRatio,
		CacheCreation1hRatio: info.PriceData.CacheCreation1hRatio,
		ImageRatio:           info.PriceData.ImageRatio,
		UsePrice:             info.PriceData.UsePrice,
		OtherRatios:          info.PriceData.OtherRatios(),
		OriginModelName:      info.OriginModelName,
		PerCallBilling:       common.StringsContains(constant.TaskPricePatches, info.OriginModelName) || info.PriceData.UsePrice,
	}
	if info.TieredBillingSnapshot != nil {
		snapshot := *info.TieredBillingSnapshot
		task.PrivateData.BillingContext.TieredBillingSnapshot = &snapshot
	}
	if info.BillingRequestInput != nil {
		requestInput := *info.BillingRequestInput
		requestInput.Body, err = sanitizeAsyncBillingRequestBody(info.BillingRequestInput.Body)
		if err != nil {
			return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
		requestInput.Headers = make(map[string]string, len(info.BillingRequestInput.Headers))
		for key, value := range info.BillingRequestInput.Headers {
			if common.IsSensitiveHeaderName(key) {
				continue
			}
			requestInput.Headers[key] = value
		}
		task.PrivateData.BillingContext.BillingRequestInput = &requestInput
	}
	executor := AsyncImageExecutorResponses
	var preparedRequest *PreparedAsyncImageRequest
	if len(prepared) > 0 && prepared[0] != nil {
		executor = AsyncImageExecutorAdaptor
		preparedCopy := *prepared[0]
		preparedCopy.Body = append([]byte(nil), prepared[0].Body...)
		preparedCopy.ClientHeaders = copyAsyncImageHeaders(prepared[0].ClientHeaders)
		// Egress configuration can contain proxy credentials, static auth headers,
		// or advanced-route secrets. Resolve those from the current channel only
		// when the worker executes instead of duplicating them in task rows.
		preparedCopy.ChannelBaseURL = ""
		preparedCopy.HeadersOverride = copySafeAsyncImageHeaderOverrides(prepared[0].HeadersOverride)
		if prepared[0].ChannelSetting != nil {
			channelSetting := *prepared[0].ChannelSetting
			channelSetting.Proxy = ""
			preparedCopy.ChannelSetting = &channelSetting
		}
		if prepared[0].ChannelOtherSettings != nil {
			channelOtherSettings := *prepared[0].ChannelOtherSettings
			channelOtherSettings.AdvancedCustom = nil
			preparedCopy.ChannelOtherSettings = &channelOtherSettings
		}
		if prepared[0].AdvancedRoute != nil {
			advancedRoute := *prepared[0].AdvancedRoute
			advancedRoute.Models = append([]string(nil), prepared[0].AdvancedRoute.Models...)
			advancedRoute.Auth = nil
			preparedCopy.AdvancedRoute = &advancedRoute
		}
		preparedRequest = &preparedCopy
	}
	payload := asyncImageTaskPayload{
		Version:         asyncImagePayloadVersion,
		Executor:        executor,
		Request:         persistedAsyncImageRequest(req),
		RequestExtra:    copyAsyncImageExtra(req.Extra),
		PreparedRequest: preparedRequest,
	}
	if info.ChannelMeta != nil {
		// The Responses executor also resolves base URL and proxy from the current
		// channel. Proxy URLs may embed usernames and passwords.
		payload.ChannelBaseURL = ""
		payload.ChannelProxy = ""
		payload.ChannelType = info.ChannelType
		payload.ChannelCreateTime = info.ChannelCreateTime
	}
	task.SetCheckpointData(payload)

	var webhook *model.TaskWebhook
	if req.WebhookURL != "" {
		webhook = &model.TaskWebhook{
			URL:    req.WebhookURL,
			Secret: req.WebhookSecret,
		}
	}
	reservation := &model.ImageBillingReservation{
		TaskID:        task.TaskID,
		RequestID:     info.RequestId,
		UserID:        info.UserId,
		TokenID:       info.TokenId,
		TokenRequired: task.PrivateData.TokenBillingEnabled,
		ExpectedQuota: expectedQuota,
	}
	if err := model.InsertPreparedImageTask(task, webhook, reservation); err != nil {
		if clientRequestID != nil {
			existing, exists, lookupErr := model.GetImageTaskByClientRequestID(info.UserId, *clientRequestID)
			if lookupErr == nil && exists {
				return replayAsyncImageTask(c, info, existing, clientRequestHash)
			}
			if lookupErr != nil {
				return types.NewError(lookupErr, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
			}
		}
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}

	info.BillingReservationTaskID = task.TaskID
	if info.TaskRelayInfo != nil {
		info.Action = constant.TaskActionGenerate
	}
	if !info.PriceData.FreeModel {
		if apiErr := service.PreConsumeBilling(c, expectedQuota, info); apiErr != nil {
			refundPreparedAsyncImageSubmission(c, info, task.TaskID, apiErr.Error())
			return apiErr
		}
	}

	task.Quota = info.FinalPreConsumedQuota
	task.PrivateData.BillingSource = info.BillingSource
	task.PrivateData.SubscriptionId = info.SubscriptionId
	task.PrivateData.TokenPreConsumed = info.FinalPreConsumedQuota
	activated, err := model.ActivatePreparedImageTask(task)
	if err != nil {
		refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	if !activated {
		// Another request can only reach this branch after the durable activation
		// already committed. Do not turn a runnable, paid task into an API error.
		task.Status = model.TaskStatusNotStart
		task.Progress = "0%"
	}

	if err := service.SettleBilling(c, info, task.Quota); err != nil {
		common.SysError("settle async image billing error: " + err.Error())
	}

	if _, _, err := service.EnqueueSystemTask(model.SystemTaskTypeAsyncImage, nil); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("enqueue async image system task failed: task=%s err=%v", task.TaskID, err))
	}

	writeAcceptedImageTask(c, task)
	return nil
}

func refundPreparedAsyncImageSubmission(c *gin.Context, info *relaycommon.RelayInfo, taskID string, reason string) {
	reason = common.MaskSensitiveInfo(reason)
	if len(reason) > 2000 {
		reason = reason[:2000]
	}
	if info != nil && info.Billing != nil {
		info.Billing.Refund(c)
	}
	if _, err := model.RefundImageBillingReservation(taskID, reason); err != nil {
		common.SysError(fmt.Sprintf("refund prepared async image task %s: %v", taskID, err))
	}
}

func sanitizeAsyncBillingRequestBody(body []byte) ([]byte, error) {
	if len(body) == 0 {
		return nil, nil
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(body, &fields); err != nil {
		return nil, fmt.Errorf("invalid async image billing request: %w", err)
	}
	if _, _, err := asyncImagePassThroughCountFields(fields); err != nil {
		return nil, err
	}
	delete(fields, "async")
	delete(fields, "webhook_url")
	delete(fields, "webhook_secret")
	return common.Marshal(fields)
}

// SanitizeAsyncImageRequestBody removes gateway-only delivery controls before
// a pass-through request is persisted or sent to a provider.
func SanitizeAsyncImageRequestBody(body []byte) ([]byte, error) {
	return sanitizeAsyncBillingRequestBody(body)
}

// AsyncImagePassThroughCount extracts provider-specific image count fields
// that bypass dto.ImageRequest.N when pass-through mode is enabled.
func AsyncImagePassThroughCount(body []byte) (int, bool, error) {
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(body, &fields); err != nil {
		return 0, false, fmt.Errorf("invalid async image request: %w", err)
	}
	return asyncImagePassThroughCountFields(fields)
}

func asyncImagePassThroughCountFields(fields map[string]json.RawMessage) (int, bool, error) {
	type countLocation struct {
		container string
		key       string
	}
	locations := []countLocation{
		{key: "n"},
		{key: "batch_size"},
		{key: "num_outputs"},
		{container: "parameters", key: "n"},
		{container: "parameters", key: "sampleCount"},
		{container: "parameters", key: "sample_count"},
		{container: "input", key: "num_outputs"},
		{container: "input", key: "n"},
	}
	selectedCount := 0
	foundCount := false
	for _, location := range locations {
		container := fields
		path := location.key
		if location.container != "" {
			rawContainer, ok := fields[location.container]
			if !ok {
				continue
			}
			if err := common.Unmarshal(rawContainer, &container); err != nil {
				return 0, false, fmt.Errorf("%s must be an object", location.container)
			}
			path = location.container + "." + location.key
		}
		rawCount, ok := container[location.key]
		if !ok {
			continue
		}
		countText := strings.TrimSpace(string(rawCount))
		count, err := strconv.ParseUint(countText, 10, 64)
		if err != nil || count == 0 || count > dto.MaxImageN {
			return 0, false, fmt.Errorf("%s must be an integer between 1 and %d", path, dto.MaxImageN)
		}
		if !foundCount || int(count) > selectedCount {
			selectedCount = int(count)
		}
		foundCount = true
	}
	return selectedCount, foundCount, nil
}

func persistedAsyncImageRequest(req *dto.ImageRequest) *dto.ImageRequest {
	if req == nil {
		return nil
	}
	persisted := *req
	persisted.Async = nil
	persisted.WebhookURL = ""
	persisted.WebhookSecret = ""
	persisted.Extra = nil
	return &persisted
}

func copyAsyncImageExtra(extra map[string]json.RawMessage) map[string]json.RawMessage {
	if len(extra) == 0 {
		return nil
	}
	copied := make(map[string]json.RawMessage, len(extra))
	for key, value := range extra {
		copied[key] = append(json.RawMessage(nil), value...)
	}
	return copied
}

func copyAsyncImageHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	copied := make(map[string]string, len(headers))
	for key, value := range headers {
		if common.IsSensitiveHeaderName(key) {
			continue
		}
		copied[key] = value
	}
	return copied
}

// TryReplayAsyncImageTask handles an accepted idempotent request before strict
// quota checks and channel selection. This lets a client recover the original
// task ID even when that task consumed the token's final quota.
func TryReplayAsyncImageTask(c *gin.Context, userID int, req *dto.ImageRequest) (bool, *types.NewAPIError) {
	clientRequestID, requestHash, err := asyncImageIdempotency(c, req)
	if err != nil {
		return true, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if clientRequestID == nil {
		return false, nil
	}
	task, exists, err := model.GetImageTaskByClientRequestID(userID, *clientRequestID)
	if err != nil {
		return true, types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	if !exists {
		return false, nil
	}
	if apiErr := writeReplayedAsyncImageTask(c, task, requestHash); apiErr != nil {
		return true, apiErr
	}
	return true, nil
}

func asyncImageIdempotency(c *gin.Context, req *dto.ImageRequest) (*string, string, error) {
	if c == nil || req == nil {
		return nil, "", errors.New("async image request is required")
	}
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if len(idempotencyKey) > 256 {
		return nil, "", errors.New("Idempotency-Key is too long")
	}
	if idempotencyKey == "" {
		return nil, "", nil
	}
	requestIdentity, err := common.Marshal(struct {
		Request       *dto.ImageRequest          `json:"request"`
		Extra         map[string]json.RawMessage `json:"extra,omitempty"`
		WebhookURL    string                     `json:"webhook_url,omitempty"`
		WebhookSecret string                     `json:"webhook_secret,omitempty"`
	}{
		Request:       canonicalAsyncImageRequest(req),
		Extra:         req.Extra,
		WebhookURL:    strings.TrimSpace(req.WebhookURL),
		WebhookSecret: req.WebhookSecret,
	})
	if err != nil {
		return nil, "", err
	}
	hashedID := sha256HexBytes([]byte(idempotencyKey))
	return &hashedID, sha256HexBytes(requestIdentity), nil
}

func canonicalAsyncImageRequest(req *dto.ImageRequest) *dto.ImageRequest {
	canonical := *req
	canonical.Extra = nil
	if canonical.N == nil || *canonical.N == 0 {
		canonical.N = common.GetPointer(uint(1))
	}
	if canonical.Model == "gpt-image-1" && canonical.Quality == "" {
		canonical.Quality = "auto"
	}
	return &canonical
}

func replayAsyncImageTask(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task, requestHash string) *types.NewAPIError {
	if err := service.SettleBilling(c, info, 0); err != nil {
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	return writeReplayedAsyncImageTask(c, task, requestHash)
}

func writeReplayedAsyncImageTask(c *gin.Context, task *model.Task, requestHash string) *types.NewAPIError {
	if task.PrivateData.ClientRequestHash != "" && task.PrivateData.ClientRequestHash != requestHash {
		return types.NewErrorWithStatusCode(
			errors.New("Idempotency-Key was already used with a different request"),
			types.ErrorCodeInvalidRequest,
			http.StatusConflict,
			types.ErrOptionWithSkipRetry(),
		)
	}
	c.Header("Idempotency-Replayed", "true")
	if task.Status == model.TaskStatusReserving {
		c.Header("Retry-After", "2")
		return types.NewErrorWithStatusCode(
			errors.New("image submission is still being prepared; retry with the same Idempotency-Key"),
			types.ErrorCodeInvalidRequest,
			http.StatusConflict,
			types.ErrOptionWithSkipRetry(),
		)
	}
	writeAcceptedImageTask(c, task)
	return nil
}

func writeAcceptedImageTask(c *gin.Context, task *model.Task) {
	c.Header("Location", "/v1/images/generations/"+task.TaskID)
	c.Header("Retry-After", "2")
	c.Set(ContextKeyAsyncImageSubmitted, true)
	c.JSON(http.StatusAccepted, BuildImageTaskResponse(task))
}

func validateAsyncImageRequest(req *dto.ImageRequest) error {
	if strings.TrimSpace(req.Prompt) == "" {
		return errors.New("prompt is required")
	}
	if req.Stream != nil && *req.Stream {
		return errors.New("stream=true is not supported for asynchronous image generation")
	}
	if req.N != nil && (*req.N == 0 || *req.N > dto.MaxImageN) {
		return fmt.Errorf("n must be an integer between 1 and %d", dto.MaxImageN)
	}
	return nil
}

func runAsyncImageWork(ctx context.Context) (result asyncImageRunResult, runErr error) {
	if _, _, err := model.DrainDueImageTaskBillingLogOutbox(asyncImageWebhookBatch); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("drain image billing log outbox: %s", common.MaskSensitiveInfo(err.Error())))
	}
	recoveredReservations, err := model.RecoverStaleImageBillingReservations(
		time.Now().Add(-asyncImageReservationStaleAfter).Unix(),
		asyncImageBatchSize,
		"async image submission did not complete",
	)
	result.Failed += recoveredReservations
	if err != nil {
		return result, fmt.Errorf("recover stale image billing reservations: %w", err)
	}

	recoveredCompleted, recoveredFailed, err := recoverFinalizingImageTasks(ctx)
	result.Completed += recoveredCompleted
	result.Failed += recoveredFailed
	if err != nil {
		return result, err
	}
	if err := model.RequeueStaleInProgressImageTasks(
		time.Now().Add(-asyncImageWorkerStaleAfter).Unix(),
		common.GetTimestamp(),
	); err != nil {
		return result, fmt.Errorf("requeue image tasks: %w", err)
	}
	type webhookRunResult struct {
		delivered int
		retried   int
		err       error
	}
	webhookTrigger := make(chan struct{}, 1)
	webhookResult := make(chan webhookRunResult, 1)
	go func() {
		combined := webhookRunResult{}
		for range webhookTrigger {
			delivered, retried, err := deliverDueImageWebhooks(ctx)
			combined.delivered += delivered
			combined.retried += retried
			if combined.err == nil && err != nil {
				combined.err = err
			}
		}
		webhookResult <- combined
	}()
	webhookTrigger <- struct{}{}
	defer func() {
		close(webhookTrigger)
		webhooks := <-webhookResult
		result.WebhooksDelivered += webhooks.delivered
		result.WebhooksRetried += webhooks.retried
		if runErr == nil && webhooks.err != nil {
			runErr = webhooks.err
		}
	}()
	concurrency := common.GetEnvOrDefault("ASYNC_IMAGE_CONCURRENCY", 4)
	if concurrency < 1 {
		concurrency = 1
	}
	if concurrency > asyncImageMaxConcurrency {
		concurrency = asyncImageMaxConcurrency
	}

	for {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		tasks, err := model.FindPendingImageTasks(concurrency)
		if err != nil {
			return result, fmt.Errorf("find pending image tasks: %w", err)
		}
		if len(tasks) == 0 {
			break
		}

		claimedTasks := make([]*model.Task, 0, len(tasks))
		for _, task := range tasks {
			if err := ctx.Err(); err != nil {
				return result, err
			}
			claimed, err := model.ClaimImageTask(task, common.GetTimestamp())
			if err != nil {
				return result, fmt.Errorf("claim image task %s: %w", task.TaskID, err)
			}
			if !claimed {
				continue
			}
			claimedTasks = append(claimedTasks, task)
		}

		var wg sync.WaitGroup
		semaphore := make(chan struct{}, concurrency)
		errorsCh := make(chan error, len(claimedTasks))
		outcomes := make(chan bool, len(claimedTasks))
		for _, task := range claimedTasks {
			semaphore <- struct{}{}
			wg.Add(1)
			go func(imageTask *model.Task) {
				defer wg.Done()
				defer func() { <-semaphore }()
				completed, err := executeAsyncImageTask(ctx, imageTask)
				if err != nil {
					if errors.Is(err, errAsyncImageRetryScheduled) {
						return
					}
					if ctx.Err() != nil {
						errorsCh <- err
						return
					}
					message := common.MaskSensitiveInfo(err.Error())
					if len(message) > 2000 {
						message = message[:2000]
					}
					if imageTask.Status == model.TaskStatusFinalizing {
						delay := asyncImageRetryDelay(imageTask.FinalizeAttempts)
						if scheduleErr := model.MarkImageTaskFinalizationRetry(imageTask, time.Now().Add(delay).Unix(), message); scheduleErr != nil {
							errorsCh <- fmt.Errorf("schedule image task finalization retry %s: %w", imageTask.TaskID, scheduleErr)
						}
						return
					}
					if imageTask.WorkerAttempts+1 >= asyncImageWorkerAttempts {
						if failErr := failAsyncImageTask(ctx, imageTask, fmt.Errorf("image worker exhausted retries: %w", err)); failErr != nil {
							if imageTask.Status == model.TaskStatusFinalizing {
								delay := asyncImageRetryDelay(imageTask.FinalizeAttempts)
								if scheduleErr := model.MarkImageTaskFinalizationRetry(imageTask, time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(failErr.Error())); scheduleErr == nil {
									return
								}
							}
							errorsCh <- failErr
							return
						}
						outcomes <- false
						return
					}
					delay := asyncImageRetryDelay(imageTask.WorkerAttempts)
					scheduled, scheduleErr := imageTask.MarkImageWorkerRetry(time.Now().Add(delay).Unix(), message)
					if scheduleErr != nil {
						errorsCh <- fmt.Errorf("schedule image worker retry for task %s: %w", imageTask.TaskID, scheduleErr)
						return
					}
					if scheduled {
						logger.LogWarn(ctx, fmt.Sprintf("image worker deferred after unexpected error: task=%s retry=%s err=%s", imageTask.TaskID, delay, message))
					}
					return
				}
				outcomes <- completed
			}(task)
		}
		wg.Wait()
		close(errorsCh)
		close(outcomes)
		for completed := range outcomes {
			if completed {
				result.Completed++
			} else {
				result.Failed++
			}
		}
		select {
		case webhookTrigger <- struct{}{}:
		default:
		}
		for err := range errorsCh {
			return result, err
		}

	}
	return result, nil
}

func recoverFinalizingImageTasks(ctx context.Context) (int, int, error) {
	completed := 0
	failed := 0
	for {
		if err := ctx.Err(); err != nil {
			return completed, failed, err
		}
		tasks, err := model.FindFinalizingImageTasks(asyncImageBatchSize)
		if err != nil {
			return completed, failed, fmt.Errorf("find finalizing image tasks: %w", err)
		}
		if len(tasks) == 0 {
			return completed, failed, nil
		}
		for _, task := range tasks {
			finalized, err := finalizePersistedImageTask(ctx, task.TaskID)
			if err != nil {
				if permanent, ok := model.IsPermanentImageTaskFinalizationError(err); ok {
					if !permanent.BillingDBApplied {
						compensated, compensateErr := model.CompensatePermanentImageTaskFinalization(task.TaskID, common.MaskSensitiveInfo(err.Error()))
						if compensateErr == nil && compensated != nil {
							failed++
							if logErr := model.DeliverImageTaskBillingLogOutbox(task.TaskID); logErr != nil {
								logger.LogWarn(ctx, fmt.Sprintf("permanent image billing refund log deferred: task=%s err=%s", task.TaskID, common.MaskSensitiveInfo(logErr.Error())))
							}
							continue
						}
						if compensateErr != nil {
							err = fmt.Errorf("compensate permanent image task %s: %w", task.TaskID, compensateErr)
						}
					}
					if permanent.BillingDBApplied {
						message := common.MaskSensitiveInfo(err.Error())
						if len(message) > 2000 {
							message = message[:2000]
						}
						if markErr := model.MarkImageTaskFinalizationRetry(task, time.Now().Add(6*time.Hour).Unix(), message); markErr != nil {
							return completed, failed, fmt.Errorf("quarantine image task finalization %s: %w", task.TaskID, markErr)
						}
						logger.LogError(ctx, fmt.Sprintf("image task requires billing reconciliation: task=%s err=%s", task.TaskID, message))
						continue
					}
				}
				retryShift := task.FinalizeAttempts
				if retryShift > 6 {
					retryShift = 6
				}
				delay := 15 * time.Second * time.Duration(1<<retryShift)
				message := common.MaskSensitiveInfo(err.Error())
				if len(message) > 2000 {
					message = message[:2000]
				}
				if markErr := model.MarkImageTaskFinalizationRetry(task, time.Now().Add(delay).Unix(), message); markErr != nil {
					return completed, failed, fmt.Errorf("schedule image task finalization retry %s: %w", task.TaskID, markErr)
				}
				logger.LogWarn(ctx, fmt.Sprintf("image task finalization deferred: task=%s retry=%s err=%s", task.TaskID, delay, message))
				continue
			}
			if finalized == nil {
				continue
			}
			switch finalized.Status {
			case model.TaskStatusSuccess:
				completed++
			case model.TaskStatusFailure:
				failed++
			}
		}
	}
}

func finalizePersistedImageTask(ctx context.Context, taskID string) (*model.Task, error) {
	finalization, err := model.FinalizeImageTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("finalize image task %s: %w", taskID, err)
	}
	if finalization == nil || finalization.Task == nil {
		return nil, fmt.Errorf("finalize image task %s returned no task", taskID)
	}
	if finalization.Applied {
		if err := model.DeliverImageTaskBillingLogOutbox(taskID); err != nil {
			// The terminal task and its outbox are durable. A log-database outage
			// must not reopen/refund the task; the system-task drain retries it.
			logger.LogWarn(ctx, fmt.Sprintf("async image billing log deferred: task=%s err=%s", taskID, common.MaskSensitiveInfo(err.Error())))
		}
	}
	return finalization.Task, nil
}

func executeAsyncImageTask(ctx context.Context, task *model.Task) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	checkpoint := task.CheckpointData
	if len(checkpoint) == 0 {
		checkpoint = task.Data
	}
	payload, err := decodeAsyncImageTaskPayload(checkpoint)
	if err != nil {
		return false, failAsyncImageTask(ctx, task, fmt.Errorf("decode image request: %w", err))
	}
	request := payload.Request
	if request == nil {
		return false, failAsyncImageTask(ctx, task, errors.New("image request is missing"))
	}

	aggregated := payload.Upstream
	var genericArtifact *genericImageArtifact
	var genericUpstream *GenericImageUpstreamResponse
	if payload.ArtifactStored || payload.ProviderStored {
		artifact, err := model.LoadImageTaskArtifact(task.TaskID)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("load generated image artifact: %w", err))
		}
		if payload.Executor == AsyncImageExecutorAdaptor {
			if payload.ArtifactStored {
				genericArtifact = &genericImageArtifact{}
				if err := common.Unmarshal(artifact, genericArtifact); err != nil {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("decode generated image artifact: %w", err))
				}
			} else {
				genericUpstream = &GenericImageUpstreamResponse{}
				if err := common.Unmarshal(artifact, genericUpstream); err != nil {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("decode provider image response: %w", err))
				}
			}
		} else if aggregated == nil {
			aggregated = &UpstreamResponse{}
			if err := common.Unmarshal(artifact, aggregated); err != nil {
				return false, failAsyncImageTask(ctx, task, fmt.Errorf("decode generated image artifact: %w", err))
			}
		}
	}

	if payload.Executor == AsyncImageExecutorAdaptor && genericArtifact == nil {
		if payload.PreparedRequest == nil || len(payload.PreparedRequest.Body) == 0 {
			return false, failAsyncImageTask(ctx, task, errors.New("prepared provider image request is missing"))
		}
		channel, apiKey, err := loadAsyncImageChannel(task, payload.PreparedRequest, payload.ProviderStored)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, err)
		}
		genericInfo := genericAsyncImageRelayInfo(task, channel, apiKey, payload.PreparedRequest)
		attemptStart := time.Now()
		executionCtx, cancel := context.WithTimeout(ctx, asyncImageUpstreamTimeout)
		result, apiErr := ExecuteGenericImageAdaptor(executionCtx, &GenericImageExecutionRequest{
			RelayInfo:        genericInfo,
			ImageRequest:     request,
			PassThroughBody:  payload.PreparedRequest.Body,
			UpstreamResponse: genericUpstream,
			Checkpoint: func(providerResponse *GenericImageUpstreamResponse) error {
				if providerResponse == nil || len(providerResponse.Body) == 0 {
					return errors.New("provider image response is empty")
				}
				artifact, err := common.Marshal(providerResponse)
				if err != nil {
					return fmt.Errorf("encode provider image response: %w", err)
				}
				checkpointPayload := payload
				checkpointPayload.ProviderStored = true
				checkpointData, err := common.Marshal(checkpointPayload)
				if err != nil {
					return fmt.Errorf("encode provider image checkpoint: %w", err)
				}
				persisted, err := persistAsyncImageArtifact(executionCtx, task, checkpointData, artifact, "40%")
				if err != nil {
					return err
				}
				if !persisted {
					return errors.New("image task claim was lost before provider response checkpoint")
				}
				payload.ProviderStored = true
				genericUpstream = providerResponse
				return nil
			},
		})
		executionErr := executionCtx.Err()
		cancel()
		if apiErr != nil {
			if errors.Is(apiErr, ErrGenericImageCheckpoint) {
				if errors.Is(apiErr, model.ErrImageTaskArtifactTooLarge) {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("checkpoint provider response: %w", apiErr))
				}
				if task.ProviderAttempts+1 >= asyncImageProviderAttempts {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("provider image submission checkpoint exhausted retries: %w", apiErr))
				}
				delay := asyncImageRetryDelay(task.ProviderAttempts)
				scheduled, scheduleErr := task.MarkImageSubmissionRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(apiErr.Error()))
				if scheduleErr != nil {
					return false, fmt.Errorf("schedule provider image submission retry for task %s: %w", task.TaskID, scheduleErr)
				}
				if scheduled {
					logger.LogWarn(ctx, fmt.Sprintf("provider image submission deferred after checkpoint failure: task=%s retry=%s", task.TaskID, delay))
				}
				return false, errAsyncImageRetryScheduled
			}
			retryProvider := payload.ProviderStored && (executionErr != nil || errors.Is(apiErr, types.ErrProviderTaskPollingRetryable))
			if retryProvider {
				if task.ProviderAttempts+1 >= asyncImageProviderAttempts {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("provider image polling exhausted retries: %w", apiErr))
				}
				delay := asyncImageRetryDelay(task.ProviderAttempts)
				scheduled, scheduleErr := task.MarkImageProviderRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(apiErr.Error()))
				if scheduleErr != nil {
					return false, fmt.Errorf("schedule provider image polling retry for task %s: %w", task.TaskID, scheduleErr)
				}
				if scheduled {
					logger.LogWarn(ctx, fmt.Sprintf("provider image polling deferred: task=%s retry=%s", task.TaskID, delay))
				}
				return false, errAsyncImageRetryScheduled
			}
			retrySubmission := !payload.ProviderStored && (executionErr != nil || retryableAsyncImageSubmissionError(apiErr))
			if retrySubmission {
				service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, "/v1/images/generations", genericInfo, attemptStart, apiErr, false)
				service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiErr)
				if task.ProviderAttempts+1 >= asyncImageProviderAttempts {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("provider image submission exhausted retries: %w", apiErr))
				}
				delay := asyncImageRetryDelay(task.ProviderAttempts)
				scheduled, scheduleErr := task.MarkImageSubmissionRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(apiErr.Error()))
				if scheduleErr != nil {
					return false, fmt.Errorf("schedule provider image submission retry for task %s: %w", task.TaskID, scheduleErr)
				}
				if scheduled {
					logger.LogWarn(ctx, fmt.Sprintf("provider image submission deferred: task=%s retry=%s", task.TaskID, delay))
				}
				return false, errAsyncImageRetryScheduled
			}
			service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, "/v1/images/generations", genericInfo, attemptStart, apiErr, false)
			service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiErr)
			return false, failAsyncImageTask(ctx, task, apiErr)
		}
		if result == nil || result.Response == nil || len(result.Response.Data) == 0 {
			return false, failAsyncImageTask(ctx, task, errors.New("provider returned no image response"))
		}
		service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, "/v1/images/generations", genericInfo, attemptStart, nil, false)
		genericArtifact = &genericImageArtifact{
			Response:    result.Response,
			Usage:       result.Usage,
			OtherRatios: result.OtherRatios,
		}
	}
	if payload.Executor == AsyncImageExecutorAdaptor && !payload.ArtifactStored {
		// Provider URLs are often short-lived. Materialize them before the R2
		// phase and replace the provider-response checkpoint with bounded base64
		// so an upload retry never depends on the provider URL still being valid.
		downloadCtx, downloadCancel := context.WithTimeout(ctx, asyncImageUploadTimeout)
		materialized, materializeErr := materializeGenericImageResponse(downloadCtx, genericArtifact.Response)
		downloadCancel()
		if materializeErr != nil {
			if ctx.Err() != nil {
				return false, ctx.Err()
			}
			var sourceStorageErr *imageStorageError
			if !errors.As(materializeErr, &sourceStorageErr) || sourceStorageErr.Permanent() || task.DownloadAttempts+1 >= asyncImageDownloadAttempts {
				return false, failAsyncImageTask(ctx, task, fmt.Errorf("materialize provider image response: %w", materializeErr))
			}
			delay := asyncImageRetryDelay(task.DownloadAttempts)
			scheduled, scheduleErr := task.MarkImageDownloadRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(materializeErr.Error()))
			if scheduleErr != nil {
				return false, fmt.Errorf("schedule provider image download retry for task %s: %w", task.TaskID, scheduleErr)
			}
			if scheduled {
				logger.LogWarn(ctx, fmt.Sprintf("provider image download deferred: task=%s retry=%s", task.TaskID, delay))
			}
			return false, errAsyncImageRetryScheduled
		}

		genericArtifact.Response = materialized
		artifact, err := common.Marshal(genericArtifact)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("encode materialized image artifact: %w", err))
		}
		payload.ArtifactStored = true
		payload.ProviderStored = false
		checkpointData, err := common.Marshal(payload)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("encode materialized image checkpoint: %w", err))
		}
		persisted, err := persistAsyncImageArtifact(ctx, task, checkpointData, artifact, "70%")
		if errors.Is(err, model.ErrImageTaskArtifactTooLarge) {
			return false, failAsyncImageTask(ctx, task, err)
		}
		if err != nil {
			return false, fmt.Errorf("persist materialized image artifact for task %s: %w", task.TaskID, err)
		}
		if !persisted {
			return true, nil
		}
	}

	if payload.Executor != AsyncImageExecutorAdaptor && aggregated == nil {
		channel, err := model.CacheGetChannel(task.ChannelId)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("load channel: %w", err))
		}
		if channel.Status != common.ChannelStatusEnabled {
			return false, failAsyncImageTask(ctx, task, errors.New("image channel is disabled"))
		}
		if payload.ChannelType != 0 && channel.Type != payload.ChannelType {
			return false, failAsyncImageTask(ctx, task, errors.New("image channel type changed after task submission"))
		}
		if payload.ChannelCreateTime != 0 && channel.CreatedTime != payload.ChannelCreateTime {
			return false, failAsyncImageTask(ctx, task, errors.New("image channel identity changed after task submission"))
		}
		baseURL := channel.GetBaseURL()
		proxy := channel.GetSetting().Proxy
		if payload.Version >= asyncImageRouteSnapshotVersion && payload.ChannelBaseURL != "" {
			baseURL = payload.ChannelBaseURL
		}
		if baseURL == "" {
			return false, failAsyncImageTask(ctx, task, errors.New("image channel base_url snapshot is empty"))
		}
		maxAttempts := common.RetryTimes + 1
		if maxAttempts < 1 {
			maxAttempts = 1
		}
		if maxAttempts > 3 {
			maxAttempts = 3
		}
		apiKey, apiErr := imageTaskChannelKey(channel, task.PrivateData)
		if apiErr != nil {
			return false, failAsyncImageTask(ctx, task, apiErr)
		}
		var upstreamErr error
		for attempt := 0; attempt < maxAttempts; attempt++ {
			attemptStart := time.Now()
			aggregated, upstreamErr = requestAsyncImageUpstream(
				ctx,
				baseURL,
				apiKey,
				proxy,
				task.Properties.UpstreamModelName,
				task.TaskID,
				request,
			)
			if upstreamErr == nil {
				service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, "/v1/images/generations", nil, attemptStart, nil, false)
				break
			}
			if ctx.Err() != nil {
				return false, ctx.Err()
			}
			statusCode := asyncImageUpstreamStatus(upstreamErr)
			apiError := types.NewErrorWithStatusCode(upstreamErr, types.ErrorCodeBadResponse, statusCode, types.ErrOptionWithSkipRetry())
			service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, "/v1/images/generations", nil, attemptStart, apiError, false)
			service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiError)
			if attempt+1 >= maxAttempts || (statusCode != http.StatusTooManyRequests && statusCode < http.StatusInternalServerError) {
				break
			}
			timer := time.NewTimer(time.Duration(attempt+1) * time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				return false, ctx.Err()
			case <-timer.C:
			}
		}
		if upstreamErr != nil {
			statusCode := asyncImageUpstreamStatus(upstreamErr)
			if retryableAsyncImageStatus(statusCode) {
				if task.ProviderAttempts+1 >= asyncImageProviderAttempts {
					return false, failAsyncImageTask(ctx, task, fmt.Errorf("provider image submission exhausted retries: %w", upstreamErr))
				}
				delay := asyncImageRetryDelay(task.ProviderAttempts)
				scheduled, scheduleErr := task.MarkImageSubmissionRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(upstreamErr.Error()))
				if scheduleErr != nil {
					return false, fmt.Errorf("schedule provider image submission retry for task %s: %w", task.TaskID, scheduleErr)
				}
				if scheduled {
					logger.LogWarn(ctx, fmt.Sprintf("provider image submission deferred: task=%s retry=%s", task.TaskID, delay))
				}
				return false, errAsyncImageRetryScheduled
			}
			return false, failAsyncImageTask(ctx, task, upstreamErr)
		}
	}
	if payload.Executor != AsyncImageExecutorAdaptor && aggregated == nil {
		return false, failAsyncImageTask(ctx, task, errors.New("upstream returned no image response"))
	}
	if !payload.ArtifactStored && payload.Executor != AsyncImageExecutorAdaptor {
		// Store large output in bounded SQL chunks rather than in the task row.
		// This preserves the generated image across worker/R2 failures without
		// exceeding common MySQL packet limits or invoking the provider again.
		artifact, err := common.Marshal(aggregated)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("encode generated image artifact: %w", err))
		}
		payload.ArtifactStored = true
		checkpointData, err := common.Marshal(payload)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("encode image task checkpoint: %w", err))
		}
		persisted, err := persistAsyncImageArtifact(ctx, task, checkpointData, artifact, "70%")
		if errors.Is(err, model.ErrImageTaskArtifactTooLarge) {
			return false, failAsyncImageTask(ctx, task, err)
		}
		if err != nil {
			return false, fmt.Errorf("persist generated image artifact for task %s: %w", task.TaskID, err)
		}
		if !persisted {
			return true, nil
		}
	}

	var resultData []byte
	var resultImages []dto.ImageData
	var usage *dto.Usage
	var storageErr *imageStorageError
	uploadCtx, uploadCancel := context.WithTimeout(ctx, asyncImageUploadTimeout)
uploadLoop:
	for attempt := 0; attempt < 3; attempt++ {
		if payload.Executor == AsyncImageExecutorAdaptor {
			var storedResponse *dto.ImageResponse
			storedResponse, err = buildStoredGenericImageResponse(uploadCtx, genericArtifact.Response)
			if err == nil {
				resultData, err = common.Marshal(genericStoredImageEnvelope{
					Created: storedResponse.Created,
					Data:    storedResponse.Data,
					Usage:   genericArtifact.Usage,
				})
				resultImages = storedResponse.Data
				usage = genericArtifact.Usage
			}
		} else {
			var envelope *imageEnvelope
			envelope, err = buildStoredImagesResponse(uploadCtx, aggregated, request)
			if err == nil {
				resultData, err = common.Marshal(envelope)
				resultImages = envelope.Data
				usage = envelope.Usage
			}
		}
		if err == nil || !errors.As(err, &storageErr) {
			break
		}
		if attempt == 2 {
			break
		}
		timer := time.NewTimer(time.Duration(attempt+1) * time.Second)
		select {
		case <-uploadCtx.Done():
			timer.Stop()
			if err == nil {
				err = &imageStorageError{err: uploadCtx.Err()}
			}
			break uploadLoop
		case <-timer.C:
		}
	}
	uploadCancel()
	if err != nil {
		if ctx.Err() != nil {
			return false, ctx.Err()
		}
		var sourceErr *genericImageSourceError
		if errors.As(err, &sourceErr) {
			var sourceStorageErr *imageStorageError
			if !errors.As(err, &sourceStorageErr) || sourceStorageErr.Permanent() || task.DownloadAttempts+1 >= asyncImageDownloadAttempts {
				return false, failAsyncImageTask(ctx, task, fmt.Errorf("read provider image source: %w", err))
			}
			delay := asyncImageRetryDelay(task.DownloadAttempts)
			scheduled, scheduleErr := task.MarkImageDownloadRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(err.Error()))
			if scheduleErr != nil {
				return false, fmt.Errorf("schedule provider image download retry for task %s: %w", task.TaskID, scheduleErr)
			}
			if scheduled {
				logger.LogWarn(ctx, fmt.Sprintf("provider image download deferred: task=%s retry=%s", task.TaskID, delay))
			}
			return false, errAsyncImageRetryScheduled
		}
		if errors.As(err, &storageErr) {
			if storageErr.Permanent() || task.UploadAttempts+1 >= asyncImageUploadAttempts {
				return false, failAsyncImageTask(ctx, task, fmt.Errorf("store generated image: %w", err))
			}
			retryShift := task.UploadAttempts
			if retryShift > 5 {
				retryShift = 5
			}
			delay := 15 * time.Second * time.Duration(1<<retryShift)
			scheduled, scheduleErr := task.MarkImageUploadRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(err.Error()))
			if scheduleErr != nil {
				return false, fmt.Errorf("schedule image upload retry for task %s: %w", task.TaskID, scheduleErr)
			}
			if scheduled {
				logger.LogWarn(ctx, fmt.Sprintf("image upload deferred: task=%s retry=%s", task.TaskID, delay))
			}
			return false, errAsyncImageRetryScheduled
		}
		return false, failAsyncImageTask(ctx, task, err)
	}

	if payload.Executor == AsyncImageExecutorAdaptor && len(genericArtifact.OtherRatios) > 0 && task.PrivateData.BillingContext != nil {
		task.PrivateData.BillingContext.OtherRatios = copyAsyncImageRatios(genericArtifact.OtherRatios)
	}
	actualQuota, clamp, err := service.CalculateImageTaskQuotaWithCount(task, usage, len(resultImages))
	if err != nil {
		return false, failAsyncImageTask(ctx, task, fmt.Errorf("calculate image billing: %w", err))
	}
	task.PrivateData.FinalQuotaClamp = clamp
	task.Data = resultData
	task.CheckpointData = nil
	if len(resultImages) > 0 {
		task.PrivateData.ResultURL = resultImages[0].Url
	}
	won, err := task.TransitionImageTaskToFinalizing(model.TaskStatusSuccess, actualQuota)
	if err != nil {
		return false, fmt.Errorf("prepare completed image task %s: %w", task.TaskID, err)
	}
	if !won {
		return true, nil
	}
	finalized, err := finalizePersistedImageTask(ctx, task.TaskID)
	if err != nil {
		return false, err
	}
	return finalized.Status == model.TaskStatusSuccess, nil
}

func loadAsyncImageChannel(task *model.Task, prepared *PreparedAsyncImageRequest, providerStored bool) (*model.Channel, string, error) {
	channel, err := model.CacheGetChannel(task.ChannelId)
	if err != nil {
		return nil, "", fmt.Errorf("load channel: %w", err)
	}
	if channel.Status != common.ChannelStatusEnabled && !providerStored {
		return nil, "", errors.New("image channel is disabled")
	}
	if prepared.ChannelType != 0 && channel.Type != prepared.ChannelType {
		return nil, "", errors.New("image channel type changed after task submission")
	}
	if prepared.ChannelCreateTime != 0 && channel.CreatedTime != prepared.ChannelCreateTime {
		return nil, "", errors.New("image channel identity changed after task submission")
	}
	// InitChannelMeta intentionally falls back to the OpenAI adaptor for legacy
	// OpenAI-compatible channel types that are not explicit API-type entries.
	// Resolve the channel with the same semantics here, then compare the result
	// with the snapshotted API type to retain protection against incompatible
	// channel changes.
	apiType, _ := common.ChannelType2APIType(channel.Type)
	if apiType != prepared.APIType {
		return nil, "", errors.New("image channel API type changed after task submission")
	}
	if prepared.ChannelBaseURL == "" && channel.GetBaseURL() == "" {
		return nil, "", errors.New("image channel base_url is empty")
	}
	apiKey, err := imageTaskChannelKey(channel, task.PrivateData)
	if err != nil {
		if !providerStored {
			return nil, "", err
		}
		apiKey, _, _ = channel.GetNextEnabledKey()
	}
	return channel, apiKey, nil
}

func genericAsyncImageRelayInfo(task *model.Task, channel *model.Channel, apiKey string, prepared *PreparedAsyncImageRequest) *relaycommon.RelayInfo {
	requestHeaders := copyAsyncImageHeaders(prepared.ClientHeaders)
	if requestHeaders == nil {
		requestHeaders = make(map[string]string)
	}
	requestHeaders["Content-Type"] = prepared.ContentType
	if requestHeaders["Accept"] == "" {
		requestHeaders["Accept"] = "application/json"
	}

	priceData := types.PriceData{}
	if billing := task.PrivateData.BillingContext; billing != nil {
		priceData = types.PriceData{
			ModelPrice:           billing.ModelPrice,
			ModelRatio:           billing.ModelRatio,
			CompletionRatio:      billing.CompletionRatio,
			CacheRatio:           billing.CacheRatio,
			CacheCreationRatio:   billing.CacheCreationRatio,
			CacheCreation5mRatio: billing.CacheCreation5mRatio,
			CacheCreation1hRatio: billing.CacheCreation1hRatio,
			ImageRatio:           billing.ImageRatio,
			UsePrice:             billing.UsePrice,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: billing.GroupRatio,
			},
		}
		priceData.ReplaceOtherRatios(billing.OtherRatios)
	}

	apiVersion := channel.Other
	organization := ""
	if channel.OpenAIOrganization != nil {
		organization = *channel.OpenAIOrganization
	}
	currentChannelSetting := channel.GetSetting()
	channelSetting := currentChannelSetting
	currentHeadersOverride := channel.GetHeaderOverride()
	headersOverride := currentHeadersOverride
	currentChannelOtherSettings := channel.GetOtherSettings()
	channelOtherSettings := currentChannelOtherSettings
	if prepared.ConfigurationStored {
		apiVersion = prepared.APIVersion
		organization = prepared.Organization
		if prepared.ChannelSetting != nil {
			channelSetting = *prepared.ChannelSetting
			channelSetting.Proxy = currentChannelSetting.Proxy
		} else {
			channelSetting = currentChannelSetting
		}
		if prepared.ChannelOtherSettings != nil {
			channelOtherSettings = *prepared.ChannelOtherSettings
			channelOtherSettings.AdvancedCustom = currentChannelOtherSettings.AdvancedCustom
		} else {
			channelOtherSettings = currentChannelOtherSettings
		}
		headersOverride = copySafeAsyncImageHeaderOverrides(prepared.HeadersOverride)
		if headersOverride == nil {
			headersOverride = make(map[string]interface{})
		}
		for key, value := range currentHeadersOverride {
			if common.IsSensitiveHeaderName(key) {
				headersOverride[key] = value
			}
		}
	}
	headersOverride["Idempotency-Key"] = task.TaskID
	if prepared.AdvancedRoute != nil {
		route := *prepared.AdvancedRoute
		route.Models = append([]string(nil), prepared.AdvancedRoute.Models...)
		route.Auth = nil
		if currentChannelOtherSettings.AdvancedCustom != nil {
			currentRoute, ok := currentChannelOtherSettings.AdvancedCustom.MatchPathForModel(prepared.RequestURLPath, task.Properties.OriginModelName)
			if ok && currentRoute.Auth != nil {
				auth := *currentRoute.Auth
				route.Auth = &auth
			}
		}
		channelOtherSettings.AdvancedCustom = &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}
	}
	channelBaseURL := prepared.ChannelBaseURL
	if channelBaseURL == "" {
		channelBaseURL = channel.GetBaseURL()
	}
	return &relaycommon.RelayInfo{
		RequestId:       task.TaskID,
		StartTime:       time.Now(),
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: task.Properties.OriginModelName,
		RequestURLPath:  prepared.RequestURLPath,
		RequestHeaders:  requestHeaders,
		PriceData:       priceData,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          channel.Type,
			ChannelId:            channel.Id,
			ChannelIsMultiKey:    channel.ChannelInfo.IsMultiKey,
			ChannelMultiKeyIndex: task.PrivateData.ChannelMultiKeyIndex,
			ChannelBaseUrl:       channelBaseURL,
			ApiType:              prepared.APIType,
			ApiVersion:           apiVersion,
			ApiKey:               apiKey,
			Organization:         organization,
			ChannelCreateTime:    channel.CreatedTime,
			HeadersOverride:      headersOverride,
			ChannelSetting:       channelSetting,
			ChannelOtherSettings: channelOtherSettings,
			UpstreamModelName:    task.Properties.UpstreamModelName,
		},
	}
}

func copySafeAsyncImageHeaderOverrides(headers map[string]interface{}) map[string]interface{} {
	if len(headers) == 0 {
		return nil
	}
	copied := make(map[string]interface{}, len(headers))
	for key, value := range headers {
		if common.IsSensitiveHeaderName(key) {
			continue
		}
		copied[key] = value
	}
	if len(copied) == 0 {
		return nil
	}
	return copied
}

func copyAsyncImageRatios(ratios map[string]float64) map[string]float64 {
	if len(ratios) == 0 {
		return nil
	}
	copied := make(map[string]float64, len(ratios))
	for key, value := range ratios {
		copied[key] = value
	}
	return copied
}

func copyAsyncImageHeaderOverrides(headers map[string]interface{}) map[string]interface{} {
	copied := make(map[string]interface{}, len(headers)+1)
	for key, value := range headers {
		copied[key] = value
	}
	return copied
}

var errAsyncImageRetryScheduled = errors.New("async image retry scheduled")

func asyncImageRetryDelay(attempt int) time.Duration {
	if attempt > 5 {
		attempt = 5
	}
	return 15 * time.Second * time.Duration(1<<attempt)
}

func retryableAsyncImageSubmissionError(apiErr *types.NewAPIError) bool {
	if apiErr == nil {
		return false
	}
	switch apiErr.GetErrorCode() {
	case types.ErrorCodeDoRequestFailed, types.ErrorCodeReadResponseBodyFailed:
		return true
	case types.ErrorCodeBadResponseStatusCode:
		return retryableAsyncImageStatus(apiErr.StatusCode)
	default:
		return false
	}
}

func retryableAsyncImageStatus(status int) bool {
	return status == http.StatusRequestTimeout ||
		status == http.StatusConflict ||
		status == http.StatusTooEarly ||
		status == http.StatusTooManyRequests ||
		status >= http.StatusInternalServerError
}

func persistAsyncImageArtifact(ctx context.Context, task *model.Task, checkpointData, artifact []byte, progress string) (bool, error) {
	for attempt := 0; attempt < asyncImageWorkerAttempts; attempt++ {
		persisted, err := model.PersistImageTaskArtifact(task, checkpointData, artifact, progress)
		if err == nil || errors.Is(err, model.ErrImageTaskArtifactTooLarge) {
			return persisted, err
		}
		if attempt+1 >= asyncImageWorkerAttempts {
			return false, err
		}

		retryShift := attempt
		if retryShift > 5 {
			retryShift = 5
		}
		delay := 100 * time.Millisecond * time.Duration(1<<retryShift)
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return false, fmt.Errorf("persist image task artifact before deadline: %w", ctx.Err())
		case <-timer.C:
		}
	}
	return false, errors.New("persist image task artifact exhausted retries")
}

func imageTaskChannelKey(channel *model.Channel, private model.TaskPrivateData) (string, error) {
	if channel == nil {
		return "", errors.New("image channel is required")
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return "", errors.New("image channel has no keys")
	}
	if private.ChannelKeyHash != "" {
		if private.ChannelMultiKeyIndex >= 0 && private.ChannelMultiKeyIndex < len(keys) {
			candidate := keys[private.ChannelMultiKeyIndex]
			if common.GenerateHMAC(candidate) == private.ChannelKeyHash {
				return candidate, nil
			}
		}
		for _, candidate := range keys {
			if common.GenerateHMAC(candidate) == private.ChannelKeyHash {
				return candidate, nil
			}
		}
		return "", errors.New("image channel key changed after task submission")
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return "", apiErr
	}
	return key, nil
}

func decodeAsyncImageTaskPayload(data []byte) (asyncImageTaskPayload, error) {
	payload := asyncImageTaskPayload{}
	if err := common.Unmarshal(data, &payload); err != nil {
		return payload, err
	}
	if payload.Request != nil {
		payload.Request.Extra = copyAsyncImageExtra(payload.RequestExtra)
		if payload.Executor == "" {
			payload.Executor = AsyncImageExecutorResponses
		}
		return payload, nil
	}
	request := &dto.ImageRequest{}
	if err := common.Unmarshal(data, request); err != nil {
		return payload, err
	}
	payload.Request = request
	return payload, nil
}

func failAsyncImageTask(ctx context.Context, task *model.Task, cause error) error {
	if cause == nil {
		cause = errors.New("image generation failed")
	}
	reason := common.MaskSensitiveInfo(cause.Error())
	if len(reason) > 2000 {
		reason = reason[:2000]
	}
	task.FailReason = reason
	task.CheckpointData = nil
	task.PrivateData.FinalQuotaClamp = nil
	won, err := task.TransitionImageTaskToFinalizing(model.TaskStatusFailure, 0)
	if err != nil {
		return fmt.Errorf("prepare failed image task %s: %w", task.TaskID, err)
	}
	if won {
		if _, err := finalizePersistedImageTask(ctx, task.TaskID); err != nil {
			return err
		}
	}
	return nil
}

func requestAsyncImageUpstream(ctx context.Context, baseURL, apiKey, proxy, modelOverride, taskID string, req *dto.ImageRequest) (*UpstreamResponse, error) {
	body, err := common.Marshal(buildGenerationsRequest(req, modelOverride))
	if err != nil {
		return nil, fmt.Errorf("marshal image request: %w", err)
	}
	client, err := service.GetRelayHttpClientWithProxy(proxy, true)
	if err != nil {
		return nil, fmt.Errorf("create image HTTP client: %w", err)
	}
	clientCopy := *client
	clientCopy.Timeout = 0

	requestCtx, cancel := context.WithTimeout(ctx, asyncImageUpstreamTimeout)
	defer cancel()
	url := strings.TrimRight(baseURL, "/") + "/v1/responses"
	httpReq, err := http.NewRequestWithContext(requestCtx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create image request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Idempotency-Key", taskID)

	resp, err := clientCopy.Do(httpReq)
	if err != nil {
		statusCode := http.StatusBadGateway
		if errors.Is(err, context.DeadlineExceeded) {
			statusCode = http.StatusGatewayTimeout
		}
		return nil, &asyncImageUpstreamError{statusCode: statusCode, err: fmt.Errorf("send image request: %w", err)}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, &asyncImageUpstreamError{
			statusCode: resp.StatusCode,
			err:        fmt.Errorf("upstream returned %d: %s", resp.StatusCode, strings.TrimSpace(string(errBody))),
		}
	}
	aggregated, err := AggregateResponseStream(resp.Body)
	if err != nil {
		return nil, &asyncImageUpstreamError{statusCode: http.StatusBadGateway, err: err}
	}
	return aggregated, nil
}

func asyncImageUpstreamStatus(err error) int {
	var upstreamErr *asyncImageUpstreamError
	if errors.As(err, &upstreamErr) && upstreamErr.statusCode > 0 {
		return upstreamErr.statusCode
	}
	return http.StatusBadGateway
}

func deliverDueImageWebhooks(ctx context.Context) (int, int, error) {
	now := common.GetTimestamp()
	webhooks, err := model.ClaimDueTaskWebhooks(now, now+int64(asyncImageWebhookLease/time.Second), asyncImageWebhookBatch)
	if err != nil {
		return 0, 0, fmt.Errorf("claim due image webhooks: %w", err)
	}
	type deliveryResult struct {
		delivered bool
		retried   bool
		err       error
	}
	results := make(chan deliveryResult, len(webhooks))
	semaphore := make(chan struct{}, 8)
	var wg sync.WaitGroup
	var launchErr error
	for _, webhook := range webhooks {
		if err := ctx.Err(); err != nil {
			launchErr = err
			break
		}
		semaphore <- struct{}{}
		wg.Add(1)
		go func(webhook *model.TaskWebhook) {
			defer wg.Done()
			defer func() { <-semaphore }()
			task, exists, err := model.GetImageTaskByTaskID(webhook.TaskID)
			if err != nil {
				results <- deliveryResult{err: fmt.Errorf("load webhook task %s: %w", webhook.TaskID, err)}
				return
			}
			if !exists || task == nil {
				if err := model.MarkTaskWebhookFailed(webhook, "task not found"); err != nil {
					results <- deliveryResult{err: fmt.Errorf("mark orphan webhook failed for task %s: %w", webhook.TaskID, err)}
					return
				}
				results <- deliveryResult{}
				return
			}
			if task.Status != model.TaskStatusSuccess && task.Status != model.TaskStatusFailure {
				results <- deliveryResult{}
				return
			}
			if err := sendAsyncImageWebhook(ctx, webhook.URL, webhook.Secret, webhook.DeliveryID(), BuildImageTaskResponse(task)); err != nil {
				if persistErr := recordImageWebhookFailure(webhook, err); persistErr != nil {
					results <- deliveryResult{err: persistErr}
					return
				}
				results <- deliveryResult{retried: true}
				return
			}
			if err := model.MarkTaskWebhookDelivered(webhook); err != nil {
				results <- deliveryResult{err: fmt.Errorf("mark webhook delivered for task %s: %w", webhook.TaskID, err)}
				return
			}
			results <- deliveryResult{delivered: true}
		}(webhook)
	}
	wg.Wait()
	close(results)
	delivered := 0
	retried := 0
	firstErr := launchErr
	for result := range results {
		if result.delivered {
			delivered++
		}
		if result.retried {
			retried++
		}
		if firstErr == nil && result.err != nil {
			firstErr = result.err
		}
	}
	return delivered, retried, firstErr
}

func recordImageWebhookFailure(webhook *model.TaskWebhook, sendErr error) error {
	message := common.MaskSensitiveInfo(sendErr.Error())
	if len(message) > 2000 {
		message = message[:2000]
	}
	if webhook.Attempts+1 >= asyncImageWebhookAttempts {
		if err := model.MarkTaskWebhookFailed(webhook, message); err != nil {
			return fmt.Errorf("mark webhook failed for task %s: %w", webhook.TaskID, err)
		}
		return nil
	}
	delay := 30 * time.Second * time.Duration(1<<webhook.Attempts)
	nextAttemptAt := time.Now().Add(delay).Unix()
	if err := model.MarkTaskWebhookRetry(webhook, nextAttemptAt, message); err != nil {
		return fmt.Errorf("schedule webhook retry for task %s: %w", webhook.TaskID, err)
	}
	return nil
}
