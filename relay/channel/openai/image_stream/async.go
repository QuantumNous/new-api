package image_stream

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	asyncImageBatchSize                 = 64
	asyncImageMaxConcurrency            = 16
	asyncImageWebhookBatch              = 100
	asyncImageWebhookAttempts           = 5
	asyncImageWebhookLease              = 5 * time.Minute
	asyncImageUpstreamTimeout           = 5 * time.Minute
	asyncImageUploadTimeout             = 5 * time.Minute
	asyncImageReservationStaleAfter     = 5 * time.Minute
	asyncImageWorkerStaleAfter          = 20 * time.Minute
	asyncImageProviderAttempts          = 6
	asyncImageDownloadAttempts          = 6
	asyncImageUploadAttempts            = 6
	asyncImageWorkerAttempts            = 6
	maxAsyncImageRequestExtensionBytes  = 512 << 10
	maxAsyncImageCheckpointBytes        = 4 << 20
	maxAsyncImagePollingCheckpointBytes = 1 << 20
)

const ContextKeyAsyncImageSubmitted = "async_image_submitted"

var sendAsyncImageWebhook = service.SendJSONWebhookWithDeliveryID

// Reference-image execution can materialize tens of MiB for provider request
// formats that require base64 or multipart bodies. Bound these workers
// independently from text-only image generations.
var asyncImageInputExecutionSemaphore = make(chan struct{}, 2)

// Loading and materializing output can temporarily hold provider bytes,
// durable base64, and an R2 upload buffer. Serialize that whole lifetime so
// high ASYNC_IMAGE_CONCURRENCY values cannot multiply the largest per-task
// memory spike.
var asyncImageOutputMaterializationSemaphore = make(chan struct{}, 1)

type asyncImageOutputLease struct {
	held bool
}

func (l *asyncImageOutputLease) acquire(ctx context.Context) error {
	_, err := l.acquireNew(ctx)
	return err
}

func (l *asyncImageOutputLease) acquireNew(ctx context.Context) (bool, error) {
	if l.held {
		return false, nil
	}
	select {
	case asyncImageOutputMaterializationSemaphore <- struct{}{}:
		l.held = true
		return true, nil
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

func (l *asyncImageOutputLease) release() {
	if !l.held {
		return
	}
	<-asyncImageOutputMaterializationSemaphore
	l.held = false
}

type asyncImageRunResult struct {
	Completed         int `json:"completed"`
	Failed            int `json:"failed"`
	WebhooksDelivered int `json:"webhooks_delivered"`
	WebhooksRetried   int `json:"webhooks_retried"`
	InputsDeleted     int `json:"inputs_deleted"`
	InputsRetried     int `json:"inputs_retried"`
}

type asyncImageTaskPayload struct {
	Version           int                        `json:"version,omitempty"`
	Executor          string                     `json:"executor,omitempty"`
	RelayMode         int                        `json:"relay_mode,omitempty"`
	Request           *dto.ImageRequest          `json:"request"`
	RequestExtra      map[string]json.RawMessage `json:"request_extra,omitempty"`
	InputObjectKeys   []string                   `json:"input_object_keys,omitempty"`
	MaskObjectKey     string                     `json:"mask_object_key,omitempty"`
	PreparedRequest   *PreparedAsyncImageRequest `json:"prepared_request,omitempty"`
	ChannelBaseURL    string                     `json:"channel_base_url,omitempty"`
	ChannelProxy      string                     `json:"channel_proxy,omitempty"`
	ChannelType       int                        `json:"channel_type,omitempty"`
	ChannelCreateTime int64                      `json:"channel_create_time,omitempty"`
	ProviderStored    bool                       `json:"provider_response_stored,omitempty"`
	ArtifactStored    bool                       `json:"artifact_stored,omitempty"`
	// ProviderCallStarted was written before the upstream request. A checkpoint
	// with this bit but no stored response is ambiguous after restart and must
	// never be resubmitted automatically.
	ProviderCallStarted bool `json:"provider_call_started,omitempty"`
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
	asyncImagePayloadVersion       = 6
	AsyncImageExecutorResponses    = "responses_sse"
	AsyncImageExecutorAdaptor      = "adaptor"
)

// PreparedAsyncImageRequest captures the provider route after model mapping.
// Body normally contains the converted request. DeferConversion keeps only the
// normalized ImageRequest and route snapshot so providers that inline reference
// images do not put those bytes in the task row.
type PreparedAsyncImageRequest struct {
	Body                    []byte            `json:"body,omitempty"`
	DeferConversion         bool              `json:"defer_conversion,omitempty"`
	RelayMode               int               `json:"relay_mode,omitempty"`
	ContentType             string            `json:"content_type,omitempty"`
	ClientHeaders           map[string]string `json:"client_headers,omitempty"`
	RequestURLPath          string            `json:"request_url_path,omitempty"`
	ChannelBaseURL          string            `json:"channel_base_url,omitempty"`
	APIType                 int               `json:"api_type"`
	ChannelType             int               `json:"channel_type"`
	ChannelCreateTime       int64             `json:"channel_create_time,omitempty"`
	ConfigurationStored     bool              `json:"configuration_stored,omitempty"`
	APIVersion              string            `json:"api_version,omitempty"`
	Organization            string            `json:"organization,omitempty"`
	ExecutionOverrideHash   string            `json:"execution_override_hash,omitempty"`
	ExecutionOverrideStored bool              `json:"execution_override_stored,omitempty"`
	// ParamOverride is resolved from the current channel at worker execution
	// time. It is intentionally never serialized into the task checkpoint
	// because param operations can carry header credentials in arbitrary values.
	ParamOverride        map[string]interface{}    `json:"-"`
	HeadersOverride      map[string]interface{}    `json:"headers_override,omitempty"`
	ChannelSetting       *dto.ChannelSettings      `json:"channel_setting,omitempty"`
	ChannelOtherSettings *dto.ChannelOtherSettings `json:"channel_other_settings,omitempty"`
	AdvancedRouteHash    string                    `json:"advanced_route_hash,omitempty"`
	// AdvancedRoute is read only for legacy checkpoints. New tasks bind the
	// current route by HMAC and resolve its target and credentials at execution.
	AdvancedRoute *dto.AdvancedCustomRoute `json:"advanced_route,omitempty"`
}

type asyncImageUpstreamError struct {
	statusCode         int
	definitiveResponse bool
	err                error
}

var persistAsyncImageTaskArtifact = model.PersistImageTaskArtifact
var loadAsyncImageTaskArtifact = model.LoadImageTaskArtifact

func (e *asyncImageUpstreamError) Error() string { return e.err.Error() }

func (e *asyncImageUpstreamError) Unwrap() error { return e.err }

type asyncImageSystemTaskHandler struct{}

func (asyncImageSystemTaskHandler) Type() string { return model.SystemTaskTypeAsyncImage }

func (asyncImageSystemTaskHandler) Enabled() bool {
	return model.HasPendingImageWork(time.Now().Add(-asyncImageWorkerStaleAfter).Unix()) ||
		model.HasStaleImageBillingReservations(time.Now().Add(-asyncImageReservationStaleAfter).Unix()) ||
		model.HasDueImageTaskBillingLogOutbox(common.GetTimestamp()) ||
		model.HasDueImageInputCleanups(common.GetTimestamp())
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
	service.RegisterSystemTaskHandler(asyncImageInputCleanupTaskHandler{})
}

func SubmitAsyncImage(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ImageRequest, inputs *PreparedAsyncImageInputs, prepared ...*PreparedAsyncImageRequest) *types.NewAPIError {
	if info == nil || req == nil {
		return types.NewErrorWithStatusCode(errors.New("async image request is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	relayMode := info.RelayMode
	if relayMode == relayconstant.RelayModeUnknown {
		relayMode = relayconstant.RelayModeImagesGenerations
	}
	if relayMode != relayconstant.RelayModeImagesGenerations && relayMode != relayconstant.RelayModeImagesEdits {
		return types.NewErrorWithStatusCode(fmt.Errorf("unsupported async image relay mode %d", relayMode), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	hasInputSources := inputs != nil && len(inputs.ObjectKeys) > 0
	if relayMode == relayconstant.RelayModeImagesEdits && !hasInputSources {
		var err error
		hasInputSources, err = HasAsyncImageInputSources(c, req)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if !hasInputSources {
			return types.NewErrorWithStatusCode(errors.New("image is required for asynchronous image edits"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}
	if err := ValidateAsyncImageSubmission(info.OriginModelName, info.UpstreamModelName, req, hasInputSources); err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if apiErr := ValidateAsyncImageDelivery(req); apiErr != nil {
		return apiErr
	}
	// The Responses executor builds its upstream payload asynchronously. Run
	// the same image-source validation before reserving quota so malformed
	// `images`/`image` values are reported as a client 400 instead of creating a
	// task that can only fail later in the worker. Provider-specific prepared
	// requests retain their adaptor-owned image shapes and are validated by the
	// adaptor path instead.
	if len(prepared) == 0 || prepared[0] == nil {
		if req.N != nil && *req.N > 1 {
			return types.NewErrorWithStatusCode(
				errors.New("the GPT Responses image executor supports only n=1"),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		if err := validateAsyncImageResponsesSubmission(req, info.UpstreamModelName, relayMode); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
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

	// Quota ownership is durable before any remote input is fetched or uploaded.
	// While staging, the task remains RESERVING and cannot be claimed by a
	// worker. A crash is refunded by stale-reservation recovery; activation below
	// writes the completed checkpoint and makes the task runnable atomically.
	if inputs == nil {
		var apiErr *types.NewAPIError
		inputs, apiErr = PrepareAsyncImageInputs(c, req, task.TaskID)
		if apiErr != nil {
			refundPreparedAsyncImageSubmission(c, info, task.TaskID, apiErr.Error())
			return apiErr
		}
	}
	inputObjectKeys := []string(nil)
	maskObjectKey := ""
	if inputs != nil && len(inputs.ObjectKeys) > 0 {
		if !LoadR2Config().InputEnabled() {
			apiErr := types.NewErrorWithStatusCode(
				errors.New("async image input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET"),
				types.ErrorCodeInvalidRequest,
				http.StatusServiceUnavailable,
				types.ErrOptionWithSkipRetry(),
			)
			refundPreparedAsyncImageSubmission(c, info, task.TaskID, apiErr.Error())
			return apiErr
		}
		inputObjectKeys = append([]string(nil), inputs.ObjectKeys...)
	}
	if inputs != nil {
		maskObjectKey = strings.TrimSpace(inputs.MaskObjectKey)
	}
	requestInput := billingexpr.RequestInput{}
	if info.BillingRequestInput != nil {
		requestInput = *info.BillingRequestInput
	} else {
		requestInput.Body, err = common.Marshal(req)
		if err != nil {
			refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
			return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
	}
	requestInput.Body, err = sanitizeAsyncBillingRequestBodyForTask(requestInput.Body, req, inputObjectKeys, maskObjectKey)
	if err != nil {
		refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	requestInput.Headers = sanitizeAsyncImageHeaderMap(requestInput.Headers)
	task.PrivateData.BillingContext.BillingRequestInput = &requestInput
	executor := AsyncImageExecutorResponses
	var preparedRequest *PreparedAsyncImageRequest
	if len(prepared) > 0 && prepared[0] != nil {
		executor = AsyncImageExecutorAdaptor
		preparedCopy := *prepared[0]
		preparedCopy.RelayMode = relayMode
		preparedCopy.Body = append([]byte(nil), prepared[0].Body...)
		if len(inputObjectKeys) > 0 {
			// Signed input URLs are execution-time values. Force every adaptor to
			// rebuild its body from freshly signed URLs in the worker.
			preparedCopy.DeferConversion = true
			preparedCopy.Body = nil
		}
		preparedCopy.ClientHeaders = copyAsyncImageHeaders(prepared[0].ClientHeaders)
		// Resolve proxy, route, base URL, and header credentials from the current
		// channel only when the worker executes.
		preparedCopy.ChannelBaseURL = ""
		preparedCopy.HeadersOverride = nil
		if prepared[0].ChannelSetting != nil {
			channelSetting := *prepared[0].ChannelSetting
			channelSetting.Proxy = ""
			channelSetting.SystemPrompt = ""
			channelSetting.SystemPromptOverride = false
			preparedCopy.ChannelSetting = &channelSetting
		}
		if prepared[0].ChannelOtherSettings != nil {
			channelOtherSettings := *prepared[0].ChannelOtherSettings
			channelOtherSettings.AdvancedCustom = nil
			preparedCopy.ChannelOtherSettings = &channelOtherSettings
		}
		if prepared[0].AdvancedRoute != nil {
			advancedRouteHash, fingerprintErr := AsyncImageAdvancedRouteFingerprint(*prepared[0].AdvancedRoute)
			if fingerprintErr != nil {
				refundPreparedAsyncImageSubmission(c, info, task.TaskID, fingerprintErr.Error())
				return types.NewError(fingerprintErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			preparedCopy.AdvancedRouteHash = advancedRouteHash
			preparedCopy.AdvancedRoute = nil
		}
		preparedRequest = &preparedCopy
	}
	payload := asyncImageTaskPayload{
		Version:         asyncImagePayloadVersion,
		Executor:        executor,
		RelayMode:       relayMode,
		Request:         persistedAsyncImageRequest(req, inputObjectKeys, maskObjectKey),
		RequestExtra:    copyAsyncImageExtra(req.Extra),
		InputObjectKeys: inputObjectKeys,
		MaskObjectKey:   maskObjectKey,
		PreparedRequest: preparedRequest,
	}
	if info.ChannelMeta != nil {
		payload.ChannelType = info.ChannelType
		payload.ChannelCreateTime = info.ChannelCreateTime
	}
	checkpointData, err := encodeAsyncImageTaskPayload(payload)
	if err != nil {
		refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	encryptedCheckpoint, err := model.EncryptImageTaskArtifactCheckpoint(checkpointData)
	if err != nil {
		refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	task.CheckpointData = json.RawMessage(encryptedCheckpoint)

	cleanupObjectKeys := append([]string(nil), inputObjectKeys...)
	if maskObjectKey != "" {
		cleanupObjectKeys = append(cleanupObjectKeys, maskObjectKey)
	}
	if len(cleanupObjectKeys) > 0 {
		err = model.PersistPreparedImageInputCleanup(task.TaskID, cleanupObjectKeys)
		if err != nil {
			refundPreparedAsyncImageSubmission(c, info, task.TaskID, err.Error())
			return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
	}
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

func validateAsyncImageResponsesSubmission(req *dto.ImageRequest, modelOverride string, relayMode int) error {
	// Edit input bytes are staged only after the reservation is durable, so this
	// preflight validates the shared image_generation tool options without
	// materializing the source. SubmitAsyncImage separately requires an edit
	// source, and the worker later builds the edit-specific multimodal payload.
	_, err := buildGenerationsRequestWithError(req, modelOverride)
	if err != nil {
		return err
	}
	if relayMode != relayconstant.RelayModeImagesGenerations && relayMode != relayconstant.RelayModeImagesEdits {
		return fmt.Errorf("unsupported async image relay mode %d", relayMode)
	}
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

func sanitizeAsyncBillingRequestBody(body []byte, storedRequests ...*dto.ImageRequest) ([]byte, error) {
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
	delete(fields, "callBackUrl")
	var storedRequest *dto.ImageRequest
	if len(storedRequests) > 0 {
		storedRequest = storedRequests[0]
	}
	if storedRequest != nil {
		for _, field := range []string{"images", "image_input", "input_urls"} {
			if _, ok := fields[field]; !ok {
				continue
			}
			if len(storedRequest.Images) == 0 {
				delete(fields, field)
			} else {
				fields[field] = append(json.RawMessage(nil), storedRequest.Images...)
			}
		}
		if _, ok := fields["image"]; ok {
			if len(storedRequest.Image) == 0 {
				delete(fields, "image")
			} else {
				fields["image"] = append(json.RawMessage(nil), storedRequest.Image...)
			}
		}
	}
	if rawInput, ok := fields["input"]; ok && common.GetJsonType(rawInput) == "object" {
		var input map[string]json.RawMessage
		if err := common.Unmarshal(rawInput, &input); err != nil {
			return nil, fmt.Errorf("invalid async image input: %w", err)
		}
		delete(input, "async")
		delete(input, "webhook_url")
		delete(input, "webhook_secret")
		delete(input, "callBackUrl")
		if storedRequest != nil {
			for _, field := range []string{"images", "image_input", "input_urls"} {
				if _, ok := input[field]; !ok {
					continue
				}
				if len(storedRequest.Images) == 0 {
					delete(input, field)
				} else {
					input[field] = append(json.RawMessage(nil), storedRequest.Images...)
				}
			}
			if _, ok := input["image"]; ok {
				if len(storedRequest.Image) == 0 {
					delete(input, "image")
				} else {
					input["image"] = append(json.RawMessage(nil), storedRequest.Image...)
				}
			}
		}
		encoded, err := common.Marshal(input)
		if err != nil {
			return nil, fmt.Errorf("sanitize async image input: %w", err)
		}
		fields["input"] = encoded
	}
	return common.Marshal(fields)
}

func sanitizeAsyncBillingRequestBodyForTask(body []byte, storedRequest *dto.ImageRequest, inputObjectKeys []string, maskObjectKey string) ([]byte, error) {
	sanitized, err := sanitizeAsyncBillingRequestBody(body, storedRequest)
	hasStoredMask := strings.TrimSpace(maskObjectKey) != ""
	if err != nil || (len(inputObjectKeys) == 0 && !hasStoredMask) {
		return sanitized, err
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(sanitized, &fields); err != nil {
		return nil, fmt.Errorf("decode sanitized async image billing request: %w", err)
	}
	var encodedPlaceholders json.RawMessage
	if len(inputObjectKeys) > 0 {
		placeholderValues := make([]string, len(inputObjectKeys))
		for index := range placeholderValues {
			placeholderValues[index] = "r2-input"
		}
		encodedPlaceholders, err = common.Marshal(placeholderValues)
		if err != nil {
			return nil, fmt.Errorf("encode async image input placeholders: %w", err)
		}
		for _, field := range []string{"images", "image_input", "input_urls"} {
			if _, ok := fields[field]; ok {
				fields[field] = encodedPlaceholders
			}
		}
		if _, ok := fields["image"]; ok {
			fields["image"] = json.RawMessage(`"r2-input"`)
		}
	}
	if hasStoredMask {
		if _, ok := fields["mask"]; ok {
			fields["mask"] = json.RawMessage(`"r2-input"`)
		}
	}
	if rawInput, ok := fields["input"]; ok && common.GetJsonType(rawInput) == "object" {
		var input map[string]json.RawMessage
		if err := common.Unmarshal(rawInput, &input); err != nil {
			return nil, fmt.Errorf("decode sanitized async image input: %w", err)
		}
		if len(inputObjectKeys) > 0 {
			for _, field := range []string{"images", "image_input", "input_urls"} {
				if _, ok := input[field]; ok {
					input[field] = encodedPlaceholders
				}
			}
			if _, ok := input["image"]; ok {
				input["image"] = json.RawMessage(`"r2-input"`)
			}
		}
		if hasStoredMask {
			if _, ok := input["mask"]; ok {
				input["mask"] = json.RawMessage(`"r2-input"`)
			}
		}
		encodedInput, err := common.Marshal(input)
		if err != nil {
			return nil, fmt.Errorf("encode sanitized async image input: %w", err)
		}
		fields["input"] = encodedInput
	}
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
		{container: "generationConfig", key: "candidateCount"},
		{container: "generationConfig", key: "candidate_count"},
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

func persistedAsyncImageRequest(req *dto.ImageRequest, inputObjectKeys []string, maskObjectKeys ...string) *dto.ImageRequest {
	if req == nil {
		return nil
	}
	persisted := *req
	persisted.Async = nil
	persisted.WebhookURL = ""
	persisted.WebhookSecret = ""
	persisted.Extra = nil
	if len(inputObjectKeys) > 0 {
		// Finite-lived signed URLs never belong in the durable checkpoint. The
		// worker reconstructs them from InputObjectKeys immediately before use.
		persisted.Images = nil
		persisted.Image = nil
	}
	if len(maskObjectKeys) > 0 && strings.TrimSpace(maskObjectKeys[0]) != "" {
		persisted.Mask = nil
	}
	return &persisted
}

func hydrateAsyncImageInputObjects(ctx context.Context, req *dto.ImageRequest, objectKeys []string, maskObjectKeys ...string) (*dto.ImageRequest, error) {
	if req == nil {
		return nil, errors.New("image request is required")
	}
	maskObjectKey := ""
	if len(maskObjectKeys) > 0 {
		maskObjectKey = strings.TrimSpace(maskObjectKeys[0])
	}
	if len(objectKeys) == 0 && maskObjectKey == "" {
		return req, nil
	}
	if len(objectKeys) > dto.MaxUnifiedImageInputURLs {
		return nil, fmt.Errorf("image input contains %d objects (max %d)", len(objectKeys), dto.MaxUnifiedImageInputURLs)
	}
	r2 := LoadR2Config()
	urls := make([]string, 0, len(objectKeys))
	for index, key := range objectKeys {
		signedURL, err := r2.PresignInputObject(ctx, key)
		if err != nil {
			return nil, fmt.Errorf("sign image input object %d: %w", index, err)
		}
		urls = append(urls, signedURL)
	}
	hydrated := *req
	if len(urls) > 0 {
		encodedURLs, err := common.Marshal(urls)
		if err != nil {
			return nil, fmt.Errorf("encode image input URLs: %w", err)
		}
		firstURL, err := common.Marshal(urls[0])
		if err != nil {
			return nil, fmt.Errorf("encode first image input URL: %w", err)
		}
		hydrated.Images = json.RawMessage(encodedURLs)
		hydrated.Image = json.RawMessage(firstURL)
	}
	if maskObjectKey != "" {
		maskURL, err := r2.PresignInputObject(ctx, maskObjectKey)
		if err != nil {
			return nil, fmt.Errorf("sign image mask object: %w", err)
		}
		encodedMask, err := common.Marshal(maskURL)
		if err != nil {
			return nil, fmt.Errorf("encode image mask URL: %w", err)
		}
		hydrated.Mask = json.RawMessage(encodedMask)
	}
	return &hydrated, nil
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

var asyncImageDurableHeaderNames = map[string]struct{}{
	"accept":              {},
	"content-type":        {},
	"traceparent":         {},
	"tracestate":          {},
	"x-client-request-id": {},
	"x-correlation-id":    {},
	"x-request-id":        {},
	"x-trace-id":          {},
}

// SanitizeAsyncImageClientHeaders returns the small protocol/trace allowlist
// that may be stored in a durable task. Arbitrary inbound proxy headers can
// carry credentials even when their names do not look sensitive.
func SanitizeAsyncImageClientHeaders(headers http.Header) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	values := make(map[string]string, len(asyncImageDurableHeaderNames))
	for key := range asyncImageDurableHeaderNames {
		if value := strings.TrimSpace(headers.Get(key)); value != "" {
			values[http.CanonicalHeaderKey(key)] = value
		}
	}
	return sanitizeAsyncImageHeaderMap(values)
}

func sanitizeAsyncImageHeaderMap(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	result := make(map[string]string, len(asyncImageDurableHeaderNames))
	totalSize := 0
	for key, value := range headers {
		normalizedKey := strings.ToLower(strings.TrimSpace(key))
		if _, allowed := asyncImageDurableHeaderNames[normalizedKey]; !allowed {
			continue
		}
		value = strings.TrimSpace(value)
		if value == "" || len(value) > 8<<10 {
			continue
		}
		canonicalKey := http.CanonicalHeaderKey(normalizedKey)
		totalSize += len(canonicalKey) + len(value)
		if totalSize > 16<<10 {
			break
		}
		result[canonicalKey] = value
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func copyAsyncImageHeaders(headers map[string]string) map[string]string {
	return sanitizeAsyncImageHeaderMap(headers)
}

// TryReplayAsyncImageTask handles an accepted idempotent request before channel
// selection and task billing. HTTP routes authenticate and rate-limit callers
// before invoking it.
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
	multipartBodyHash := ""
	if c.Request != nil && strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data") {
		canonicalHash, err := canonicalAsyncImageMultipartHash(c)
		if err != nil {
			return nil, "", err
		}
		multipartBodyHash = canonicalHash
	}
	relayMode := ""
	if c.Request != nil && c.Request.URL != nil && relayconstant.Path2RelayMode(c.Request.URL.Path) == relayconstant.RelayModeImagesEdits {
		relayMode = "edit"
	}
	requestIdentity, err := common.Marshal(struct {
		Request       *dto.ImageRequest          `json:"request"`
		Extra         map[string]json.RawMessage `json:"extra,omitempty"`
		WebhookURL    string                     `json:"webhook_url,omitempty"`
		WebhookSecret string                     `json:"webhook_secret,omitempty"`
		RelayMode     string                     `json:"relay_mode,omitempty"`
		MultipartHash string                     `json:"multipart_hash,omitempty"`
	}{
		Request:       canonicalAsyncImageRequest(req),
		Extra:         req.Extra,
		WebhookURL:    strings.TrimSpace(req.WebhookURL),
		WebhookSecret: req.WebhookSecret,
		RelayMode:     relayMode,
		MultipartHash: multipartBodyHash,
	})
	if err != nil {
		return nil, "", err
	}
	hashedID := common.GenerateHMAC(idempotencyKey)
	return &hashedID, common.GenerateHMAC(string(requestIdentity)), nil
}

type asyncImageMultipartIdentityPart struct {
	Field   string `json:"field"`
	Kind    string `json:"kind"`
	Ordinal int    `json:"ordinal"`
	Value   string `json:"value,omitempty"`
	Digest  string `json:"digest,omitempty"`
	Size    int64  `json:"size,omitempty"`
}

func canonicalAsyncImageMultipartHash(c *gin.Context) (string, error) {
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return "", fmt.Errorf("parse multipart image edit for idempotency: %w", err)
	}
	parts := make([]asyncImageMultipartIdentityPart, 0)
	for field, values := range form.Value {
		for ordinal, value := range values {
			parts = append(parts, asyncImageMultipartIdentityPart{
				Field:   field,
				Kind:    "value",
				Ordinal: ordinal,
				Value:   value,
			})
		}
	}
	for field, files := range form.File {
		for ordinal, fileHeader := range files {
			file, err := fileHeader.Open()
			if err != nil {
				return "", fmt.Errorf("open multipart image edit field %q for idempotency: %w", field, err)
			}
			reader := io.Reader(file)
			if common.IsAsyncImageDataURIFile(fileHeader.Header) {
				reader, _, err = asyncImageDataURIReader(file)
			}
			digest := sha256.New()
			size := int64(0)
			if err == nil {
				size, err = io.Copy(digest, reader)
			}
			closeErr := file.Close()
			if err != nil {
				return "", fmt.Errorf("hash multipart image edit field %q for idempotency: %w", field, err)
			}
			if closeErr != nil {
				return "", fmt.Errorf("close multipart image edit field %q after idempotency: %w", field, closeErr)
			}
			parts = append(parts, asyncImageMultipartIdentityPart{
				Field:   field,
				Kind:    "file",
				Ordinal: ordinal,
				Digest:  hex.EncodeToString(digest.Sum(nil)),
				Size:    size,
			})
		}
	}
	sort.Slice(parts, func(i, j int) bool {
		left, right := parts[i], parts[j]
		if left.Field != right.Field {
			return left.Field < right.Field
		}
		if left.Kind != right.Kind {
			return left.Kind < right.Kind
		}
		return left.Ordinal < right.Ordinal
	})
	encoded, err := common.Marshal(parts)
	if err != nil {
		return "", fmt.Errorf("encode multipart image edit idempotency identity: %w", err)
	}
	return common.GenerateHMAC(string(encoded)), nil
}

func canonicalAsyncImageRequest(req *dto.ImageRequest) *dto.ImageRequest {
	canonical := *req
	canonical.Extra = nil
	if canonical.N == nil || *canonical.N == 0 {
		canonical.N = common.GetPointer(uint(1))
	}
	switch canonical.Model {
	case "dall-e", "dall-e-2":
		if canonical.Size == "" {
			canonical.Size = "1024x1024"
		}
	case "dall-e-3":
		if canonical.Size == "" {
			canonical.Size = "1024x1024"
		}
		if canonical.Quality == "" {
			canonical.Quality = "standard"
		}
	case "gpt-image-1":
		if canonical.Quality == "" {
			canonical.Quality = "auto"
		}
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
	if utf8.RuneCountInString(req.Prompt) > dto.MaxUnifiedImagePromptLength {
		return fmt.Errorf("prompt is too long (max %d characters)", dto.MaxUnifiedImagePromptLength)
	}
	if req.Stream != nil && *req.Stream {
		return errors.New("stream=true is not supported for asynchronous image generation")
	}
	if req.N != nil && (*req.N == 0 || *req.N > dto.MaxImageN) {
		return fmt.Errorf("n must be an integer between 1 and %d", dto.MaxImageN)
	}
	return nil
}

// ValidateAsyncImageSubmission checks all request-only invariants before any
// reference image is fetched or written to object storage. SubmitAsyncImage
// repeats this validation at the durable task boundary.
func ValidateAsyncImageSubmission(originModel, upstreamModel string, req *dto.ImageRequest, knownInputSources ...bool) error {
	if req == nil {
		return errors.New("async image request is required")
	}
	if _, hasProviderInput := req.Extra["input"]; hasProviderInput {
		return errors.New("provider-native input is not supported by asynchronous image generation; use input.prompt and input.image_input")
	}
	if _, hasMessages := req.Extra["messages"]; hasMessages {
		return errors.New("input.messages is not supported by asynchronous image generation; use input.prompt and input.image_input")
	}
	if err := validateAsyncImageRequestExtensions(req); err != nil {
		return err
	}
	if err := validateAsyncImageRequest(req); err != nil {
		return err
	}
	hasKnownInputSources := len(knownInputSources) > 0 && knownInputSources[0]
	if err := validateAsyncImageModelInput(originModel, upstreamModel, req, hasKnownInputSources); err != nil {
		return err
	}
	// Validate against the model that will actually receive the request. The
	// origin name may be an alias with different size constraints.
	selectedModel := strings.TrimSpace(upstreamModel)
	if selectedModel == "" {
		selectedModel = strings.TrimSpace(req.Model)
	}
	if selectedModel == "" {
		selectedModel = strings.TrimSpace(originModel)
	}
	if IsGptImageModel(selectedModel) {
		// The final executor is selected later in ImageHelper. Validate the
		// shared shape here, but defer executor-specific output-count limits to
		// the Responses branch so adaptor-backed batch requests remain valid.
		if err := validateAsyncOpenAIImageRequest(req, selectedModel, false); err != nil {
			return err
		}
	}
	return nil
}

func validateAsyncImageRequestExtensions(req *dto.ImageRequest) error {
	if req == nil {
		return errors.New("async image request is required")
	}
	totalBytes := 0
	for key, raw := range req.Extra {
		totalBytes += len(key) + len(raw)
		if totalBytes > maxAsyncImageRequestExtensionBytes {
			return fmt.Errorf("image extension fields exceed %d bytes", maxAsyncImageRequestExtensionBytes)
		}
		if err := validateAsyncImageExtensionKey(key, key); err != nil {
			return err
		}
		if err := validateAsyncImageExtensionRaw(key, raw, 0); err != nil {
			return err
		}
	}

	rawFields := []struct {
		name string
		raw  json.RawMessage
	}{
		{name: "style", raw: req.Style},
		{name: "user", raw: req.User},
		{name: "extra_fields", raw: req.ExtraFields},
		{name: "background", raw: req.Background},
		{name: "moderation", raw: req.Moderation},
		{name: "output_format", raw: req.OutputFormat},
		{name: "output_compression", raw: req.OutputCompression},
		{name: "partial_images", raw: req.PartialImages},
		{name: "input_fidelity", raw: req.InputFidelity},
		{name: "watermark_enabled", raw: req.WatermarkEnabled},
		{name: "user_id", raw: req.UserId},
	}
	for _, field := range rawFields {
		trimmed := bytes.TrimSpace(field.raw)
		if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
			continue
		}
		totalBytes += len(field.name) + len(trimmed)
		if totalBytes > maxAsyncImageRequestExtensionBytes {
			return fmt.Errorf("image extension fields exceed %d bytes", maxAsyncImageRequestExtensionBytes)
		}
		if field.name == "extra_fields" && common.GetJsonType(trimmed) != "object" {
			return errors.New("extra_fields must be an object")
		}
		if err := validateAsyncImageExtensionRaw(field.name, trimmed, 0); err != nil {
			return err
		}
	}
	return nil
}

func validateAsyncImageExtensionRaw(path string, raw json.RawMessage, depth int) error {
	var value any
	if err := common.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("invalid %s: %w", path, err)
	}
	return validateAsyncImageExtensionValue(path, value, depth)
}

func validateAsyncImageExtensionValue(path string, value any, depth int) error {
	if depth > 32 {
		return fmt.Errorf("%s is nested too deeply", path)
	}
	switch typed := value.(type) {
	case map[string]any:
		for key, nested := range typed {
			childPath := path + "." + key
			if err := validateAsyncImageExtensionKey(key, childPath); err != nil {
				return err
			}
			if err := validateAsyncImageExtensionValue(childPath, nested, depth+1); err != nil {
				return err
			}
		}
	case []any:
		for index, nested := range typed {
			if err := validateAsyncImageExtensionValue(fmt.Sprintf("%s[%d]", path, index), nested, depth+1); err != nil {
				return err
			}
		}
	case string:
		if isAsyncImageExternalReferenceString(typed) {
			return fmt.Errorf("%s may not contain external or inline data URLs; use input.image_input", path)
		}
	}
	return nil
}

func isAsyncImageExternalReferenceString(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	if strings.HasPrefix(trimmed, "//") || hasAsyncImageURIScheme(trimmed) {
		return true
	}

	// Arbitrary extension fields must not become a second path for inline
	// reference images. Only a successful decode with a real image signature is
	// rejected, so ordinary provider option strings remain valid.
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding} {
		decoded, err := encoding.DecodeString(trimmed)
		if err != nil {
			continue
		}
		if _, ok := strictGenericImageFormat(decoded); ok {
			return true
		}
	}
	return false
}

func hasAsyncImageURIScheme(value string) bool {
	colon := strings.IndexByte(value, ':')
	if colon <= 0 {
		return false
	}
	for index, char := range value[:colon] {
		if index == 0 {
			if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') {
				return false
			}
			continue
		}
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') &&
			(char < '0' || char > '9') && char != '+' && char != '-' && char != '.' {
			return false
		}
	}
	return true
}

func validateAsyncImageExtensionKey(key, path string) error {
	if common.IsSensitiveHeaderName(splitAsyncImageCamelCaseKey(key)) {
		return fmt.Errorf("%s may not contain credentials or secrets", path)
	}
	if isAsyncImageSourceExtensionField(splitAsyncImageCamelCaseKey(key)) {
		return fmt.Errorf("%s may not carry an image source; use input.image_input", path)
	}
	return nil
}

func splitAsyncImageCamelCaseKey(key string) string {
	runes := []rune(key)
	var normalized strings.Builder
	normalized.Grow(len(key) + 4)
	for index, char := range runes {
		if index > 0 && char >= 'A' && char <= 'Z' {
			previous := runes[index-1]
			previousIsLowerOrDigit := (previous >= 'a' && previous <= 'z') || (previous >= '0' && previous <= '9')
			nextIsLower := index+1 < len(runes) && runes[index+1] >= 'a' && runes[index+1] <= 'z'
			previousIsUpper := previous >= 'A' && previous <= 'Z'
			if previousIsLowerOrDigit || (previousIsUpper && nextIsLower) {
				normalized.WriteByte('-')
			}
		}
		normalized.WriteRune(char)
	}
	return normalized.String()
}

func isAsyncImageSourceExtensionField(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	normalized = strings.NewReplacer("-", "_", ".", "_", " ", "_").Replace(normalized)
	switch normalized {
	case "image", "images", "image_prompt", "image_url", "image_urls", "image_uri", "image_uris",
		"image_input", "input_image", "input_images", "input_image_url", "input_image_urls", "input_urls",
		"reference_image", "reference_images", "reference_image_url", "reference_image_urls",
		"source_image", "source_images", "source_image_url", "source_image_urls",
		"init_image", "init_images", "mask", "mask_image", "mask_images",
		"image_base64", "image_data", "image_data_base64", "base64_image", "base64_images",
		"binary_data", "binary_data_base64":
		return true
	}
	if isNumberedAsyncImageField(normalized) {
		return true
	}
	return strings.HasSuffix(normalized, "_image") ||
		strings.HasSuffix(normalized, "_images") ||
		strings.HasSuffix(normalized, "_image_url") ||
		strings.HasSuffix(normalized, "_image_urls") ||
		strings.HasSuffix(normalized, "_image_base64")
}

func isNumberedAsyncImageField(key string) bool {
	for _, prefix := range []string{"image", "image_", "reference_image_", "source_image_", "input_image_", "init_image_", "mask_image_"} {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		suffix := strings.TrimPrefix(key, prefix)
		if suffix == "" {
			continue
		}
		allDigits := true
		for _, char := range suffix {
			if char < '0' || char > '9' {
				allDigits = false
				break
			}
		}
		if allDigits {
			return true
		}
	}
	return false
}

func encodeAsyncImageTaskPayload(payload asyncImageTaskPayload) ([]byte, error) {
	encoded, err := common.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode async image task: %w", err)
	}
	if len(encoded) > maxAsyncImageCheckpointBytes {
		return nil, fmt.Errorf("async image task payload exceeds %d bytes", maxAsyncImageCheckpointBytes)
	}
	return encoded, nil
}

// ValidateAsyncImageDelivery checks object-storage and webhook configuration
// before the request downloads any user-supplied reference image.
func ValidateAsyncImageDelivery(req *dto.ImageRequest) *types.NewAPIError {
	if req == nil {
		return types.NewErrorWithStatusCode(errors.New("async image request is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if !LoadR2Config().Enabled() {
		return types.NewErrorWithStatusCode(
			errors.New("async image generation requires CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, and CLOUDFLARE_R2_PUBLIC_BASE"),
			types.ErrorCodeInvalidRequest,
			http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if !common.StableCryptoSecretConfigured() {
		return types.NewErrorWithStatusCode(
			errors.New("async image generation requires a stable CRYPTO_SECRET"),
			types.ErrorCodeInvalidRequest,
			http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if !common.AsyncImageEncryptedWritesEnabled() {
		return types.NewErrorWithStatusCode(
			errors.New("async image generation requires ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED=true"),
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
	return nil
}

func validateAsyncImageModelInput(originModel, upstreamModel string, req *dto.ImageRequest, knownInputSources ...bool) error {
	imageURLs, err := asyncImageInputURLs(req)
	if err != nil {
		return err
	}
	models := []string{originModel, upstreamModel, req.Model}
	hasInputSources := len(imageURLs) > 0 || (len(knownInputSources) > 0 && knownInputSources[0])
	for _, model := range models {
		model = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(model), "models/"))
		if strings.HasSuffix(model, "-image-to-image") && !hasInputSources {
			return errors.New("input_urls is required for image-to-image models")
		}
		capabilities := common.ImageModelCapabilitiesForModel(model)
		if capabilities.ReferenceImagesRequired && !hasInputSources {
			return fmt.Errorf("image_input is required for image edit model %s", model)
		}
		if capabilities.Family == common.ImageModelFamilyGeminiFlash31 ||
			capabilities.Family == common.ImageModelFamilyGeminiPro3 ||
			capabilities.Family == common.ImageModelFamilyGeminiLegacy {
			if capabilities.MaxReferenceImages > 0 && len(imageURLs) > capabilities.MaxReferenceImages {
				return fmt.Errorf("%s supports at most %d input images", model, capabilities.MaxReferenceImages)
			}
		}
	}
	return nil
}

func asyncImageInputURLs(req *dto.ImageRequest) ([]string, error) {
	if req == nil {
		return nil, errors.New("async image request is required")
	}
	urls, err := req.ImageInputURLs()
	if err != nil {
		return nil, fmt.Errorf("invalid images: %w", err)
	}
	if len(urls) > 0 || len(bytes.TrimSpace(req.Image)) == 0 || common.GetJsonType(req.Image) == "null" {
		return urls, nil
	}
	probe := *req
	probe.Images = append(json.RawMessage(nil), req.Image...)
	urls, err = probe.ImageInputURLs()
	if err != nil {
		return nil, fmt.Errorf("invalid image: %w", err)
	}
	return urls, nil
}

func runAsyncImageWork(ctx context.Context) (result asyncImageRunResult, runErr error) {
	if _, _, err := model.DrainDueImageTaskBillingLogOutbox(asyncImageWebhookBatch); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("drain image billing log outbox: %s", common.MaskSensitiveInfo(err.Error())))
	}
	inputsDeleted, inputsRetried, cleanupErr := drainDueImageInputCleanups(ctx)
	result.InputsDeleted += inputsDeleted
	result.InputsRetried += inputsRetried
	if cleanupErr != nil {
		logger.LogWarn(ctx, fmt.Sprintf("drain image input cleanup outbox: %s", common.MaskSensitiveInfo(cleanupErr.Error())))
	}
	recoveredReservations, err := model.RecoverStaleImageBillingReservations(
		time.Now().Add(-asyncImageReservationStaleAfter).Unix(),
		asyncImageBatchSize,
		"async image submission did not complete",
	)
	result.Failed += recoveredReservations
	if err != nil {
		// A damaged reservation must remain visible for operator repair without
		// blocking unrelated image tasks behind it.
		logger.LogWarn(ctx, fmt.Sprintf("recover stale image billing reservations: %s", common.MaskSensitiveInfo(err.Error())))
	}

	recoveredCompleted, recoveredFailed, err := recoverFinalizingImageTasks(ctx)
	result.Completed += recoveredCompleted
	result.Failed += recoveredFailed
	if err != nil {
		return result, err
	}
	ambiguousFailed, err := recoverCheckpointPendingImageTasks(ctx)
	result.Failed += ambiguousFailed
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

func recoverCheckpointPendingImageTasks(ctx context.Context) (int, error) {
	failed := 0
	for {
		if err := ctx.Err(); err != nil {
			return failed, err
		}
		tasks, err := model.FindCheckpointPendingImageTasks(
			time.Now().Add(-asyncImageWorkerStaleAfter).Unix(),
			asyncImageBatchSize,
		)
		if err != nil {
			return failed, fmt.Errorf("find checkpoint-pending image tasks: %w", err)
		}
		if len(tasks) == 0 {
			return failed, nil
		}
		for _, task := range tasks {
			if err := failAmbiguousAsyncImageTask(ctx, task); err != nil {
				return failed, err
			}
			failed++
		}
	}
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
	var err error
	if len(checkpoint) == 0 {
		checkpoint = task.Data
	} else {
		checkpoint, err = model.DecryptImageTaskArtifactCheckpoint(checkpoint)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("decrypt image task checkpoint: %w", err))
		}
	}
	payload, err := decodeAsyncImageTaskPayload(checkpoint)
	if err != nil {
		return false, failAsyncImageTask(ctx, task, fmt.Errorf("decode image request: %w", err))
	}
	if task.Status == model.TaskStatusCheckpointPending || (payload.ProviderCallStarted && !payload.ProviderStored && !payload.ArtifactStored) {
		// The live worker owns CHECKPOINT_PENDING until its lease is stale. Calling
		// this function directly with a fresh row must not race it into a refund.
		if task.UpdatedAt > time.Now().Add(-asyncImageWorkerStaleAfter).Unix() {
			return false, errAsyncImageRetryScheduled
		}
		return false, failAmbiguousAsyncImageTask(ctx, task)
	}
	request := payload.Request
	if request == nil {
		return false, failAsyncImageTask(ctx, task, errors.New("image request is missing"))
	}
	if len(payload.InputObjectKeys) > 0 {
		select {
		case asyncImageInputExecutionSemaphore <- struct{}{}:
			defer func() { <-asyncImageInputExecutionSemaphore }()
		case <-ctx.Done():
			return false, ctx.Err()
		}
	}
	outputLease := &asyncImageOutputLease{}
	defer outputLease.release()

	aggregated := payload.Upstream
	var genericArtifact *genericImageArtifact
	var genericUpstream *GenericImageUpstreamResponse
	if payload.ArtifactStored || payload.ProviderStored {
		if err := outputLease.acquire(ctx); err != nil {
			return false, err
		}
		artifact, err := loadAsyncImageTaskArtifact(task.TaskID)
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
		if payload.PreparedRequest == nil || (!payload.PreparedRequest.DeferConversion && len(payload.PreparedRequest.Body) == 0) {
			return false, failAsyncImageTask(ctx, task, errors.New("prepared provider image request is missing"))
		}
		channel, apiKey, err := loadAsyncImageChannel(task, payload.PreparedRequest, payload.ProviderStored)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, err)
		}
		genericInfo := genericAsyncImageRelayInfo(task, channel, apiKey, payload.PreparedRequest, payload.RelayMode)
		executionRequest := request
		if genericUpstream == nil {
			executionRequest, err = hydrateAsyncImageInputObjects(ctx, request, payload.InputObjectKeys, payload.MaskObjectKey)
			if err != nil {
				return false, failAsyncImageTask(ctx, task, fmt.Errorf("prepare staged image inputs: %w", err))
			}
		}
		attemptStart := time.Now()
		executionCtx, cancel := context.WithTimeout(ctx, asyncImageUpstreamTimeout)
		passThroughBody := payload.PreparedRequest.Body
		if payload.PreparedRequest.DeferConversion {
			passThroughBody = nil
		}
		result, apiErr := ExecuteGenericImageAdaptor(executionCtx, &GenericImageExecutionRequest{
			RelayInfo:        genericInfo,
			ImageRequest:     executionRequest,
			PassThroughBody:  passThroughBody,
			UpstreamResponse: genericUpstream,
			BeforeResponseRead: func() error {
				return outputLease.acquire(executionCtx)
			},
			AfterResponseCheckpoint: func(responseBytes int) {
				if responseBytes <= maxAsyncImagePollingCheckpointBytes {
					outputLease.release()
				}
			},
			BeforeResultWrite: func() error {
				return outputLease.acquire(executionCtx)
			},
			BeforeProviderCall: func() error {
				started, startErr := beginAsyncImageProviderCall(task, &payload)
				if startErr != nil {
					return fmt.Errorf("begin provider image submission: %w", startErr)
				}
				if !started {
					return errors.New("image task claim was lost before provider submission")
				}
				return nil
			},
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
				checkpointPayload.ProviderCallStarted = false
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
			// ProviderCallStarted is durable before ExecuteGenericImageAdaptor.
			// Any error before a provider response checkpoint is therefore
			// ambiguous; reopening the submission would risk double generation.
			if errors.Is(apiErr, ErrGenericImageCheckpoint) {
				return false, failAmbiguousAsyncImageTask(ctx, task)
			}
			definitiveResponse := errors.Is(apiErr, ErrGenericImageDefinitiveResponse)
			if definitiveResponse && genericUpstream == nil && payload.ProviderCallStarted {
				reopenedPayload := payload
				reopenedPayload.ProviderCallStarted = false
				checkpointData, checkpointErr := encodeAsyncImageTaskPayload(reopenedPayload)
				if checkpointErr != nil {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				storedCheckpoint, checkpointErr := model.EncryptImageTaskArtifactCheckpoint(checkpointData)
				if checkpointErr != nil {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				reopened, checkpointErr := task.ReopenRejectedImageProviderCall(storedCheckpoint)
				if checkpointErr != nil || !reopened {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				payload = reopenedPayload
			}
			if genericUpstream == nil && payload.ProviderCallStarted {
				return false, failAmbiguousAsyncImageTask(ctx, task)
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
			deferredConversionRetry := payload.PreparedRequest != nil &&
				payload.PreparedRequest.DeferConversion &&
				apiErr.GetErrorCode() == types.ErrorCodeConvertRequestFailed
			retrySubmission := !payload.ProviderStored && (executionErr != nil || deferredConversionRetry || retryableAsyncImageSubmissionError(apiErr))
			if retrySubmission {
				// Deferred conversion reads staged reference images from object
				// storage. A transient CDN/R2 read failure is a task-local retry and
				// must not mark an otherwise healthy provider channel as unavailable.
				if !deferredConversionRetry {
					service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, asyncImageHealthPath(payload), genericInfo, attemptStart, apiErr, false)
					service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiErr)
				}
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
			service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, asyncImageHealthPath(payload), genericInfo, attemptStart, apiErr, false)
			service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiErr)
			return false, failAsyncImageTask(ctx, task, apiErr)
		}
		if result == nil || result.Response == nil || len(result.Response.Data) == 0 {
			return false, failAsyncImageTask(ctx, task, errors.New("provider returned no image response"))
		}
		service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, asyncImageHealthPath(payload), genericInfo, attemptStart, nil, false)
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
		if err := outputLease.acquire(ctx); err != nil {
			return false, err
		}
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
		apiKey, apiErr := imageTaskChannelKey(channel, task.PrivateData)
		if apiErr != nil {
			return false, failAsyncImageTask(ctx, task, apiErr)
		}
		executionRequest, err := hydrateAsyncImageInputObjects(ctx, request, payload.InputObjectKeys, payload.MaskObjectKey)
		if err != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("prepare staged image inputs: %w", err))
		}
		started, startErr := beginAsyncImageProviderCall(task, &payload)
		if startErr != nil {
			return false, failAsyncImageTask(ctx, task, fmt.Errorf("begin Responses image submission: %w", startErr))
		}
		if !started {
			return true, nil
		}
		attemptStart := time.Now()
		var upstreamErr error
		aggregated, upstreamErr = requestAsyncImageUpstreamWithLease(
			ctx,
			baseURL,
			apiKey,
			proxy,
			task.Properties.UpstreamModelName,
			task.TaskID,
			executionRequest,
			outputLease,
			payload.RelayMode,
		)
		if upstreamErr == nil {
			service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, asyncImageHealthPath(payload), nil, attemptStart, nil, false)
		} else {
			var validationErr *imageRequestValidationError
			if errors.As(upstreamErr, &validationErr) {
				return false, failAmbiguousAsyncImageTask(ctx, task)
			}
			statusCode := asyncImageUpstreamStatus(upstreamErr)
			apiError := types.NewErrorWithStatusCode(upstreamErr, types.ErrorCodeBadResponse, statusCode, types.ErrOptionWithSkipRetry())
			service.RecordChannelHealthOutcome(channel.Id, task.Properties.OriginModelName, asyncImageHealthPath(payload), nil, attemptStart, apiError, false)
			service.CooldownChannelForUpstreamError(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, apiKey, channel.GetAutoBan()), apiError)
		}
		if upstreamErr != nil {
			var upstreamResponseErr *asyncImageUpstreamError
			if errors.As(upstreamErr, &upstreamResponseErr) && upstreamResponseErr.definitiveResponse {
				reopenedPayload := payload
				reopenedPayload.ProviderCallStarted = false
				checkpointData, checkpointErr := encodeAsyncImageTaskPayload(reopenedPayload)
				if checkpointErr != nil {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				storedCheckpoint, checkpointErr := model.EncryptImageTaskArtifactCheckpoint(checkpointData)
				if checkpointErr != nil {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				reopened, checkpointErr := task.ReopenRejectedImageProviderCall(storedCheckpoint)
				if checkpointErr != nil || !reopened {
					return false, failAmbiguousAsyncImageTask(ctx, task)
				}
				payload = reopenedPayload
				if retryableAsyncImageStatus(upstreamResponseErr.statusCode) && task.ProviderAttempts+1 < asyncImageProviderAttempts {
					delay := asyncImageRetryDelay(task.ProviderAttempts)
					scheduled, scheduleErr := task.MarkImageSubmissionRetry(time.Now().Add(delay).Unix(), common.MaskSensitiveInfo(upstreamErr.Error()))
					if scheduleErr != nil {
						return false, fmt.Errorf("schedule Responses image submission retry for task %s: %w", task.TaskID, scheduleErr)
					}
					if scheduled {
						return false, errAsyncImageRetryScheduled
					}
				}
				return false, failAsyncImageTask(ctx, task, upstreamErr)
			}
			// Responses/SSE cannot distinguish a pre-send transport failure from
			// an accepted request whose response was lost. Quarantine instead of
			// relying on provider idempotency semantics.
			return false, failAmbiguousAsyncImageTask(ctx, task)
		}
	}
	if payload.Executor != AsyncImageExecutorAdaptor && aggregated == nil {
		return false, failAmbiguousAsyncImageTask(ctx, task)
	}
	if !payload.ArtifactStored && payload.Executor != AsyncImageExecutorAdaptor {
		// Store large output in bounded SQL chunks rather than in the task row.
		// This preserves the generated image across worker/R2 failures without
		// exceeding common MySQL packet limits or invoking the provider again.
		if err := outputLease.acquire(ctx); err != nil {
			return false, err
		}
		artifact, err := common.Marshal(aggregated)
		if err != nil {
			return false, failAmbiguousAsyncImageTask(ctx, task)
		}
		payload.ArtifactStored = true
		payload.ProviderCallStarted = false
		checkpointData, err := common.Marshal(payload)
		if err != nil {
			return false, failAmbiguousAsyncImageTask(ctx, task)
		}
		persisted, err := persistAsyncImageArtifact(ctx, task, checkpointData, artifact, "70%")
		if err != nil {
			return false, failAmbiguousAsyncImageTask(ctx, task)
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
	if prepared.AdvancedRouteHash != "" {
		currentSettings := channel.GetOtherSettings()
		currentRoute, ok := currentSettings.AdvancedCustom.MatchPathForModel(prepared.RequestURLPath, task.Properties.OriginModelName)
		if !ok {
			return nil, "", errors.New("advanced image route changed after task submission")
		}
		currentRouteHash, err := AsyncImageAdvancedRouteFingerprint(currentRoute)
		if err != nil {
			return nil, "", fmt.Errorf("fingerprint current advanced image route: %w", err)
		}
		if currentRouteHash != prepared.AdvancedRouteHash {
			return nil, "", errors.New("advanced image route changed after task submission")
		}
	} else if prepared.AdvancedRoute != nil {
		// Legacy checkpoints stored a redacted route snapshot.
		currentSettings := channel.GetOtherSettings()
		currentRoute, ok := currentSettings.AdvancedCustom.MatchPathForModel(prepared.RequestURLPath, task.Properties.OriginModelName)
		if !ok || !sameAsyncImageAdvancedRouteStructure(*prepared.AdvancedRoute, currentRoute) {
			return nil, "", errors.New("advanced image route changed after task submission")
		}
	} else if prepared.ChannelType == constant.ChannelTypeAdvancedCustom {
		return nil, "", errors.New("advanced image route fingerprint is missing")
	}
	currentParamOverride := channel.GetParamOverride()
	currentHeadersOverride := channel.GetHeaderOverride()
	if prepared.ExecutionOverrideStored {
		currentHash, err := AsyncImageExecutionOverrideFingerprint(currentParamOverride, currentHeadersOverride)
		if err != nil {
			return nil, "", fmt.Errorf("fingerprint current image channel overrides: %w", err)
		}
		if currentHash != prepared.ExecutionOverrideHash {
			return nil, "", errors.New("image channel overrides changed after task submission")
		}
	} else if len(currentParamOverride) > 0 || len(currentHeadersOverride) > 0 {
		return nil, "", errors.New("image channel override snapshot is missing")
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

func sameAsyncImageAdvancedRouteStructure(left, right dto.AdvancedCustomRoute) bool {
	left.Auth = nil
	right.Auth = nil
	left.IncomingPath = strings.TrimSpace(left.IncomingPath)
	left.UpstreamPath = strings.TrimSpace(left.UpstreamPath)
	left.Converter = strings.TrimSpace(left.Converter)
	right.IncomingPath = strings.TrimSpace(right.IncomingPath)
	right.UpstreamPath = strings.TrimSpace(right.UpstreamPath)
	right.Converter = strings.TrimSpace(right.Converter)
	leftJSON, leftErr := common.Marshal(left)
	rightJSON, rightErr := common.Marshal(right)
	return leftErr == nil && rightErr == nil && bytes.Equal(leftJSON, rightJSON)
}

func genericAsyncImageRelayInfo(task *model.Task, channel *model.Channel, apiKey string, prepared *PreparedAsyncImageRequest, relayModes ...int) *relaycommon.RelayInfo {
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
	currentParamOverride := channel.GetParamOverride()
	paramOverride := currentParamOverride
	currentHeadersOverride := channel.GetHeaderOverride()
	headersOverride := copyAsyncImageHeaderOverrides(currentHeadersOverride)
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
		// Do not trust or replay header overrides from an old checkpoint. Channel
		// credentials and custom provider headers are both resolved atomically
		// from the current channel configuration.
		headersOverride = copyAsyncImageHeaderOverrides(currentHeadersOverride)
	}
	headersOverride["Idempotency-Key"] = task.TaskID
	if prepared.AdvancedRouteHash != "" || prepared.AdvancedRoute != nil {
		if currentChannelOtherSettings.AdvancedCustom != nil {
			currentRoute, ok := currentChannelOtherSettings.AdvancedCustom.MatchPathForModel(prepared.RequestURLPath, task.Properties.OriginModelName)
			if ok {
				channelOtherSettings.AdvancedCustom = &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{currentRoute}}
			}
		}
	}
	channelBaseURL := prepared.ChannelBaseURL
	if channelBaseURL == "" {
		channelBaseURL = channel.GetBaseURL()
	}
	relayMode := prepared.RelayMode
	if len(relayModes) > 0 && relayModes[0] != relayconstant.RelayModeUnknown {
		relayMode = relayModes[0]
	}
	if relayMode == relayconstant.RelayModeUnknown {
		relayMode = relayconstant.RelayModeImagesGenerations
	}
	requestURLPath := prepared.RequestURLPath
	if requestURLPath == "" {
		requestURLPath = "/v1/images/generations"
		if relayMode == relayconstant.RelayModeImagesEdits {
			requestURLPath = "/v1/images/edits"
		}
	}
	return &relaycommon.RelayInfo{
		RequestId:       task.TaskID,
		StartTime:       time.Now(),
		RelayMode:       relayMode,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: task.Properties.OriginModelName,
		RequestURLPath:  requestURLPath,
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
			ParamOverride:        paramOverride,
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

// AsyncImageExecutionOverrideFingerprint binds a task to the non-persisted
// parameter and header override configuration used for validation and pricing.
// The HMAC lets the worker detect drift without storing credential-bearing
// override values in the task row.
func AsyncImageExecutionOverrideFingerprint(paramOverride, headersOverride map[string]interface{}) (string, error) {
	encoded, err := common.Marshal(struct {
		ParamOverride   map[string]interface{} `json:"param_override,omitempty"`
		HeadersOverride map[string]interface{} `json:"headers_override,omitempty"`
	}{
		ParamOverride:   paramOverride,
		HeadersOverride: headersOverride,
	})
	if err != nil {
		return "", err
	}
	return common.GenerateHMAC(string(encoded)), nil
}

// AsyncImageAdvancedRouteFingerprint binds a task to the complete current
// Advanced Custom route without persisting a credential-bearing target path or
// authentication value in the task checkpoint.
func AsyncImageAdvancedRouteFingerprint(route dto.AdvancedCustomRoute) (string, error) {
	encoded, err := common.Marshal(route)
	if err != nil {
		return "", err
	}
	return common.GenerateHMAC(string(encoded)), nil
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
		persisted, err := persistAsyncImageTaskArtifact(task, checkpointData, artifact, progress)
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

func beginAsyncImageProviderCall(task *model.Task, payload *asyncImageTaskPayload) (bool, error) {
	if task == nil || payload == nil {
		return false, errors.New("image task provider call state is required")
	}
	if payload.ProviderStored || payload.ArtifactStored {
		return true, nil
	}
	if payload.ProviderCallStarted || task.Status == model.TaskStatusCheckpointPending {
		return false, errors.New("provider image outcome is ambiguous after an interrupted checkpoint")
	}

	startedPayload := *payload
	startedPayload.ProviderCallStarted = true
	checkpointData, err := encodeAsyncImageTaskPayload(startedPayload)
	if err != nil {
		return false, err
	}
	storedCheckpoint, err := model.EncryptImageTaskArtifactCheckpoint(checkpointData)
	if err != nil {
		return false, fmt.Errorf("encrypt image provider call checkpoint: %w", err)
	}
	started, err := task.BeginImageTaskProviderCall(storedCheckpoint)
	if err != nil || !started {
		return started, err
	}
	*payload = startedPayload
	return true, nil
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
		if payload.RelayMode == relayconstant.RelayModeUnknown && payload.PreparedRequest != nil {
			payload.RelayMode = payload.PreparedRequest.RelayMode
		}
		if payload.RelayMode == relayconstant.RelayModeUnknown {
			// Checkpoints written before relay_mode was introduced were all image
			// generations. Keep them executable during rolling upgrades.
			payload.RelayMode = relayconstant.RelayModeImagesGenerations
		}
		if payload.RelayMode != relayconstant.RelayModeImagesGenerations && payload.RelayMode != relayconstant.RelayModeImagesEdits {
			return payload, fmt.Errorf("unsupported persisted image relay mode %d", payload.RelayMode)
		}
		if payload.PreparedRequest != nil {
			if payload.PreparedRequest.RelayMode == relayconstant.RelayModeUnknown {
				payload.PreparedRequest.RelayMode = payload.RelayMode
			} else if payload.PreparedRequest.RelayMode != payload.RelayMode {
				return payload, errors.New("persisted image relay mode does not match prepared request")
			}
		}
		return payload, nil
	}
	request := &dto.ImageRequest{}
	if err := common.Unmarshal(data, request); err != nil {
		return payload, err
	}
	payload.Request = request
	payload.RelayMode = relayconstant.RelayModeImagesGenerations
	return payload, nil
}

func asyncImageHealthPath(payload asyncImageTaskPayload) string {
	if payload.PreparedRequest != nil && strings.TrimSpace(payload.PreparedRequest.RequestURLPath) != "" {
		return payload.PreparedRequest.RequestURLPath
	}
	if payload.RelayMode == relayconstant.RelayModeImagesEdits {
		return "/v1/images/edits"
	}
	return "/v1/images/generations"
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

func failAmbiguousAsyncImageTask(ctx context.Context, task *model.Task) error {
	if task == nil {
		return errors.New("ambiguous image task is required")
	}
	reason := "provider image outcome is ambiguous after an interrupted checkpoint; automatic resubmission was blocked"
	task.FailReason = reason
	task.CheckpointData = nil
	task.PrivateData.FinalQuotaClamp = nil
	won, err := task.TransitionCheckpointPendingImageTaskToFinalizing(model.TaskStatusFailure, 0)
	if err != nil {
		return fmt.Errorf("quarantine ambiguous image task %s: %w", task.TaskID, err)
	}
	if won {
		if _, err := finalizePersistedImageTask(ctx, task.TaskID); err != nil {
			return err
		}
	}
	return nil
}

func requestAsyncImageUpstream(ctx context.Context, baseURL, apiKey, proxy, modelOverride, taskID string, req *dto.ImageRequest, relayModes ...int) (*UpstreamResponse, error) {
	return requestAsyncImageUpstreamWithLease(ctx, baseURL, apiKey, proxy, modelOverride, taskID, req, nil, relayModes...)
}

func requestAsyncImageUpstreamWithLease(
	ctx context.Context,
	baseURL, apiKey, proxy, modelOverride, taskID string,
	req *dto.ImageRequest,
	outputLease *asyncImageOutputLease,
	relayModes ...int,
) (*UpstreamResponse, error) {
	relayMode := relayconstant.RelayModeImagesGenerations
	if len(relayModes) > 0 && relayModes[0] != relayconstant.RelayModeUnknown {
		relayMode = relayModes[0]
	}
	upstreamRequest, err := buildAsyncImageResponsesRequest(ctx, req, modelOverride, relayMode)
	if err != nil {
		return nil, &imageRequestValidationError{err: fmt.Errorf("validate image request: %w", err)}
	}
	body, err := common.Marshal(upstreamRequest)
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
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, &asyncImageUpstreamError{
			statusCode:         resp.StatusCode,
			definitiveResponse: true,
			err:                fmt.Errorf("upstream returned status %d", resp.StatusCode),
		}
	}
	var streamLease *sseOutputLease
	if outputLease != nil {
		streamLease = &sseOutputLease{
			acquire: func() (bool, error) {
				return outputLease.acquireNew(requestCtx)
			},
			release: outputLease.release,
		}
	}
	aggregated, err := aggregateResponseStream(resp.Body, streamLease)
	if err != nil {
		return nil, &asyncImageUpstreamError{statusCode: http.StatusBadGateway, err: err}
	}
	return aggregated, nil
}

func buildAsyncImageResponsesRequest(ctx context.Context, req *dto.ImageRequest, modelOverride string, relayMode int) (responsesRequest, error) {
	if relayMode != relayconstant.RelayModeImagesEdits {
		return buildGenerationsRequestWithError(req, modelOverride)
	}
	if req == nil {
		return responsesRequest{}, errors.New("image request is required")
	}
	urls, err := asyncImageInputURLs(req)
	if err != nil {
		return responsesRequest{}, err
	}
	if len(urls) == 0 {
		return responsesRequest{}, errors.New("image is required for asynchronous image edits")
	}
	form := &multipart.Form{Value: map[string][]string{"image": urls}}
	images, err := CollectAndNormalizeImages(ctx, form)
	if err != nil {
		return responsesRequest{}, fmt.Errorf("materialize staged edit image: %w", err)
	}
	outputFormat, err := rawStringField(req.OutputFormat, "output_format")
	if err != nil {
		return responsesRequest{}, err
	}
	background, err := rawStringField(req.Background, "background")
	if err != nil {
		return responsesRequest{}, err
	}
	moderation, err := rawStringField(req.Moderation, "moderation")
	if err != nil {
		return responsesRequest{}, err
	}
	var outputCompression any
	if len(bytes.TrimSpace(req.OutputCompression)) > 0 && common.GetJsonType(req.OutputCompression) != "null" {
		if err := common.Unmarshal(req.OutputCompression, &outputCompression); err != nil {
			return responsesRequest{}, fmt.Errorf("invalid output_compression: %w", err)
		}
	}
	return buildEditsRequest(
		req.Prompt,
		images,
		req.Model,
		modelOverride,
		req.Size,
		req.Quality,
		outputFormat,
		background,
		moderation,
		outputCompression,
	), nil
}

func asyncImageUpstreamStatus(err error) int {
	var validationErr *imageRequestValidationError
	if errors.As(err, &validationErr) {
		return http.StatusBadRequest
	}
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
			webhookURL, secret, err := webhook.DeliveryCredentials()
			if err != nil {
				const message = "webhook credentials decryption failed"
				if persistErr := model.MarkTaskWebhookFailed(webhook, message); persistErr != nil {
					results <- deliveryResult{err: fmt.Errorf("quarantine webhook with unreadable secret for task %s: %w", webhook.TaskID, persistErr)}
					return
				}
				logger.LogWarn(ctx, fmt.Sprintf("async image webhook quarantined: task=%s reason=%s", webhook.TaskID, message))
				results <- deliveryResult{}
				return
			}
			if err := sendAsyncImageWebhook(ctx, webhookURL, secret, webhook.DeliveryID(), BuildImageTaskResponse(task)); err != nil {
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
