package asyncwrap

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

const yunwuImagePath = "/v1/images/generations"

type YunwuExecutor struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewYunwuExecutor(baseURL, apiKey string, timeout time.Duration) (*YunwuExecutor, error) {
	if _, err := yunwuImageEndpoint(baseURL); err != nil {
		return nil, err
	}
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("yunwu API key is empty")
	}
	return &YunwuExecutor{
		baseURL: strings.TrimSpace(baseURL),
		apiKey:  apiKey,
		client:  newSynchronousImageHTTPClient(timeout),
	}, nil
}

func yunwuGeminiImageEndpoint(baseURL, model string) (string, error) {
	parsed, err := parseYunwuBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(model) == "" || strings.ContainsAny(model, "/?#") {
		return "", errors.New("yunwu gemini model name is invalid")
	}
	parsed.Path = "/v1beta/models/" + model + ":generateContent"
	parsed.RawPath = ""
	return parsed.String(), nil
}

func yunwuImageEndpoint(baseURL string) (string, error) {
	parsed, err := parseYunwuBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	parsed.Path = yunwuImagePath
	parsed.RawPath = ""
	return parsed.String(), nil
}

func parseYunwuBaseURL(baseURL string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("yunwu base URL must be an absolute http or https URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("yunwu base URL must not contain credentials, query parameters or fragments")
	}
	basePath := strings.TrimRight(parsed.Path, "/")
	if basePath != "" && basePath != "/v1" {
		return nil, errors.New("yunwu base URL path must be empty or /v1")
	}
	parsed.Path = ""
	parsed.RawPath = ""
	return parsed, nil
}

func (e *YunwuExecutor) Execute(ctx context.Context, payload []byte, markRequestSent func() error) service.AsyncExecutionOutcome {
	if e == nil || e.client == nil {
		return executorFailure("executor", "executor_unavailable", "yunwu executor is unavailable", true)
	}
	return executeSynchronousImage(ctx, "yunwu", e.client, e.apiKey, payload, markRequestSent, func(imageRequest dto.ImageRequest, original []byte) (synchronousImageRequest, error) {
		endpoint, requestPayload, geminiResponse, err := e.prepareRequest(imageRequest, original)
		if err != nil {
			return synchronousImageRequest{}, err
		}
		return synchronousImageRequest{
			endpoint: endpoint,
			payload:  requestPayload,
			parse: func(body []byte) service.AsyncExecutionOutcome {
				var media []service.AsyncMediaSource
				var parseErr error
				if geminiResponse {
					media, parseErr = parseYunwuGeminiImageMedia(body)
				} else {
					media, parseErr = parseYunwuImageMedia(body)
				}
				if parseErr != nil {
					return executorFailure("upstream_parse", "invalid_upstream_response", "yunwu returned a response without valid image artifacts", false)
				}
				return service.AsyncExecutionOutcome{Status: model.AsyncStatusSuccess, Media: media}
			},
		}, nil
	})
}

func (e *YunwuExecutor) prepareRequest(imageRequest dto.ImageRequest, original []byte) (string, []byte, bool, error) {
	model := imageRequest.Model
	if suffix := strings.TrimSpace(os.Getenv("ASYNC_YUNWU_ROUTE_SUFFIX")); suffix != "" {
		switch suffix {
		case "floor", "nitro", "stable":
			model += ":" + suffix
		default:
			return "", nil, false, errors.New("ASYNC_YUNWU_ROUTE_SUFFIX must be floor, nitro or stable")
		}
	}
	if model_setting.IsGeminiModelSupportImagine(imageRequest.Model) {
		endpoint, err := yunwuGeminiImageEndpoint(e.baseURL, model)
		if err != nil {
			return "", nil, false, err
		}
		body, err := yunwuGeminiImagePayload(imageRequest)
		return endpoint, body, true, err
	}
	endpoint, err := yunwuImageEndpoint(e.baseURL)
	if err != nil {
		return "", nil, false, err
	}
	if model == imageRequest.Model {
		return endpoint, original, false, nil
	}
	var requestMap map[string]json.RawMessage
	if err := common.Unmarshal(original, &requestMap); err != nil {
		return "", nil, false, err
	}
	routedModel, err := common.Marshal(model)
	if err != nil {
		return "", nil, false, err
	}
	requestMap["model"] = routedModel
	body, err := common.Marshal(requestMap)
	return endpoint, body, false, err
}

func yunwuGeminiImagePayload(request dto.ImageRequest) ([]byte, error) {
	if request.N != nil && *request.N != 1 {
		return nil, errors.New("yunwu gemini image models support exactly one image per async task")
	}
	aspectRatio, err := yunwuGeminiAspectRatio(request.Size)
	if err != nil {
		return nil, err
	}
	imageSize, err := yunwuGeminiImageSize(request.Quality)
	if err != nil {
		return nil, err
	}
	imageConfig, err := common.Marshal(map[string]string{
		"aspectRatio": aspectRatio,
		"imageSize":   imageSize,
	})
	if err != nil {
		return nil, err
	}
	payload := dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{{
			Role:  "user",
			Parts: []dto.GeminiPart{{Text: request.Prompt}},
		}},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ResponseModalities: []string{"IMAGE", "TEXT"},
			ImageConfig:        imageConfig,
		},
	}
	return common.Marshal(payload)
}

func yunwuGeminiAspectRatio(size string) (string, error) {
	switch strings.TrimSpace(size) {
	case "", "1:1", "256x256", "512x512", "1024x1024":
		return "1:1", nil
	case "3:2", "1536x1024":
		return "3:2", nil
	case "2:3", "1024x1536":
		return "2:3", nil
	case "9:16", "1024x1792":
		return "9:16", nil
	case "16:9", "1792x1024":
		return "16:9", nil
	case "4:3", "3:4", "4:5", "5:4", "21:9":
		return strings.TrimSpace(size), nil
	default:
		return "", errors.New("unsupported yunwu gemini image aspect ratio")
	}
}

func yunwuGeminiImageSize(quality string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "", "auto", "standard", "medium", "1k":
		return "1K", nil
	case "hd", "high", "2k":
		return "2K", nil
	case "4k":
		return "4K", nil
	default:
		return "", errors.New("unsupported yunwu gemini image quality; use 1K, 2K or 4K")
	}
}

func parseYunwuImageMedia(body []byte) ([]service.AsyncMediaSource, error) {
	var response struct {
		Data []struct {
			URL     string `json:"url"`
			B64JSON string `json:"b64_json"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if len(response.Data) == 0 {
		return nil, errors.New("image response data is empty")
	}
	media := make([]service.AsyncMediaSource, 0, len(response.Data))
	for _, item := range response.Data {
		if source, ok := service.ParseDataURLSource(item.URL); ok {
			media = append(media, source)
			continue
		}
		if strings.TrimSpace(item.URL) != "" {
			media = append(media, service.AsyncMediaSource{URL: item.URL})
			continue
		}
		if strings.TrimSpace(item.B64JSON) != "" {
			media = append(media, service.AsyncMediaSource{Base64: item.B64JSON})
			continue
		}
		return nil, errors.New("image response item has no media")
	}
	return media, nil
}

func parseYunwuGeminiImageMedia(body []byte) ([]service.AsyncMediaSource, error) {
	var response dto.GeminiChatResponse
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	media := make([]service.AsyncMediaSource, 0, len(response.Candidates))
	for _, candidate := range response.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData == nil || strings.TrimSpace(part.InlineData.Data) == "" {
				continue
			}
			media = append(media, service.AsyncMediaSource{
				Base64:      part.InlineData.Data,
				ContentType: part.InlineData.MimeType,
			})
		}
	}
	if len(media) == 0 {
		return nil, errors.New("gemini response has no image data")
	}
	return media, nil
}
