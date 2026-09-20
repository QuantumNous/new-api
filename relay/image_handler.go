package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	if service.ImageUpscaleTarget(info.OriginModelName) != 0 && service.LocalImageUpscaleTarget(info.OriginModelName, request.Model) == 0 {
		if info.ApiType != constant.APITypeOpenAI || model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled || len(info.ParamOverride) > 0 {
			return types.NewErrorWithStatusCode(fmt.Errorf("Pro image aliases require an OpenAI channel without parameter overrides or pass-through"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		request.Size, err = service.ProImageRequestSize(info.OriginModelName, request.Size)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		imageReq.Size = request.Size
		if strings.Contains(c.GetHeader("Content-Type"), "multipart/form-data") {
			form := c.Request.MultipartForm
			if form == nil {
				form, err = common.ParseMultipartFormReusable(c)
				if err != nil {
					return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
				}
			}
			if form.Value == nil {
				form.Value = make(map[string][]string)
			}
			form.Value["size"] = []string{request.Size}
			c.Request.MultipartForm = form
		}
	}
	if service.LocalImageUpscaleTarget(info.OriginModelName, request.Model) != 0 {
		if info.ApiType != constant.APITypeOpenAI || service.ImageUpscaleTarget(request.Model) != 0 || model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled || len(info.ParamOverride) > 0 {
			return types.NewErrorWithStatusCode(fmt.Errorf("upscale models require a mapped OpenAI channel without parameter overrides or pass-through"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if err := prepareImageUpscaleRequest(c, request); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if !service.ImageUpscaleReady() {
			return types.NewErrorWithStatusCode(fmt.Errorf("GPU upscale worker is offline"), types.ErrorCode("upscale_worker_offline"), http.StatusServiceUnavailable, types.ErrOptionWithSkipRetry())
		}
		release, available := service.ReserveImageUpscaleSlot()
		if !available {
			c.Header("Retry-After", "15")
			return types.NewErrorWithStatusCode(fmt.Errorf("GPU upscale queue is busy; no image was generated"), types.ErrorCode("upscale_busy"), http.StatusTooManyRequests, types.ErrOptionWithSkipRetry())
		}
		defer release()
	}

	var requestBody io.Reader

	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.NewReplayableBodyReader(storage)
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *bytes.Buffer:
			requestBody = convertedRequest.(io.Reader)
		default:
			jsonData, err := common.Marshal(convertedRequest)
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

			logger.LogDebug(c, "image request body: %s", jsonData)
			body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			jsonData = nil
			requestBody = body
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
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
				return newAPIError
			}
		}
	}

	if service.LocalImageUpscaleTarget(info.OriginModelName, request.Model) != 0 && info.IsStream {
		if httpResp != nil {
			service.CloseResponseBodyGracefully(httpResp)
		}
		c.Header("x-should-retry", "false")
		return types.NewErrorWithStatusCode(fmt.Errorf("upstream unexpectedly returned a stream for an upscale request"), types.ErrorCode("image_upscale_failed"), http.StatusFailedDependency, types.ErrOptionWithSkipRetry())
	}
	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	imageN := uint(1)
	if request.N != nil {
		imageN = *request.N
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = 1
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = 1
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

func prepareImageUpscaleRequest(c *gin.Context, request *dto.ImageRequest) error {
	if err := service.PrepareImageUpscaleRequest(request); err != nil {
		return err
	}
	if !strings.Contains(c.GetHeader("Content-Type"), "multipart/form-data") {
		return nil
	}

	form := c.Request.MultipartForm
	if form == nil {
		var err error
		form, err = common.ParseMultipartFormReusable(c)
		if err != nil {
			return fmt.Errorf("failed to prepare upscale image edit: %w", err)
		}
		c.Request.MultipartForm = form
	}
	if form.Value == nil {
		form.Value = make(map[string][]string)
	}
	form.Value["size"] = []string{request.Size}
	form.Value["n"] = []string{"1"}
	form.Value["stream"] = []string{"false"}
	form.Value["response_format"] = []string{"b64_json"}
	form.Value["output_format"] = []string{"png"}
	delete(form.Value, "partial_images")
	delete(form.Value, "output_compression")
	return nil
}
