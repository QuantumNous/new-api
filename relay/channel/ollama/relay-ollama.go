package ollama

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func openAIChatToOllamaChat(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaChatRequest, error) {
	chatReq := &OllamaChatRequest{
		Model:   r.Model,
		Stream:  r.Stream,
		Options: map[string]any{},
		Think:   r.Think,
	}
	if r.ResponseFormat != nil {
		if r.ResponseFormat.Type == "json" {
			chatReq.Format = "json"
		} else if r.ResponseFormat.Type == "json_schema" {
			if len(r.ResponseFormat.JsonSchema) > 0 {
				var schema any
				_ = json.Unmarshal(r.ResponseFormat.JsonSchema, &schema)
				chatReq.Format = schema
			}
		}
	}

	// options mapping
	if r.Temperature != nil {
		chatReq.Options["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		chatReq.Options["top_p"] = r.TopP
	}
	if r.TopK != 0 {
		chatReq.Options["top_k"] = r.TopK
	}
	if r.FrequencyPenalty != 0 {
		chatReq.Options["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		chatReq.Options["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		chatReq.Options["seed"] = int(r.Seed)
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		chatReq.Options["num_predict"] = int(mt)
	}

	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			chatReq.Options["stop"] = []string{v}
		case []string:
			chatReq.Options["stop"] = v
		case []any:
			arr := make([]string, 0, len(v))
			for _, i := range v {
				if s, ok := i.(string); ok {
					arr = append(arr, s)
				}
			}
			if len(arr) > 0 {
				chatReq.Options["stop"] = arr
			}
		}
	}

	if len(r.Tools) > 0 {
		tools := make([]OllamaTool, 0, len(r.Tools))
		for _, t := range r.Tools {
			tools = append(tools, OllamaTool{Type: "function", Function: OllamaToolFunction{Name: t.Function.Name, Description: t.Function.Description, Parameters: t.Function.Parameters}})
		}
		chatReq.Tools = tools
	}

	chatReq.Messages = make([]OllamaChatMessage, 0, len(r.Messages))
	for _, m := range r.Messages {
		var textBuilder strings.Builder
		var images []string
		if m.IsStringContent() {
			textBuilder.WriteString(m.StringContent())
		} else {
			parts := m.ParseContent()
			for _, part := range parts {
				if part.Type == dto.ContentTypeImageURL {
					img := part.GetImageMedia()
					if img != nil && img.Url != "" {
						var base64Data string
						if strings.HasPrefix(img.Url, "http") {
							fileData, err := service.GetFileBase64FromUrl(c, img.Url, "fetch image for ollama chat")
							if err != nil {
								return nil, err
							}
							base64Data = fileData.Base64Data
						} else if strings.HasPrefix(img.Url, "data:") {
							if idx := strings.Index(img.Url, ","); idx != -1 && idx+1 < len(img.Url) {
								base64Data = img.Url[idx+1:]
							}
						} else {
							base64Data = img.Url
						}
						if base64Data != "" {
							images = append(images, base64Data)
						}
					}
				} else if part.Type == dto.ContentTypeText {
					textBuilder.WriteString(part.Text)
				}
			}
		}
		cm := OllamaChatMessage{Role: m.Role, Content: textBuilder.String()}
		if len(images) > 0 {
			cm.Images = images
		}
		if m.Role == "tool" && m.Name != nil {
			cm.ToolName = *m.Name
		}
		if m.ToolCalls != nil && len(m.ToolCalls) > 0 {
			parsed := m.ParseToolCalls()
			if len(parsed) > 0 {
				calls := make([]OllamaToolCall, 0, len(parsed))
				for _, tc := range parsed {
					var args interface{}
					if tc.Function.Arguments != "" {
						_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
					}
					if args == nil {
						args = map[string]any{}
					}
					oc := OllamaToolCall{}
					oc.Function.Name = tc.Function.Name
					oc.Function.Arguments = args
					calls = append(calls, oc)
				}
				cm.ToolCalls = calls
			}
		}
		chatReq.Messages = append(chatReq.Messages, cm)
	}
	return chatReq, nil
}

// openAIToGenerate converts OpenAI completions request to Ollama generate
func openAIToGenerate(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaGenerateRequest, error) {
	gen := &OllamaGenerateRequest{
		Model:   r.Model,
		Stream:  r.Stream,
		Options: map[string]any{},
		Think:   r.Think,
	}
	// Prompt may be in r.Prompt (string or []any)
	if r.Prompt != nil {
		switch v := r.Prompt.(type) {
		case string:
			gen.Prompt = v
		case []any:
			var sb strings.Builder
			for _, it := range v {
				if s, ok := it.(string); ok {
					sb.WriteString(s)
				}
			}
			gen.Prompt = sb.String()
		default:
			gen.Prompt = fmt.Sprintf("%v", r.Prompt)
		}
	}
	if r.Suffix != nil {
		if s, ok := r.Suffix.(string); ok {
			gen.Suffix = s
		}
	}
	if r.ResponseFormat != nil {
		if r.ResponseFormat.Type == "json" {
			gen.Format = "json"
		} else if r.ResponseFormat.Type == "json_schema" {
			var schema any
			_ = json.Unmarshal(r.ResponseFormat.JsonSchema, &schema)
			gen.Format = schema
		}
	}
	if r.Temperature != nil {
		gen.Options["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		gen.Options["top_p"] = r.TopP
	}
	if r.TopK != 0 {
		gen.Options["top_k"] = r.TopK
	}
	if r.FrequencyPenalty != 0 {
		gen.Options["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		gen.Options["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		gen.Options["seed"] = int(r.Seed)
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		gen.Options["num_predict"] = int(mt)
	}
	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			gen.Options["stop"] = []string{v}
		case []string:
			gen.Options["stop"] = v
		case []any:
			arr := make([]string, 0, len(v))
			for _, i := range v {
				if s, ok := i.(string); ok {
					arr = append(arr, s)
				}
			}
			if len(arr) > 0 {
				gen.Options["stop"] = arr
			}
		}
	}
	return gen, nil
}

func requestOpenAI2Embeddings(r dto.EmbeddingRequest) *OllamaEmbeddingRequest {
	opts := map[string]any{}
	if r.Temperature != nil {
		opts["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		opts["top_p"] = r.TopP
	}
	if r.FrequencyPenalty != 0 {
		opts["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		opts["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		opts["seed"] = int(r.Seed)
	}
	if r.Dimensions != 0 {
		opts["dimensions"] = r.Dimensions
	}
	input := r.ParseInput()
	if len(input) == 1 {
		return &OllamaEmbeddingRequest{Model: r.Model, Input: input[0], Options: opts, Dimensions: r.Dimensions}
	}
	return &OllamaEmbeddingRequest{Model: r.Model, Input: input, Options: opts, Dimensions: r.Dimensions}
}

func ollamaEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var oResp OllamaEmbeddingResponse
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	if err = common.Unmarshal(body, &oResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oResp.Error != "" {
		return nil, types.NewOpenAIError(fmt.Errorf("ollama error: %s", oResp.Error), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	data := make([]dto.OpenAIEmbeddingResponseItem, 0, len(oResp.Embeddings))
	for i, emb := range oResp.Embeddings {
		data = append(data, dto.OpenAIEmbeddingResponseItem{Index: i, Object: "embedding", Embedding: emb})
	}
	usage := &dto.Usage{PromptTokens: oResp.PromptEvalCount, CompletionTokens: 0, TotalTokens: oResp.PromptEvalCount}
	embResp := &dto.OpenAIEmbeddingResponse{Object: "list", Data: data, Model: info.UpstreamModelName, Usage: *usage}
	out, _ := common.Marshal(embResp)
	service.IOCopyBytesGracefully(c, resp, out)
	return usage, nil
}

func FetchOllamaModels(baseURL, apiKey string) ([]OllamaModel, error) {
	url := fmt.Sprintf("%s/api/tags", baseURL)

	client := &http.Client{}
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}

	// Ollama 通常不需要 Bearer token，但为了兼容性保留
	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return nil, fmt.Errorf("服务器返回错误 %d: %s", response.StatusCode, string(body))
	}

	var tagsResponse OllamaTagsResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %v", err)
	}

	err = common.Unmarshal(body, &tagsResponse)
	if err != nil {
		return nil, fmt.Errorf("解析响应失败: %v", err)
	}

	return tagsResponse.Models, nil
}

// 拉取 Ollama 模型 (非流式)
func PullOllamaModel(baseURL, apiKey, modelName string) error {
	url := fmt.Sprintf("%s/api/pull", baseURL)

	pullRequest := OllamaPullRequest{
		Name:   modelName,
		Stream: false, // 非流式，简化处理
	}

	requestBody, err := common.Marshal(pullRequest)
	if err != nil {
		return fmt.Errorf("序列化请求失败: %v", err)
	}

	client := &http.Client{
		Timeout: 30 * 60 * 1000 * time.Millisecond, // 30分钟超时，支持大模型
	}
	request, err := http.NewRequest("POST", url, strings.NewReader(string(requestBody)))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("请求失败: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("拉取模型失败 %d: %s", response.StatusCode, string(body))
	}

	return nil
}

// 流式拉取 Ollama 模型 (支持进度回调)
func PullOllamaModelStream(baseURL, apiKey, modelName string, progressCallback func(OllamaPullResponse)) error {
	url := fmt.Sprintf("%s/api/pull", baseURL)

	pullRequest := OllamaPullRequest{
		Name:   modelName,
		Stream: true, // 启用流式
	}

	requestBody, err := common.Marshal(pullRequest)
	if err != nil {
		return fmt.Errorf("序列化请求失败: %v", err)
	}

	client := &http.Client{
		Timeout: 60 * 60 * 1000 * time.Millisecond, // 1小时超时，支持超大模型
	}
	request, err := http.NewRequest("POST", url, strings.NewReader(string(requestBody)))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("请求失败: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("拉取模型失败 %d: %s", response.StatusCode, string(body))
	}

	// 读取流式响应
	scanner := bufio.NewScanner(response.Body)
	successful := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		var pullResponse OllamaPullResponse
		if err := common.Unmarshal([]byte(line), &pullResponse); err != nil {
			continue // 忽略解析失败的行
		}

		if progressCallback != nil {
			progressCallback(pullResponse)
		}

		// 检查是否出现错误或完成
		if strings.EqualFold(pullResponse.Status, "error") {
			return fmt.Errorf("拉取模型失败: %s", strings.TrimSpace(line))
		}
		if strings.EqualFold(pullResponse.Status, "success") {
			successful = true
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("读取流式响应失败: %v", err)
	}

	if !successful {
		return fmt.Errorf("拉取模型未完成: 未收到成功状态")
	}

	return nil
}

// 删除 Ollama 模型
func DeleteOllamaModel(baseURL, apiKey, modelName string) error {
	url := fmt.Sprintf("%s/api/delete", baseURL)

	deleteRequest := OllamaDeleteRequest{
		Name: modelName,
	}

	requestBody, err := common.Marshal(deleteRequest)
	if err != nil {
		return fmt.Errorf("序列化请求失败: %v", err)
	}

	client := &http.Client{}
	request, err := http.NewRequest("DELETE", url, strings.NewReader(string(requestBody)))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("请求失败: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("删除模型失败 %d: %s", response.StatusCode, string(body))
	}

	return nil
}

func FetchOllamaVersion(baseURL, apiKey string) (string, error) {
	trimmedBase := strings.TrimRight(baseURL, "/")
	if trimmedBase == "" {
		return "", fmt.Errorf("baseURL 为空")
	}

	url := fmt.Sprintf("%s/api/version", trimmedBase)

	client := &http.Client{Timeout: 10 * time.Second}
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %v", err)
	}

	if apiKey != "" {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("请求失败: %v", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %v", err)
	}

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("查询版本失败 %d: %s", response.StatusCode, string(body))
	}

	var versionResp struct {
		Version string `json:"version"`
	}

	if err := json.Unmarshal(body, &versionResp); err != nil {
		return "", fmt.Errorf("解析响应失败: %v", err)
	}

	if versionResp.Version == "" {
		return "", fmt.Errorf("未返回版本信息")
	}

	return versionResp.Version, nil
}
