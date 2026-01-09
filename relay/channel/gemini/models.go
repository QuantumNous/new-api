package gemini

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/service"
)

type Model struct {
	Name                       string   `json:"name"`
	Version                    string   `json:"version"`
	DisplayName                string   `json:"displayName"`
	Description                string   `json:"description"`
	InputTokenLimit            int      `json:"inputTokenLimit"`
	OutputTokenLimit           int      `json:"outputTokenLimit"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
	Temperature                float64  `json:"temperature,omitempty"`
	TopP                       float64  `json:"topP,omitempty"`
	TopK                       int      `json:"topK,omitempty"`
	MaxTemperature             float64  `json:"maxTemperature,omitempty"`
	Thinking                   bool     `json:"thinking,omitempty"`
}

type ModelsResponse struct {
	Models        []Model `json:"models"`
	NextPageToken string  `json:"nextPageToken,omitempty"`
}

func FetchModels(baseURL, key string, proxy string) (*ModelsResponse, error) {
	url := fmt.Sprintf("%s/v1beta/models?key=%s", baseURL, key)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status code: %d", res.StatusCode)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	res.Body.Close()
	var modelsResponse ModelsResponse
	if err = json.Unmarshal(body, &modelsResponse); err != nil {
		return nil, fmt.Errorf("解析Gemini响应失败: %w", err)
	}
	return &modelsResponse, nil
}
