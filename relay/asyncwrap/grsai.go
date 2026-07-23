package asyncwrap

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

const grsaiSynchronousImagePath = "/v1/api/generate"

type GRSAIExecutor struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewGRSAIExecutor(baseURL, apiKey string, timeout time.Duration) (*GRSAIExecutor, error) {
	if _, err := grsaiSynchronousImageEndpoint(baseURL); err != nil {
		return nil, err
	}
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("GRS AI API key is empty")
	}
	return &GRSAIExecutor{
		baseURL: strings.TrimSpace(baseURL),
		apiKey:  apiKey,
		client:  newSynchronousImageHTTPClient(timeout),
	}, nil
}

func (e *GRSAIExecutor) Execute(ctx context.Context, payload []byte, markRequestSent func() error) service.AsyncExecutionOutcome {
	if e == nil || e.client == nil {
		return executorFailure("executor", "executor_unavailable", "GRS AI executor is unavailable", true)
	}
	return executeSynchronousImage(ctx, "GRS AI", e.client, e.apiKey, payload, markRequestSent, e.prepareRequest)
}

func (e *GRSAIExecutor) prepareRequest(request dto.ImageRequest, _ []byte) (synchronousImageRequest, error) {
	if request.N != nil && *request.N != 1 {
		return synchronousImageRequest{}, errors.New("GRS AI synchronous image generation supports exactly one image per task")
	}
	endpoint, err := grsaiSynchronousImageEndpoint(e.baseURL)
	if err != nil {
		return synchronousImageRequest{}, err
	}
	images, err := grsaiReferenceImages(request.Images, request.Image)
	if err != nil {
		return synchronousImageRequest{}, err
	}
	payload := struct {
		Model       string   `json:"model"`
		Prompt      string   `json:"prompt"`
		Images      []string `json:"images,omitempty"`
		AspectRatio string   `json:"aspectRatio,omitempty"`
		ImageSize   string   `json:"imageSize,omitempty"`
		ReplyType   string   `json:"replyType"`
	}{
		Model:       request.Model,
		Prompt:      request.Prompt,
		Images:      images,
		AspectRatio: strings.TrimSpace(request.Size),
		ReplyType:   "json",
	}
	normalizedModel := strings.ToLower(strings.TrimSpace(request.Model))
	if strings.HasPrefix(normalizedModel, "nano-banana") &&
		normalizedModel != "nano-banana-2-lite" &&
		normalizedModel != "nano-banana-fast" {
		payload.ImageSize, err = grsaiImageSize(request.Quality)
		if err != nil {
			return synchronousImageRequest{}, err
		}
	}
	requestPayload, err := common.Marshal(payload)
	if err != nil {
		return synchronousImageRequest{}, err
	}
	return synchronousImageRequest{
		endpoint: endpoint,
		payload:  requestPayload,
		parse:    parseGRSAISynchronousImageResponse,
	}, nil
}

func grsaiSynchronousImageEndpoint(baseURL string) (string, error) {
	parsed, err := parseGRSAIBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	parsed.Path = grsaiSynchronousImagePath
	parsed.RawPath = ""
	return parsed.String(), nil
}

func parseGRSAIBaseURL(baseURL string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("GRS AI base URL must be an absolute http or https URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("GRS AI base URL must not contain credentials, query parameters or fragments")
	}
	basePath := strings.TrimRight(parsed.Path, "/")
	if basePath != "" && basePath != "/v1" {
		return nil, errors.New("GRS AI base URL path must be empty or /v1")
	}
	parsed.Path = ""
	parsed.RawPath = ""
	return parsed, nil
}

func grsaiReferenceImages(values ...json.RawMessage) ([]string, error) {
	images := make([]string, 0)
	for _, value := range values {
		if len(value) == 0 || string(value) == "null" {
			continue
		}
		var list []string
		if err := common.Unmarshal(value, &list); err == nil {
			images = append(images, list...)
			continue
		}
		var single string
		if err := common.Unmarshal(value, &single); err == nil && strings.TrimSpace(single) != "" {
			images = append(images, single)
			continue
		}
		return nil, errors.New("GRS AI reference images must be a URL/base64 string or an array of strings")
	}
	return images, nil
}

func grsaiImageSize(quality string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "", "auto", "standard", "medium", "1k":
		return "1K", nil
	case "hd", "high", "2k":
		return "2K", nil
	case "4k":
		return "4K", nil
	default:
		return "", errors.New("unsupported GRS AI image quality; use 1K, 2K or 4K")
	}
}

func parseGRSAISynchronousImageResponse(body []byte) service.AsyncExecutionOutcome {
	var response struct {
		Status  string `json:"status"`
		Results []struct {
			URL string `json:"url"`
		} `json:"results"`
		Error string `json:"error"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return executorFailure("upstream_parse", "invalid_upstream_response", "GRS AI returned invalid JSON", false)
	}
	switch strings.ToLower(strings.TrimSpace(response.Status)) {
	case "succeeded":
		media := make([]service.AsyncMediaSource, 0, len(response.Results))
		for _, result := range response.Results {
			if strings.TrimSpace(result.URL) == "" {
				continue
			}
			if source, ok := service.ParseDataURLSource(result.URL); ok {
				media = append(media, source)
			} else {
				media = append(media, service.AsyncMediaSource{URL: result.URL})
			}
		}
		if len(media) == 0 {
			return executorFailure("upstream_parse", "invalid_upstream_response", "GRS AI synchronous response did not contain an image", false)
		}
		return service.AsyncExecutionOutcome{Status: model.AsyncStatusSuccess, Media: media}
	case "failed", "violation":
		message := strings.TrimSpace(response.Error)
		if message == "" {
			message = "GRS AI rejected the synchronous image request"
		}
		return executorFailure("upstream_response", "upstream_generation_failed", message, true)
	case "running":
		return service.AsyncExecutionOutcome{
			Status:       model.AsyncStatusUncertain,
			ErrorPhase:   "upstream_response",
			ErrorCode:    "upstream_sync_result_pending",
			ErrorMessage: "GRS AI did not return a final result in synchronous mode; no upstream async polling was performed",
		}
	default:
		return executorFailure("upstream_parse", "invalid_upstream_response", "GRS AI returned an unknown synchronous response status", false)
	}
}
