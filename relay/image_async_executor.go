package relay

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
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

var persistedGenericImageResponseHeaders = map[string]struct{}{
	"content-encoding": {},
	"content-length":   {},
	"content-type":     {},
	"request-id":       {},
	"retry-after":      {},
	"x-request-id":     {},
}

func safeGenericImageResponseHeaders(headers http.Header) map[string][]string {
	if len(headers) == 0 {
		return nil
	}
	filtered := make(map[string][]string)
	for key, values := range headers {
		if _, ok := persistedGenericImageResponseHeaders[strings.ToLower(strings.TrimSpace(key))]; !ok {
			continue
		}
		filtered[http.CanonicalHeaderKey(key)] = append([]string(nil), values...)
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}

type boundedImageResponseWriter struct {
	header      http.Header
	body        bytes.Buffer
	status      int
	limit       int
	err         error
	beforeWrite func() error
	writeReady  bool
}

func newBoundedImageResponseWriter(limit int, beforeWrite ...func() error) *boundedImageResponseWriter {
	writer := &boundedImageResponseWriter{
		header: make(http.Header),
		status: http.StatusOK,
		limit:  limit,
	}
	if len(beforeWrite) > 0 {
		writer.beforeWrite = beforeWrite[0]
	}
	return writer
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
	if !w.writeReady {
		if w.beforeWrite != nil {
			if err := w.beforeWrite(); err != nil {
				w.err = err
				return 0, err
			}
		}
		w.writeReady = true
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
		if info.RelayMode == relayconstant.RelayModeImagesEdits {
			info.RequestURLPath = "/v1/images/edits"
		}
	}

	requestURL := info.RequestURLPath
	if !strings.HasPrefix(requestURL, "/") && !strings.HasPrefix(requestURL, "http://") && !strings.HasPrefix(requestURL, "https://") {
		requestURL = "/" + requestURL
	}
	var httpRequest *http.Request
	var err error
	rebuiltEditMultipart := info.RelayMode == relayconstant.RelayModeImagesEdits &&
		input.UpstreamResponse == nil && imageRoutingUsesMultipartEdit(info.ImageRoutingProtocol)
	if rebuiltEditMultipart {
		httpRequest, err = buildGenericImageEditHTTPRequest(ctx, requestURL, request)
	} else {
		originalBody, marshalErr := marshalGenericImageRequest(request)
		if marshalErr != nil {
			return nil, types.NewError(marshalErr, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
		httpRequest, err = http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(originalBody))
	}
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if rebuiltEditMultipart {
		defer httpRequest.Body.Close()
	}
	rebuiltEditContentType := ""
	if rebuiltEditMultipart {
		rebuiltEditContentType = httpRequest.Header.Get("Content-Type")
	}
	for key, value := range info.RequestHeaders {
		if strings.TrimSpace(key) != "" {
			httpRequest.Header.Set(key, value)
		}
	}
	if rebuiltEditMultipart {
		// buildGenericImageEditHTTPRequest creates a fresh boundary after all
		// staged images have been materialized. Never replay the inbound boundary.
		httpRequest.Header.Set("Content-Type", rebuiltEditContentType)
	} else if httpRequest.Header.Get("Content-Type") == "" {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	if httpRequest.Header.Get("Accept") == "" {
		httpRequest.Header.Set("Accept", "application/json")
	}

	responseWriter := newBoundedImageResponseWriter(maxGenericImageResponseBytes, input.BeforeResultWrite)
	c, _ := gin.CreateTestContext(responseWriter)
	defer service.CleanupFileSources(c)
	c.Request = httpRequest
	defer func() {
		if c.Request.MultipartForm != nil {
			_ = c.Request.MultipartForm.RemoveAll()
		}
	}()
	populateGenericImageContext(c, info, request)
	providerErrorSecrets := genericImageProviderErrorSecrets(info, c)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	var requestBody io.Reader
	var requestBodyCloser io.Closer
	streamOpenAIEditMultipart := rebuiltEditMultipart && input.PassThroughBody == nil &&
		(info.ApiType == constant.APITypeOpenAI || info.ApiType == constant.APITypeOpenRouter ||
			info.ApiType == constant.APITypeXinference || info.ApiType == constant.APITypeAdvancedCustom) &&
		len(info.ParamOverride) == 0
	// A persisted provider response is already past request conversion. In
	// particular, deferred Gemini/Vertex conversion would otherwise download
	// the staged reference images again before replaying the checkpoint.
	if input.UpstreamResponse == nil {
		if streamOpenAIEditMultipart {
			requestBody = httpRequest.Body
			info.UpstreamRequestBodySize = httpRequest.ContentLength
		} else {
			if rebuiltEditMultipart && httpRequest.MultipartForm == nil {
				if err := httpRequest.ParseMultipartForm(1 << 20); err != nil {
					return nil, types.NewError(fmt.Errorf("parse rebuilt image edit multipart: %w", err), types.ErrorCodeConvertRequestFailed)
				}
			}
			convertedRequest, convertErr := adaptor.ConvertImageRequest(c, info, *request)
			if convertErr != nil {
				return nil, types.NewError(convertErr, types.ErrorCodeConvertRequestFailed)
			}
			relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
			if input.PassThroughBody != nil {
				body := append([]byte(nil), input.PassThroughBody...)
				if len(info.ParamOverride) > 0 && common.GetJsonType(body) == "object" {
					body, convertErr = relaycommon.ApplyParamOverrideWithRelayInfo(body, info)
					if convertErr != nil {
						return nil, newAPIErrorFromParamOverride(convertErr)
					}
				}
				requestBody, info.UpstreamRequestBodySize, requestBodyCloser, convertErr = relaycommon.NewOutboundJSONBody(body)
				if convertErr != nil {
					return nil, types.NewError(convertErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
				}
			} else {
				if convertedBuffer, ok := convertedRequest.(*bytes.Buffer); ok {
					jsonData, injected, marshalErr := applyImageRoutingProviderParameters(convertedBuffer.Bytes(), info, request)
					if marshalErr != nil {
						return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
					}
					if !injected {
						requestBody = convertedBuffer
						info.UpstreamRequestBodySize = int64(convertedBuffer.Len())
					} else {
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
						c.Request.Header.Set("Content-Type", "application/json")
					}
				} else {
					jsonData, marshalErr := common.Marshal(convertedRequest)
					if marshalErr != nil {
						return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
					}
					jsonData, _, marshalErr = applyImageRoutingProviderParameters(jsonData, info, request)
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
					c.Request.Header.Set("Content-Type", "application/json")
				}
			}
		}
	}
	if requestBodyCloser != nil {
		defer requestBodyCloser.Close()
	}

	var httpResponse *http.Response
	providerResponseBytes := 0
	if input.UpstreamResponse != nil {
		if input.UpstreamResponse.StatusCode <= 0 || len(input.UpstreamResponse.Body) == 0 {
			return nil, types.NewError(errors.New("stored provider image response is invalid"), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
		}
		header := safeGenericImageResponseHeaders(input.UpstreamResponse.Header)
		httpResponse = &http.Response{
			StatusCode: input.UpstreamResponse.StatusCode,
			Header:     header,
			Body:       io.NopCloser(bytes.NewReader(input.UpstreamResponse.Body)),
			Request:    httpRequest,
		}
		providerResponseBytes = len(input.UpstreamResponse.Body)
	} else {
		if input.BeforeProviderCall != nil {
			if callErr := input.BeforeProviderCall(); callErr != nil {
				return nil, types.NewError(callErr, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
			}
		}
		responseValue, requestErr := adaptor.DoRequest(c, info, requestBody)
		if requestErr != nil {
			return nil, types.NewOpenAIError(
				errors.New(maskGenericImageProviderError(requestErr.Error(), providerErrorSecrets...)),
				types.ErrorCodeDoRequestFailed,
				http.StatusInternalServerError,
			)
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
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("%w: %v", image_stream.ErrGenericImageDefinitiveResponse, readErr),
					types.ErrorCodeReadResponseBodyFailed,
					httpResponse.StatusCode,
				)
			}
			if len(responseBody) > maxGenericImageErrorResponseBytes {
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("%w: provider error response exceeds %d bytes", image_stream.ErrGenericImageDefinitiveResponse, maxGenericImageErrorResponseBytes),
					types.ErrorCodeBadResponseStatusCode,
					httpResponse.StatusCode,
				)
			}
			httpResponse.Body = io.NopCloser(bytes.NewReader(responseBody))
			apiErr := service.RelayErrorHandler(ctx, httpResponse, false)
			service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
			if apiErr != nil {
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("%w: %s", image_stream.ErrGenericImageDefinitiveResponse, maskGenericImageProviderError(apiErr.Error(), providerErrorSecrets...)),
					types.ErrorCodeBadResponseStatusCode,
					apiErr.StatusCode,
				)
			}
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("%w: provider returned HTTP %d", image_stream.ErrGenericImageDefinitiveResponse, httpResponse.StatusCode),
				types.ErrorCodeBadResponseStatusCode,
				httpResponse.StatusCode,
			)
		}
	}
	if input.UpstreamResponse == nil {
		if input.BeforeResponseRead != nil {
			if acquireErr := input.BeforeResponseRead(); acquireErr != nil {
				service.CloseResponseBodyGracefully(httpResponse)
				return nil, types.NewError(
					fmt.Errorf("acquire image response materialization lease: %w", acquireErr),
					types.ErrorCodeReadResponseBodyFailed,
				)
			}
		}
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
		providerResponseBytes = len(responseBody)
		upstreamResponse := &image_stream.GenericImageUpstreamResponse{
			StatusCode: httpResponse.StatusCode,
			Header:     safeGenericImageResponseHeaders(httpResponse.Header),
			Body:       append(json.RawMessage(nil), responseBody...),
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
	if input.AfterResponseCheckpoint != nil {
		input.AfterResponseCheckpoint(providerResponseBytes)
	}

	usageValue, apiErr := adaptor.DoResponse(c, httpResponse, info)
	if apiErr != nil {
		service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
		apiErr.SetMessage(maskGenericImageProviderError(apiErr.Error(), providerErrorSecrets...))
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

func buildGenericImageEditHTTPRequest(ctx context.Context, requestURL string, request *dto.ImageRequest) (*http.Request, error) {
	if request == nil {
		return nil, errors.New("image edit request is required")
	}
	urls, err := request.ImageInputURLs()
	if err != nil {
		return nil, fmt.Errorf("decode staged image inputs: %w", err)
	}
	if len(urls) == 0 && len(bytes.TrimSpace(request.Image)) > 0 && common.GetJsonType(request.Image) != "null" {
		probe := *request
		probe.Images = append(json.RawMessage(nil), request.Image...)
		urls, err = probe.ImageInputURLs()
		if err != nil {
			return nil, fmt.Errorf("decode staged image input: %w", err)
		}
	}
	if len(urls) == 0 {
		return nil, errors.New("image is required for asynchronous image edits")
	}

	pipeReader, pipeWriter := io.Pipe()
	writer := multipart.NewWriter(pipeWriter)
	contentType := writer.FormDataContentType()
	writeErr := make(chan error, 1)
	go func() {
		writeErr <- writeGenericImageEditMultipart(ctx, writer, pipeWriter, request, urls)
		close(writeErr)
	}()
	storage, err := common.CreateDiskBodyStorageFromReader(pipeReader, (64<<20)+(1<<20))
	if err != nil {
		_ = pipeReader.CloseWithError(err)
		writerErr := <-writeErr
		if writerErr != nil {
			return nil, fmt.Errorf("build image edit multipart: %w", writerErr)
		}
		return nil, fmt.Errorf("spool rebuilt image edit multipart: %w", err)
	}
	if err := <-writeErr; err != nil {
		_ = storage.Close()
		return nil, fmt.Errorf("build image edit multipart: %w", err)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, common.ReaderOnly(storage))
	if err != nil {
		_ = storage.Close()
		return nil, err
	}
	httpRequest.Body = storage
	httpRequest.ContentLength = storage.Size()
	httpRequest.Header.Set("Content-Type", contentType)
	return httpRequest, nil
}

func writeGenericImageEditMultipart(
	ctx context.Context,
	writer *multipart.Writer,
	pipeWriter *io.PipeWriter,
	request *dto.ImageRequest,
	urls []string,
) (resultErr error) {
	defer func() {
		if resultErr == nil {
			resultErr = writer.Close()
		} else {
			_ = writer.Close()
		}
		_ = pipeWriter.CloseWithError(resultErr)
	}()
	writeField := func(name, value string) error {
		if strings.TrimSpace(value) == "" {
			return nil
		}
		return writer.WriteField(name, value)
	}
	if err := writeField("model", request.Model); err != nil {
		return err
	}
	if err := writeField("prompt", request.Prompt); err != nil {
		return err
	}
	if request.N != nil {
		if err := writeField("n", strconv.FormatUint(uint64(*request.N), 10)); err != nil {
			return err
		}
	}
	for _, field := range []struct {
		name  string
		value string
	}{
		{name: "size", value: request.Size},
		{name: "quality", value: request.Quality},
		{name: "response_format", value: request.ResponseFormat},
	} {
		if err := writeField(field.name, field.value); err != nil {
			return err
		}
	}
	for _, field := range []struct {
		name string
		raw  json.RawMessage
	}{
		{name: "style", raw: request.Style},
		{name: "user", raw: request.User},
		{name: "background", raw: request.Background},
		{name: "moderation", raw: request.Moderation},
		{name: "output_format", raw: request.OutputFormat},
		{name: "output_compression", raw: request.OutputCompression},
		{name: "partial_images", raw: request.PartialImages},
		{name: "input_fidelity", raw: request.InputFidelity},
		{name: "extra_fields", raw: request.ExtraFields},
		{name: "watermark_enabled", raw: request.WatermarkEnabled},
		{name: "user_id", raw: request.UserId},
	} {
		value, err := genericImageMultipartFieldValue(field.raw)
		if err != nil {
			return fmt.Errorf("encode image edit field %s: %w", field.name, err)
		}
		if err := writeField(field.name, value); err != nil {
			return err
		}
	}
	if request.Watermark != nil {
		if err := writeField("watermark", strconv.FormatBool(*request.Watermark)); err != nil {
			return err
		}
	}
	for name, raw := range request.Extra {
		if isGenericImageGatewayField(name) {
			continue
		}
		values, err := genericImageMultipartFieldValues(raw)
		if err != nil {
			return fmt.Errorf("encode image edit field %s: %w", name, err)
		}
		for _, value := range values {
			if err := writeField(name, value); err != nil {
				return err
			}
		}
	}
	maskURL := ""
	if rawMask := bytes.TrimSpace(request.Mask); len(rawMask) > 0 && common.GetJsonType(rawMask) != "null" {
		if common.GetJsonType(rawMask) != "string" || common.Unmarshal(rawMask, &maskURL) != nil || strings.TrimSpace(maskURL) == "" {
			return errors.New("image edit mask must be a staged image URL")
		}
	}
	client := service.GetDirectSSRFProtectedHTTPClient()
	var totalBytes int64
	type stagedImagePart struct {
		fieldName string
		sourceURL string
		index     int
	}
	parts := make([]stagedImagePart, 0, len(urls)+1)
	imageFieldName := "image"
	if len(urls) > 1 {
		imageFieldName = "image[]"
	}
	for index, sourceURL := range urls {
		parts = append(parts, stagedImagePart{fieldName: imageFieldName, sourceURL: sourceURL, index: index})
	}
	if maskURL != "" {
		parts = append(parts, stagedImagePart{fieldName: "mask", sourceURL: maskURL, index: len(urls)})
	}
	for _, staged := range parts {
		index := staged.index
		sourceURL := staged.sourceURL
		var imageReader io.Reader
		var imageCloser io.Closer
		contentLength := int64(-1)
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(sourceURL)), "data:") {
			comma := strings.IndexByte(sourceURL, ',')
			if comma < 0 || !strings.Contains(strings.ToLower(sourceURL[:comma]), ";base64") {
				return fmt.Errorf("staged image %d data URI is invalid", index)
			}
			imageReader = base64.NewDecoder(base64.StdEncoding, strings.NewReader(sourceURL[comma+1:]))
		} else {
			httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
			if err != nil {
				return fmt.Errorf("build staged image %d request: %w", index, err)
			}
			response, err := client.Do(httpRequest)
			if err != nil {
				return fmt.Errorf("fetch staged image %d: %w", index, err)
			}
			if response.StatusCode/100 != 2 {
				_ = response.Body.Close()
				return fmt.Errorf("staged image %d returned HTTP %d", index, response.StatusCode)
			}
			imageReader = response.Body
			imageCloser = response.Body
			contentLength = response.ContentLength
		}
		if contentLength > 25<<20 || contentLength > (64<<20)-totalBytes {
			if imageCloser != nil {
				_ = imageCloser.Close()
			}
			return fmt.Errorf("staged image %d exceeds the input size limit", index)
		}
		head := make([]byte, 512)
		headBytes, readErr := io.ReadFull(imageReader, head)
		if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) {
			if imageCloser != nil {
				_ = imageCloser.Close()
			}
			return fmt.Errorf("read staged image %d header: %w", index, readErr)
		}
		head = head[:headBytes]
		format, ok := strictAsyncImageInputFormat(head)
		if !ok && strings.HasPrefix(strings.ToLower(strings.TrimSpace(sourceURL)), "data:") {
			comma := strings.IndexByte(sourceURL, ',')
			if comma > 0 {
				switch strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.Split(sourceURL[:comma], ";")[0], "data:"))) {
				case "image/png":
					format, ok = "png", true
				case "image/jpeg", "image/jpg":
					format, ok = "jpg", true
				case "image/webp":
					format, ok = "webp", true
				}
			}
		}
		if !ok {
			if imageCloser != nil {
				_ = imageCloser.Close()
			}
			return fmt.Errorf("staged image %d has unsupported image bytes", index)
		}
		mimeType := image_stream.MimeForExt(format)
		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s_%d.%s"`, staged.fieldName, staged.fieldName, index+1, format))
		header.Set("Content-Type", mimeType)
		part, err := writer.CreatePart(header)
		if err != nil {
			if imageCloser != nil {
				_ = imageCloser.Close()
			}
			return fmt.Errorf("create staged image %d form part: %w", index, err)
		}
		remaining := (64 << 20) - totalBytes
		written, err := io.Copy(part, io.LimitReader(io.MultiReader(bytes.NewReader(head), imageReader), min(25<<20, remaining)+1))
		var closeErr error
		if imageCloser != nil {
			closeErr = imageCloser.Close()
		}
		if err != nil {
			return fmt.Errorf("write staged image %d form part: %w", index, err)
		}
		if closeErr != nil {
			return fmt.Errorf("close staged image %d: %w", index, closeErr)
		}
		if written > 25<<20 || written > remaining {
			return fmt.Errorf("staged image %d exceeds the input size limit", index)
		}
		totalBytes += written
	}
	return nil
}

func strictAsyncImageInputFormat(head []byte) (string, bool) {
	switch {
	case len(head) >= 8 && bytes.Equal(head[:8], []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}):
		return "png", true
	case len(head) >= 3 && head[0] == 0xff && head[1] == 0xd8 && head[2] == 0xff:
		return "jpg", true
	case len(head) >= 12 && bytes.Equal(head[:4], []byte("RIFF")) && bytes.Equal(head[8:12], []byte("WEBP")):
		return "webp", true
	default:
		return "", false
	}
}

func genericImageMultipartFieldValue(raw json.RawMessage) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
		return "", nil
	}
	var value any
	if err := common.Unmarshal(trimmed, &value); err != nil {
		return "", err
	}
	switch typed := value.(type) {
	case string:
		return typed, nil
	case float64, bool:
		encoded, err := common.Marshal(typed)
		return string(encoded), err
	default:
		return "", errors.New("multipart image edit fields must be scalar")
	}
}

func genericImageMultipartFieldValues(raw json.RawMessage) ([]string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
		return nil, nil
	}
	if common.GetJsonType(trimmed) != "array" {
		value, err := genericImageMultipartFieldValue(trimmed)
		if err != nil || value == "" {
			return nil, err
		}
		return []string{value}, nil
	}
	var rawValues []json.RawMessage
	if err := common.Unmarshal(trimmed, &rawValues); err != nil {
		return nil, err
	}
	values := make([]string, 0, len(rawValues))
	for _, rawValue := range rawValues {
		value, err := genericImageMultipartFieldValue(rawValue)
		if err != nil {
			return nil, err
		}
		if value != "" {
			values = append(values, value)
		}
	}
	return values, nil
}

func isGenericImageGatewayField(name string) bool {
	switch name {
	case "async", "webhook_url", "webhook_secret", "callBackUrl", "image", "images", "mask":
		return true
	default:
		return false
	}
}

func maskGenericImageProviderError(message string, secrets ...string) string {
	for _, secret := range secrets {
		secret = strings.TrimSpace(secret)
		if secret != "" {
			message = strings.ReplaceAll(message, secret, "***")
		}
	}
	return common.MaskSensitiveInfo(message)
}

func genericImageProviderErrorSecrets(info *relaycommon.RelayInfo, c *gin.Context) []string {
	if info == nil || info.ChannelMeta == nil {
		return nil
	}

	secrets := make([]string, 0, 8)
	seen := make(map[string]struct{})
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		secrets = append(secrets, value)
	}
	add(info.ApiKey)

	encoded, err := common.Marshal([]any{info.ParamOverride, info.HeadersOverride})
	if err == nil {
		var values []any
		if common.Unmarshal(encoded, &values) == nil {
			stack := append([]any(nil), values...)
			for len(stack) > 0 {
				value := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				switch typed := value.(type) {
				case string:
					add(typed)
				case []any:
					stack = append(stack, typed...)
				case map[string]any:
					for _, nested := range typed {
						stack = append(stack, nested)
					}
				}
			}
		}
	}
	if resolvedHeaders, resolveErr := channel.ResolveHeaderOverride(info, c); resolveErr == nil {
		for _, value := range resolvedHeaders {
			add(value)
		}
	}
	return secrets
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
