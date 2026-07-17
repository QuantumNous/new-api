package relay

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	maxGenericImageResponseBytes      = 56 << 20
	maxGenericImageErrorResponseBytes = 1 << 20
)

var errGenericImageResponseTooLarge = errors.New("generic image response exceeds the size limit")

type boundedImageResponseWriter struct {
	header http.Header
	body   bytes.Buffer
	status int
	limit  int
	err    error
}

func newBoundedImageResponseWriter(limit int) *boundedImageResponseWriter {
	return &boundedImageResponseWriter{
		header: make(http.Header),
		status: http.StatusOK,
		limit:  limit,
	}
}

func (w *boundedImageResponseWriter) Header() http.Header {
	return w.header
}

func (w *boundedImageResponseWriter) WriteHeader(statusCode int) {
	if statusCode > 0 {
		w.status = statusCode
	}
}

func (w *boundedImageResponseWriter) Write(data []byte) (int, error) {
	if w.err != nil {
		return 0, w.err
	}
	if len(data) > w.limit-w.body.Len() {
		w.err = errGenericImageResponseTooLarge
		return 0, w.err
	}
	return w.body.Write(data)
}

func (w *boundedImageResponseWriter) Flush() {}

func init() {
	image_stream.RegisterGenericImageExecutor(executeGenericImageAdaptor)
}

func executeGenericImageAdaptor(ctx context.Context, input *image_stream.GenericImageExecutionRequest) (*image_stream.GenericImageExecutionResult, *types.NewAPIError) {
	if input == nil || input.RelayInfo == nil || input.ImageRequest == nil {
		return nil, types.NewError(errors.New("generic image execution request is required"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if input.RelayInfo.ChannelMeta == nil {
		return nil, types.NewError(errors.New("generic image channel metadata is required"), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}

	info := input.RelayInfo
	request := cloneGenericImageRequest(input.ImageRequest)
	request.Async = nil
	request.WebhookURL = ""
	request.WebhookSecret = ""
	request.Stream = nil
	request.ResponseFormat = "url"
	info.Request = request
	info.IsStream = false
	if info.RelayMode == relayconstant.RelayModeUnknown {
		info.RelayMode = relayconstant.RelayModeImagesGenerations
	}
	if info.RequestURLPath == "" {
		info.RequestURLPath = "/v1/images/generations"
	}

	originalBody, err := marshalGenericImageRequest(request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	requestURL := info.RequestURLPath
	if !strings.HasPrefix(requestURL, "/") && !strings.HasPrefix(requestURL, "http://") && !strings.HasPrefix(requestURL, "https://") {
		requestURL = "/" + requestURL
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(originalBody))
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	for key, value := range info.RequestHeaders {
		if strings.TrimSpace(key) != "" {
			httpRequest.Header.Set(key, value)
		}
	}
	if httpRequest.Header.Get("Content-Type") == "" {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	if httpRequest.Header.Get("Accept") == "" {
		httpRequest.Header.Set("Accept", "application/json")
	}

	responseWriter := newBoundedImageResponseWriter(maxGenericImageResponseBytes)
	c, _ := gin.CreateTestContext(responseWriter)
	c.Request = httpRequest
	populateGenericImageContext(c, info, request)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	var requestBody io.Reader
	var requestBodyCloser io.Closer
	convertedRequest, convertErr := adaptor.ConvertImageRequest(c, info, *request)
	if convertErr != nil {
		return nil, types.NewError(convertErr, types.ErrorCodeConvertRequestFailed)
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
	if input.PassThroughBody != nil {
		body := append([]byte(nil), input.PassThroughBody...)
		requestBody = bytes.NewReader(body)
		info.UpstreamRequestBodySize = int64(len(body))
	} else {
		if convertedBuffer, ok := convertedRequest.(*bytes.Buffer); ok {
			requestBody = convertedBuffer
			info.UpstreamRequestBodySize = int64(convertedBuffer.Len())
		} else {
			jsonData, marshalErr := common.Marshal(convertedRequest)
			if marshalErr != nil {
				return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			if len(info.ParamOverride) > 0 {
				jsonData, marshalErr = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if marshalErr != nil {
					return nil, newAPIErrorFromParamOverride(marshalErr)
				}
			}
			requestBody, info.UpstreamRequestBodySize, requestBodyCloser, marshalErr = relaycommon.NewOutboundJSONBody(jsonData)
			if marshalErr != nil {
				return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
		}
	}
	if requestBodyCloser != nil {
		defer requestBodyCloser.Close()
	}

	var httpResponse *http.Response
	if input.UpstreamResponse != nil {
		if input.UpstreamResponse.StatusCode <= 0 || len(input.UpstreamResponse.Body) == 0 {
			return nil, types.NewError(errors.New("stored provider image response is invalid"), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
		}
		header := make(http.Header, len(input.UpstreamResponse.Header))
		for key, values := range input.UpstreamResponse.Header {
			header[key] = append([]string(nil), values...)
		}
		httpResponse = &http.Response{
			StatusCode: input.UpstreamResponse.StatusCode,
			Header:     header,
			Body:       io.NopCloser(bytes.NewReader(input.UpstreamResponse.Body)),
			Request:    httpRequest,
		}
	} else {
		responseValue, requestErr := adaptor.DoRequest(c, info, requestBody)
		if requestErr != nil {
			return nil, types.NewOpenAIError(requestErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
		}
		var ok bool
		httpResponse, ok = responseValue.(*http.Response)
		if !ok || httpResponse == nil {
			return nil, types.NewError(fmt.Errorf("invalid image adaptor response type %T", responseValue), types.ErrorCodeBadResponse)
		}
	}
	defer service.CloseResponseBodyGracefully(httpResponse)
	if httpResponse.StatusCode != http.StatusOK {
		if httpResponse.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
			httpResponse.StatusCode = http.StatusOK
		} else {
			responseBody, readErr := io.ReadAll(io.LimitReader(httpResponse.Body, maxGenericImageErrorResponseBytes+1))
			service.CloseResponseBodyGracefully(httpResponse)
			if readErr != nil {
				return nil, types.NewError(readErr, types.ErrorCodeReadResponseBodyFailed)
			}
			if len(responseBody) > maxGenericImageErrorResponseBytes {
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("provider error response exceeds %d bytes", maxGenericImageErrorResponseBytes),
					types.ErrorCodeBadResponseStatusCode,
					httpResponse.StatusCode,
				)
			}
			httpResponse.Body = io.NopCloser(bytes.NewReader(responseBody))
			apiErr := service.RelayErrorHandler(ctx, httpResponse, false)
			service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
			return nil, apiErr
		}
	}
	if input.UpstreamResponse == nil {
		responseBody, readErr := io.ReadAll(io.LimitReader(httpResponse.Body, maxGenericImageResponseBytes+1))
		service.CloseResponseBodyGracefully(httpResponse)
		if readErr != nil {
			return nil, types.NewError(readErr, types.ErrorCodeReadResponseBodyFailed)
		}
		if len(responseBody) > maxGenericImageResponseBytes {
			return nil, types.NewError(errGenericImageResponseTooLarge, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
		}
		if len(responseBody) == 0 {
			return nil, types.NewError(errors.New("provider returned an empty image response"), types.ErrorCodeBadResponseBody)
		}
		upstreamResponse := &image_stream.GenericImageUpstreamResponse{
			StatusCode: httpResponse.StatusCode,
			Header:     make(map[string][]string, len(httpResponse.Header)),
			Body:       append(json.RawMessage(nil), responseBody...),
		}
		for key, values := range httpResponse.Header {
			upstreamResponse.Header[key] = append([]string(nil), values...)
		}
		if input.Checkpoint != nil {
			if checkpointErr := input.Checkpoint(upstreamResponse); checkpointErr != nil {
				return nil, types.NewError(
					fmt.Errorf("%w: %w", image_stream.ErrGenericImageCheckpoint, checkpointErr),
					types.ErrorCodeUpdateDataError,
					types.ErrOptionWithSkipRetry(),
				)
			}
		}
		httpResponse.Body = io.NopCloser(bytes.NewReader(responseBody))
	}

	usageValue, apiErr := adaptor.DoResponse(c, httpResponse, info)
	if apiErr != nil {
		service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
		return nil, apiErr
	}
	if responseWriter.err != nil {
		return nil, types.NewError(responseWriter.err, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	if responseWriter.body.Len() == 0 {
		return nil, types.NewError(errors.New("image adaptor returned an empty response"), types.ErrorCodeBadResponseBody)
	}

	responseBody := append([]byte(nil), responseWriter.body.Bytes()...)
	imageResponse := &dto.ImageResponse{}
	if err := common.Unmarshal(responseBody, imageResponse); err != nil {
		return nil, types.NewError(fmt.Errorf("decode normalized image response: %w", err), types.ErrorCodeBadResponseBody)
	}
	if len(imageResponse.Data) == 0 {
		return nil, types.NewError(errors.New("image adaptor returned no image data"), types.ErrorCodeBadResponseBody)
	}

	usage := &dto.Usage{}
	if usageValue != nil {
		parsedUsage, ok := usageValue.(*dto.Usage)
		if !ok {
			return nil, types.NewError(fmt.Errorf("invalid image adaptor usage type %T", usageValue), types.ErrorCodeBadResponseBody)
		}
		if parsedUsage != nil {
			usage = parsedUsage
		}
	}

	otherRatios := info.PriceData.OtherRatios()
	if len(otherRatios) > 0 {
		copiedRatios := make(map[string]float64, len(otherRatios))
		for key, value := range otherRatios {
			copiedRatios[key] = value
		}
		otherRatios = copiedRatios
	}
	return &image_stream.GenericImageExecutionResult{
		Response:    imageResponse,
		Usage:       usage,
		OtherRatios: otherRatios,
	}, nil
}

func cloneGenericImageRequest(request *dto.ImageRequest) *dto.ImageRequest {
	cloned := *request
	if request.Extra != nil {
		cloned.Extra = make(map[string]json.RawMessage, len(request.Extra))
		for key, value := range request.Extra {
			cloned.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}
	return &cloned
}

func marshalGenericImageRequest(request *dto.ImageRequest) ([]byte, error) {
	base, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	fields := make(map[string]json.RawMessage)
	if err := common.Unmarshal(base, &fields); err != nil {
		return nil, err
	}
	for key, value := range request.Extra {
		if _, exists := fields[key]; exists {
			continue
		}
		fields[key] = append(json.RawMessage(nil), value...)
	}
	delete(fields, "async")
	delete(fields, "webhook_url")
	delete(fields, "webhook_secret")
	return common.Marshal(fields)
}

func populateGenericImageContext(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) {
	meta := info.ChannelMeta
	common.SetContextKey(c, constant.ContextKeyChannelId, meta.ChannelId)
	common.SetContextKey(c, constant.ContextKeyChannelType, meta.ChannelType)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, meta.ChannelCreateTime)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, meta.ChannelSetting)
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, meta.ChannelOtherSettings)
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, meta.ParamOverride)
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, meta.HeadersOverride)
	common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, meta.ChannelIsMultiKey)
	common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, meta.ChannelMultiKeyIndex)
	common.SetContextKey(c, constant.ContextKeyChannelKey, meta.ApiKey)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, meta.ChannelBaseUrl)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, info.OriginModelName)
	c.Set("api_version", meta.ApiVersion)
	c.Set("region", meta.ApiVersion)
	switch meta.ChannelType {
	case constant.ChannelTypeAli:
		c.Set("plugin", meta.ApiVersion)
	case constant.ChannelTypeCoze:
		c.Set("bot_id", meta.ApiVersion)
	}
	c.Set("channel_organization", meta.Organization)
	c.Set("response_format", request.ResponseFormat)
	c.Set("status_code_mapping", "")
	if info.RequestId != "" {
		c.Set(common.RequestIdKey, info.RequestId)
	}
}
