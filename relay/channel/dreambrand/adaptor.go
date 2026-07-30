package dreambrand

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const maxDownloadedImageBytes = 50 * 1024 * 1024

type imageRequestPayload struct {
	Prompt       string   `json:"prompt"`
	Model        string   `json:"model"`
	Size         string   `json:"size,omitempty"`
	OutputFormat string   `json:"output_format,omitempty"`
	Watermark    *bool    `json:"watermark,omitempty"`
	AspectRatio  string   `json:"aspectRatio,omitempty"`
	Pic          string   `json:"pic,omitempty"`
	Pics         []string `json:"pics,omitempty"`
}

type upstreamImageData struct {
	URL           string `json:"url"`
	RevisedPrompt string `json:"revised_prompt"`
}

type createResponse struct {
	ID      string              `json:"id"`
	TaskID  string              `json:"task_id"`
	Status  string              `json:"status"`
	URL     string              `json:"url"`
	Created int64               `json:"created"`
	Data    []upstreamImageData `json:"data"`
}

type queryResponse struct {
	ID      string          `json:"id"`
	TaskID  string          `json:"task_id"`
	Status  string          `json:"status"`
	URL     string          `json:"url"`
	Created int64           `json:"created"`
	Message string          `json:"message"`
	Msg     string          `json:"msg"`
	Reason  string          `json:"reason"`
	Error   json.RawMessage `json:"error"`
	Code    json.RawMessage `json:"code"`
}

type Adaptor struct {
	openai.Adaptor
	pollInterval time.Duration
	pollTimeout  time.Duration
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.Adaptor.Init(info)
	if a.pollInterval <= 0 {
		a.pollInterval = 3 * time.Second
	}
	if a.pollTimeout <= 0 {
		a.pollTimeout = 180 * time.Second
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		return "", fmt.Errorf("DreamBrand only supports image generations in the synchronous relay")
	}
	return buildURL(info.ChannelBaseUrl, ImageCreatePath), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, headers *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, headers)
	headers.Set("Authorization", "Bearer "+info.ApiKey)
	headers.Set("Accept", "application/json")
	headers.Set("Content-Type", "application/json")
	return nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if request.N != nil && *request.N != 1 {
		return nil, fmt.Errorf("DreamBrand image models currently support n=1 only")
	}
	if !IsImageModel(info.OriginModelName) && !IsImageModel(info.UpstreamModelName) {
		return nil, fmt.Errorf("unsupported DreamBrand image model: %s", info.OriginModelName)
	}

	references, err := imageReferences(request)
	if err != nil {
		return nil, err
	}
	if len(references) > 6 {
		return nil, fmt.Errorf("DreamBrand image generation supports at most 6 reference images")
	}

	modelName := ResolveModelName(info.UpstreamModelName)
	if modelName == "" {
		modelName = ResolveModelName(request.Model)
	}
	if modelName == "seedream-5.0-lite" && (strings.EqualFold(request.Size, "2160p") || strings.EqualFold(request.Size, "4K")) {
		return nil, fmt.Errorf("seedream-5.0-lite supports resolutions up to 1800p")
	}
	outputFormat, err := imageOutputFormat(request)
	if err != nil {
		return nil, err
	}
	payload := imageRequestPayload{
		Prompt:       request.Prompt,
		Model:        modelName,
		Size:         request.Size,
		OutputFormat: outputFormat,
		Watermark:    request.Watermark,
		AspectRatio:  imageAspectRatio(request),
	}
	if len(references) > 0 {
		payload.Pic = references[0]
		payload.Pics = references[1:]
	}
	c.Set("response_format", request.ResponseFormat)
	info.UpstreamModelName = modelName
	return payload, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}
	service.CloseResponseBodyGracefully(resp)

	created, err := parseCreateResponse(responseBody)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	result := queryResponse{Status: created.Status, URL: created.URL, Created: created.Created}
	if result.URL == "" && len(created.Data) > 0 {
		result.URL = created.Data[0].URL
	}

	if result.URL == "" {
		taskID := created.ID
		if taskID == "" {
			taskID = created.TaskID
		}
		if taskID == "" {
			code, message := parseUpstreamError(responseBody)
			if message == "" {
				message = "DreamBrand image creation returned neither task ID nor URL"
			}
			if code == "" {
				code = "invalid_response"
			}
			return nil, types.NewError(fmt.Errorf("%s", message), types.ErrorCode(code))
		}

		result, _, err = a.pollImageTask(c.Request.Context(), info, taskID)
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) {
				return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponse, http.StatusGatewayTimeout, types.ErrOptionWithSkipRetry())
			}
			return nil, types.NewError(err, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
		}
	}

	if strings.TrimSpace(result.URL) == "" {
		return nil, types.NewError(fmt.Errorf("DreamBrand image task succeeded without URL"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	imageData := dto.ImageData{Url: result.URL}
	if len(created.Data) > 0 {
		imageData.RevisedPrompt = created.Data[0].RevisedPrompt
	}
	if c.GetString("response_format") == "b64_json" {
		b64, downloadErr := downloadImageBase64(c.Request.Context(), info, result.URL)
		if downloadErr != nil {
			return nil, types.NewError(downloadErr, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
		}
		imageData.Url = ""
		imageData.B64Json = b64
	}

	createdAt := result.Created
	if createdAt == 0 {
		createdAt = created.Created
	}
	if createdAt == 0 {
		createdAt = info.StartTime.Unix()
	}
	imageResponse := dto.ImageResponse{Created: createdAt, Data: []dto.ImageData{imageData}}
	jsonResponse, err := common.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &dto.Usage{}, nil
}

func (a *Adaptor) pollImageTask(parent context.Context, info *relaycommon.RelayInfo, taskID string) (queryResponse, []byte, error) {
	ctx, cancel := context.WithTimeout(parent, a.pollTimeout)
	defer cancel()

	var lastErr error
	for {
		result, body, err := fetchImageTask(ctx, info, taskID)
		if err == nil {
			if strings.TrimSpace(result.Status) == "" {
				if reason := queryErrorReason(result); reason != "" {
					return result, body, errors.New(reason)
				}
			}
			switch normalizeStatus(result.Status) {
			case "success":
				return result, body, nil
			case "failed":
				reason := queryErrorReason(result)
				if reason == "" {
					reason = "DreamBrand image generation failed"
				}
				return result, body, errors.New(reason)
			}
		} else {
			lastErr = err
		}

		timer := time.NewTimer(a.pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			if lastErr != nil {
				return queryResponse{}, nil, fmt.Errorf("DreamBrand image polling stopped (%v): %w", lastErr, ctx.Err())
			}
			return queryResponse{}, nil, ctx.Err()
		case <-timer.C:
		}
	}
}

func fetchImageTask(ctx context.Context, info *relaycommon.RelayInfo, taskID string) (queryResponse, []byte, error) {
	requestURL := buildURL(info.ChannelBaseUrl, fmt.Sprintf(ImageQueryPath, url.PathEscape(taskID)))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return queryResponse{}, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	req.Header.Set("Accept", "application/json")

	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return queryResponse{}, nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return queryResponse{}, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return queryResponse{}, nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return queryResponse{}, body, fmt.Errorf("DreamBrand query returned HTTP %d: %s", resp.StatusCode, body)
	}
	result, err := parseQueryResponse(body)
	return result, body, err
}

func downloadImageBase64(ctx context.Context, info *relaycommon.RelayInfo, imageURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return "", err
	}
	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download generated image returned HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxDownloadedImageBytes+1))
	if err != nil {
		return "", err
	}
	if len(data) > maxDownloadedImageBytes {
		return "", fmt.Errorf("generated image exceeds %d bytes", maxDownloadedImageBytes)
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func imageReferences(request dto.ImageRequest) ([]string, error) {
	references := make([]string, 0, 6)
	for _, raw := range []json.RawMessage{request.Image, request.Images} {
		if len(raw) == 0 || string(raw) == "null" {
			continue
		}
		var single string
		if err := common.Unmarshal(raw, &single); err == nil {
			if single = strings.TrimSpace(single); single != "" {
				references = append(references, single)
			}
			continue
		}
		var multiple []string
		if err := common.Unmarshal(raw, &multiple); err != nil {
			return nil, fmt.Errorf("image/images must be a string or string array")
		}
		for _, image := range multiple {
			if image = strings.TrimSpace(image); image != "" {
				references = append(references, image)
			}
		}
	}
	return references, nil
}

func imageOutputFormat(request dto.ImageRequest) (string, error) {
	if len(request.OutputFormat) == 0 || string(request.OutputFormat) == "null" {
		return "", nil
	}
	var outputFormat string
	if err := common.Unmarshal(request.OutputFormat, &outputFormat); err != nil {
		return "", fmt.Errorf("output_format must be a string")
	}
	return strings.TrimSpace(outputFormat), nil
}

func imageAspectRatio(request dto.ImageRequest) string {
	for _, key := range []string{"aspect_ratio", "aspectRatio"} {
		raw, ok := request.Extra[key]
		if !ok {
			continue
		}
		var value string
		if err := common.Unmarshal(raw, &value); err == nil {
			return value
		}
	}
	return ""
}

func parseCreateResponse(body []byte) (createResponse, error) {
	var raw struct {
		ID      string          `json:"id"`
		TaskID  string          `json:"task_id"`
		Status  string          `json:"status"`
		URL     string          `json:"url"`
		Created int64           `json:"created"`
		Data    json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(body, &raw); err != nil {
		return createResponse{}, err
	}
	direct := createResponse{
		ID:      raw.ID,
		TaskID:  raw.TaskID,
		Status:  raw.Status,
		URL:     raw.URL,
		Created: raw.Created,
	}
	if len(raw.Data) > 0 && string(raw.Data) != "null" {
		_ = common.Unmarshal(raw.Data, &direct.Data)
	}
	if direct.ID != "" || direct.TaskID != "" || direct.URL != "" || len(direct.Data) > 0 {
		return direct, nil
	}
	if len(raw.Data) == 0 || string(raw.Data) == "null" {
		return direct, nil
	}
	var nested createResponse
	if err := common.Unmarshal(raw.Data, &nested); err != nil {
		return direct, nil
	}
	return nested, nil
}

func parseQueryResponse(body []byte) (queryResponse, error) {
	var direct queryResponse
	if err := common.Unmarshal(body, &direct); err != nil {
		return queryResponse{}, err
	}
	if direct.ID != "" || direct.TaskID != "" || direct.Status != "" || direct.URL != "" {
		return direct, nil
	}
	var envelope struct {
		Data queryResponse `json:"data"`
	}
	if err := common.Unmarshal(body, &envelope); err != nil {
		return queryResponse{}, err
	}
	nested := envelope.Data
	if nested.ID != "" || nested.TaskID != "" || nested.Status != "" || nested.URL != "" || nested.Message != "" || len(nested.Error) > 0 {
		return nested, nil
	}
	return direct, nil
}

func parseUpstreamError(body []byte) (string, string) {
	var response struct {
		Code    json.RawMessage `json:"code"`
		Message string          `json:"message"`
		Msg     string          `json:"msg"`
		Error   json.RawMessage `json:"error"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return "", ""
	}
	code := strings.Trim(string(response.Code), `"`)
	message := strings.TrimSpace(response.Message)
	if message == "" {
		message = strings.TrimSpace(response.Msg)
	}
	if message == "" && len(response.Error) > 0 && string(response.Error) != "null" {
		var errorText string
		if err := common.Unmarshal(response.Error, &errorText); err == nil {
			message = errorText
		} else {
			var object struct {
				Code    json.RawMessage `json:"code"`
				Message string          `json:"message"`
				Msg     string          `json:"msg"`
			}
			if err := common.Unmarshal(response.Error, &object); err == nil {
				message = object.Message
				if message == "" {
					message = object.Msg
				}
				if code == "" {
					code = strings.Trim(string(object.Code), `"`)
				}
			}
		}
	}
	return code, message
}

func queryErrorReason(response queryResponse) string {
	for _, value := range []string{response.Message, response.Msg, response.Reason} {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	if len(response.Error) > 0 && string(response.Error) != "null" {
		_, message := parseUpstreamError(mustMarshal(response))
		if message != "" {
			return message
		}
	}
	return strings.Trim(string(response.Code), `"`)
}

func mustMarshal(value any) []byte {
	data, _ := common.Marshal(value)
	return data
}

func normalizeStatus(status string) string {
	normalized := strings.ToLower(strings.TrimSpace(status))
	normalized = strings.NewReplacer("-", "_", " ", "_").Replace(normalized)
	switch normalized {
	case "success", "succeeded", "completed", "complete", "done":
		return "success"
	case "failed", "failure", "error", "cancelled", "canceled", "expired":
		return "failed"
	default:
		return "processing"
	}
}

func buildURL(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

var _ channel.Adaptor = (*Adaptor)(nil)
