package relay

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

type twoPhaseImageRequestAdaptor interface {
	PrepareImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error)
	FinalizeImageRequest(*gin.Context, *relaycommon.RelayInfo, []byte) (any, error)
}

type imageSubmissionStartedError interface {
	ImageSubmissionStarted() bool
}

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	hadBillingSession := info.Billing != nil
	previousBillingRequestInput := info.BillingRequestInput
	retainFailedAttemptBillingInput := false
	defer func() {
		if newAPIError != nil && hadBillingSession && !retainFailedAttemptBillingInput {
			info.BillingRequestInput = previousBillingRequestInput
		}
	}()

	info.InitChannelMeta(c)
	info.BillingImageCount = nil
	info.ImageRequestCount = 0

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		form := c.Request.MultipartForm
		if form == nil {
			var parseErr error
			form, parseErr = common.ParseMultipartFormReusable(c)
			if parseErr != nil {
				return types.NewErrorWithStatusCode(fmt.Errorf("invalid image multipart request: %w", parseErr), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			c.Request.MultipartForm = form
			c.Request.PostForm = form.Value
		}
		if fieldErr := helper.ValidateImageMultipartFileFields(form); fieldErr != nil {
			return types.NewErrorWithStatusCode(fieldErr, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}

	request, copyErr := common.DeepCopy(imageReq)
	if copyErr != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", copyErr), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	billingRequest, billingCopyErr := common.DeepCopy(imageReq)
	if billingCopyErr != nil {
		return types.NewError(fmt.Errorf("failed to copy billing request to ImageRequest: %w", billingCopyErr), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if mappingErr := helper.ModelMappedHelper(c, info, request); mappingErr != nil {
		return types.NewError(mappingErr, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	imageCount, countErr := request.ImageCount(false)
	if countErr != nil {
		return types.NewErrorWithStatusCode(countErr, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	var requestBody io.Reader
	var jsonData []byte
	var outboundBilling *helper.OutboundImageBilling
	outboundSchemaConfirmed := false
	var finalizer twoPhaseImageRequestAdaptor
	var err error

	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, storageErr := common.GetBodyStorage(c)
		if storageErr != nil {
			return types.NewErrorWithStatusCode(storageErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			outboundBilling, err = helper.ResolveOutboundImageBillingMultipart(
				info,
				c.Request.Header.Get("Content-Type"),
				common.NewReplayableBodyReader(storage),
			)
			if err != nil {
				return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			if _, err = storage.Seek(0, io.SeekStart); err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			requestBody = common.NewReplayableBodyReader(storage)
		} else {
			jsonData, err = storage.Bytes()
			if err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
	} else {
		var convertedRequest any
		var convertErr error
		if candidate, ok := adaptor.(twoPhaseImageRequestAdaptor); ok && info.RelayMode == relayconstant.RelayModeImagesEdits {
			finalizer = candidate
			convertedRequest, convertErr = candidate.PrepareImageRequest(c, info, *request)
		} else {
			convertedRequest, convertErr = adaptor.ConvertImageRequest(c, info, *request)
		}
		if convertErr != nil {
			// An adaptor that already classified its rejection (status code
			// and retry policy) keeps that classification instead of being
			// downgraded to a retryable conversion failure.
			var apiErr *types.NewAPIError
			if errors.As(convertErr, &apiErr) {
				return apiErr
			}
			return types.NewError(convertErr, types.ErrorCodeConvertRequestFailed)
		}
		outboundSchemaConfirmed = true
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch converted := convertedRequest.(type) {
		case *bytes.Buffer:
			outboundBilling, err = helper.ResolveOutboundImageBillingMultipart(
				info,
				c.Request.Header.Get("Content-Type"),
				bytes.NewReader(converted.Bytes()),
				outboundSchemaConfirmed,
			)
			if err != nil {
				return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			requestBody = converted
		default:
			jsonData, err = common.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return newAPIErrorFromParamOverride(err)
				}
			}
		}
	}
	if jsonData != nil {
		jsonData, err = helper.MaterializeOutboundImageBillingDefaults(info, jsonData, outboundSchemaConfirmed)
		if err != nil {
			return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if finalizer != nil {
			var preparedPayload map[string]any
			if err = common.Unmarshal(jsonData, &preparedPayload); err != nil {
				return types.NewErrorWithStatusCode(fmt.Errorf("invalid prepared image request: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			preparedInput, ok := preparedPayload["input"].(map[string]any)
			if !ok {
				return types.NewErrorWithStatusCode(errors.New("invalid prepared image request: input is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			if _, exists := preparedInput["image_prompt"]; exists {
				return types.NewErrorWithStatusCode(errors.New("invalid prepared image request: input.image_prompt is reserved for finalization"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
		// This is a different trust boundary from ingress: channel overrides
		// and pass-through bodies can change the quantity actually submitted.
		outboundBilling, err = helper.ResolveOutboundImageBillingJSON(info, jsonData, outboundSchemaConfirmed)
		if err != nil {
			return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}
	if outboundBilling == nil {
		return types.NewErrorWithStatusCode(errors.New("final image billing view is unavailable"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	billingRequest = outboundBilling.Request
	imageCount = outboundBilling.Count
	info.BillingRequestInput = &outboundBilling.Input
	retainFailedAttemptBillingInput = len(outboundBilling.Input.Body) == 0

	promptTexts := outboundBilling.PromptTexts
	billingRequest.Prompt = strings.Join(promptTexts, "\n")
	clearPromptTexts := func() {
		for index := range promptTexts {
			promptTexts[index] = ""
		}
		outboundBilling.PromptTexts = nil
		billingRequest.Prompt = ""
	}
	defer clearPromptTexts()
	if billingErr := service.RefreshImageBillingRequestContext(c, info, promptTexts); billingErr != nil {
		return billingErr
	}
	if info.Billing == nil {
		originalRequest := info.Request
		info.Request = billingRequest
		billingErr := PrepareRequestBilling(c, info)
		info.Request = originalRequest
		if billingErr != nil {
			return billingErr
		}
	}
	clearPromptTexts()
	if billingErr := service.PrepareImageBillingForRequest(c, info, imageCount); billingErr != nil {
		return billingErr
	}

	retainReservation := func() *types.NewAPIError {
		if info.Billing == nil {
			return nil
		}
		if settleErr := info.Billing.Settle(info.Billing.GetPreConsumedQuota()); settleErr != nil {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("failed to retain image reservation after provider submission: %w", settleErr),
				types.ErrorCodeDoRequestFailed,
				http.StatusInternalServerError,
				types.ErrOptionWithSkipRetry(),
			)
		}
		return nil
	}
	postReservationUploadStarted := false
	if finalizer != nil {
		finalizedRequest, finalizeErr := finalizer.FinalizeImageRequest(c, info, jsonData)
		if finalizeErr != nil {
			var submitted imageSubmissionStartedError
			if errors.As(finalizeErr, &submitted) && submitted.ImageSubmissionStarted() {
				if billingErr := retainReservation(); billingErr != nil {
					return billingErr
				}
			}
			var apiErr *types.NewAPIError
			if errors.As(finalizeErr, &apiErr) {
				return apiErr
			}
			return types.NewError(finalizeErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		finalizedJSON, finalizeErr := common.Marshal(finalizedRequest)
		if finalizeErr != nil {
			if billingErr := retainReservation(); billingErr != nil {
				return billingErr
			}
			return types.NewError(finalizeErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		var preparedPayload map[string]any
		var finalizedPayload map[string]any
		if finalizeErr = common.Unmarshal(jsonData, &preparedPayload); finalizeErr == nil {
			finalizeErr = common.Unmarshal(finalizedJSON, &finalizedPayload)
		}
		if finalizeErr == nil && !reflect.DeepEqual(preparedPayload, finalizedPayload) {
			finalizedInput, ok := finalizedPayload["input"].(map[string]any)
			if !ok {
				finalizeErr = errors.New("finalized image request input is unavailable")
			} else if imagePrompt, ok := finalizedInput["image_prompt"].(string); !ok || strings.TrimSpace(imagePrompt) == "" {
				finalizeErr = errors.New("finalized image request must add a non-empty input.image_prompt URL")
			} else {
				delete(finalizedInput, "image_prompt")
				if !reflect.DeepEqual(preparedPayload, finalizedPayload) {
					finalizeErr = errors.New("finalized image request changed validated fields")
				} else {
					postReservationUploadStarted = true
				}
			}
		}
		if finalizeErr != nil {
			if billingErr := retainReservation(); billingErr != nil {
				return billingErr
			}
			return types.NewErrorWithStatusCode(
				finalizeErr,
				types.ErrorCodeConvertRequestFailed,
				http.StatusInternalServerError,
				types.ErrOptionWithSkipRetry(),
			)
		}
		jsonData = finalizedJSON
	}
	if jsonData != nil {
		body, closer, bodyErr := relaycommon.NewOutboundJSONBody(jsonData)
		if bodyErr != nil {
			if postReservationUploadStarted {
				if billingErr := retainReservation(); billingErr != nil {
					return billingErr
				}
			}
			return types.NewError(bodyErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		requestBody = body
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		if postReservationUploadStarted {
			if billingErr := retainReservation(); billingErr != nil {
				return billingErr
			}
			return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
		}
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				// replicate channel returns 201 Created when using Prefer: wait, treat it as success.
				httpResp.StatusCode = http.StatusOK
			} else {
				newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				// reset status code 重置状态码
				service.ResetStatusCode(newAPIError, statusCodeMappingStr)
				if postReservationUploadStarted {
					if billingErr := retainReservation(); billingErr != nil {
						return billingErr
					}
					types.ErrOptionWithSkipRetry()(newAPIError)
				}
				return newAPIError
			}
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		if postReservationUploadStarted {
			if billingErr := retainReservation(); billingErr != nil {
				return billingErr
			}
			types.ErrOptionWithSkipRetry()(newAPIError)
		}
		return newAPIError
	}

	// The log content shows the settled count: the count the handler derived
	// from the upstream response when it did, otherwise the reserved quantity.
	imageN := info.RequestedImageCount()
	if info.BillingImageCount != nil {
		imageN = *info.BillingImageCount
	} else if count, ok := info.PriceData.OtherRatios()["n"]; ok && info.PriceData.UsePrice && count >= 1 && count <= dto.MaxImageN {
		imageN = common.QuotaRound(count)
	}

	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = max(info.GetEstimatePromptTokens(), 1)
	}
	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = usage.(*dto.Usage).PromptTokens + usage.(*dto.Usage).CompletionTokens
	}

	quality := request.Quality
	if quality == "" {
		quality = "standard"
	}

	var logContent []string

	if len(request.Size) > 0 {
		logContent = append(logContent, fmt.Sprintf("大小 %s", request.Size))
	}
	if len(quality) > 0 {
		logContent = append(logContent, fmt.Sprintf("品质 %s", quality))
	}
	if imageN > 0 {
		logContent = append(logContent, fmt.Sprintf("生成数量 %d", imageN))
	}

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), logContent)
	return nil
}
