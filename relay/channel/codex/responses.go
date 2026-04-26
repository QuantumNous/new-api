package codex

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func handleResponsesNonStream(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	if !looksLikeSSE(responseBody) {
		return writeResponsesJSONBody(c, resp, info, responseBody)
	}

	responseJSON, usage, newAPIError := collectCompletedResponseFromSSE(responseBody)
	if newAPIError != nil {
		return nil, newAPIError
	}
	response := gjson.ParseBytes(responseJSON)
	if responseHasImageGenerationOutput(response) {
		markImageGenerationCall(c, responseImageGenerationQuality(response), responseImageGenerationSize(response))
	}
	recordResponsesBuiltInToolUsageFromGJSON(info, response)

	jsonResp := cloneResponseWithContentType(resp, "application/json")
	service.IOCopyBytesGracefully(c, jsonResp, responseJSON)
	return usage, nil
}

func handleResponsesStream(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	usage := &dto.Usage{}
	var responseTextBuilder strings.Builder

	relayhelper.StreamScannerHandler(c, resp, info, func(data string, sr *relayhelper.StreamResult) {
		payload := gjson.Parse(data)
		eventType := payload.Get("type").String()
		writeResponsesStreamPayload(c, eventType, data)

		switch eventType {
		case "response.completed":
			response := payload.Get("response")
			if response.Exists() && response.IsObject() {
				mergeResponseUsage(usage, usageFromResponseGJSON(response))
				if responseHasImageGenerationOutput(response) {
					markImageGenerationCall(c, responseImageGenerationQuality(response), responseImageGenerationSize(response))
				}
				recordResponsesBuiltInToolUsageFromGJSON(info, response)
			}
			mergeResponseUsage(usage, usageFromCodexToolUsageImageGen([]byte(data)))
		case "response.output_text.delta":
			responseTextBuilder.WriteString(payload.Get("delta").String())
		case dto.ResponsesOutputTypeItemDone:
			item := payload.Get("item")
			switch item.Get("type").String() {
			case dto.ResponsesOutputTypeImageGenerationCall:
				markImageGenerationCall(c, item.Get("quality").String(), item.Get("size").String())
				recordResponsesBuiltInToolCall(info, imageGenerationTool)
			case dto.BuildInCallWebSearchCall:
				recordResponsesBuiltInToolCall(info, dto.BuildInToolWebSearchPreview)
			}
		}
	})

	if usage.CompletionTokens == 0 {
		tempStr := responseTextBuilder.String()
		if len(tempStr) > 0 {
			modelName := ""
			if info != nil && info.ChannelMeta != nil {
				modelName = info.UpstreamModelName
			}
			usage.CompletionTokens = service.CountTextToken(tempStr, modelName)
		}
	}
	if info != nil && usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return usage, nil
}

func writeResponsesStreamPayload(c *gin.Context, eventType string, data string) {
	if eventType != "" {
		c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", eventType)})
	}
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s", data)})
	_ = relayhelper.FlushWriter(c)
}

func looksLikeSSE(body []byte) bool {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		return strings.HasPrefix(line, "data:") || strings.HasPrefix(line, "event:")
	}
	return false
}

func writeResponsesJSONBody(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, body []byte) (*dto.Usage, *types.NewAPIError) {
	response := gjson.ParseBytes(body)
	if !response.Exists() || !response.IsObject() {
		return nil, types.NewOpenAIError(fmt.Errorf("codex upstream returned invalid JSON response"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if errResult := response.Get("error"); errResult.Exists() && errResult.Type != gjson.Null {
		message := extractCodexErrorMessage(body)
		if message == "" {
			message = strings.TrimSpace(errResult.String())
		}
		if message == "" {
			message = strings.TrimSpace(errResult.Raw)
		}
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: message,
			Type:    "upstream_error",
			Code:    types.ErrorCodeBadResponseBody,
		}, resp.StatusCode)
	}

	if responseHasImageGenerationOutput(response) {
		markImageGenerationCall(c, responseImageGenerationQuality(response), responseImageGenerationSize(response))
	}

	jsonResp := cloneResponseWithContentType(resp, "application/json")
	service.IOCopyBytesGracefully(c, jsonResp, body)

	usage := usageFromResponseGJSON(response)
	recordResponsesBuiltInToolUsageFromGJSON(info, response)
	return usage, nil
}

func collectCompletedResponseFromSSE(body []byte) ([]byte, *dto.Usage, *types.NewAPIError) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 64<<10), 64<<20)

	var outputItems []json.RawMessage
	var imageOutputItems []json.RawMessage
	for scanner.Scan() {
		payload := ssePayloadFromLine(scanner.Text())
		if len(payload) == 0 || bytes.Equal(payload, []byte("[DONE]")) {
			continue
		}

		eventType := gjson.GetBytes(payload, "type").String()
		switch eventType {
		case dto.ResponsesOutputTypeItemDone:
			item := gjson.GetBytes(payload, "item")
			if item.Exists() && item.IsObject() {
				outputItems = append(outputItems, json.RawMessage(item.Raw))
				if item.Get("type").String() == dto.ResponsesOutputTypeImageGenerationCall && strings.TrimSpace(item.Get("result").String()) != "" {
					imageOutputItems = append(imageOutputItems, json.RawMessage(item.Raw))
				}
			}
		case "response.completed":
			response := gjson.GetBytes(payload, "response")
			if !response.Exists() || !response.IsObject() {
				return nil, nil, types.NewOpenAIError(fmt.Errorf("codex response.completed missing response object"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
			}
			responseRaw := []byte(response.Raw)
			if len(outputItems) > 0 && responseOutputLen(response) == 0 {
				merged, err := appendResponseOutputItems(responseRaw, outputItems)
				if err != nil {
					return nil, nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
				}
				responseRaw = merged
			} else if len(imageOutputItems) > 0 && !responseHasImageGenerationOutput(response) {
				merged, err := appendResponseOutputItems(responseRaw, imageOutputItems)
				if err != nil {
					return nil, nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
				}
				responseRaw = merged
			}
			usage := usageFromResponseGJSON(gjson.ParseBytes(responseRaw))
			mergeResponseUsage(usage, usageFromCodexToolUsageImageGen(payload))
			return responseRaw, usage, nil
		case "response.error", "response.failed":
			message := extractCodexErrorMessage(payload)
			if message == "" {
				message = strings.TrimSpace(string(payload))
			}
			return nil, nil, types.NewOpenAIError(fmt.Errorf("codex upstream error: %s", truncateErrorMessage(message)), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	return nil, nil, types.NewOpenAIError(fmt.Errorf("codex stream ended before response.completed"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
}

func responseOutputLen(response gjson.Result) int {
	output := response.Get("output")
	if !output.IsArray() {
		return 0
	}
	return len(output.Array())
}

func responseHasImageGenerationOutput(response gjson.Result) bool {
	output := response.Get("output")
	if !output.IsArray() {
		return false
	}
	for _, item := range output.Array() {
		if item.Get("type").String() == dto.ResponsesOutputTypeImageGenerationCall {
			return true
		}
	}
	return false
}

func responseImageGenerationQuality(response gjson.Result) string {
	return firstImageGenerationOutputField(response, "quality")
}

func responseImageGenerationSize(response gjson.Result) string {
	return firstImageGenerationOutputField(response, "size")
}

func firstImageGenerationOutputField(response gjson.Result, field string) string {
	output := response.Get("output")
	if !output.IsArray() {
		return ""
	}
	for _, item := range output.Array() {
		if item.Get("type").String() == dto.ResponsesOutputTypeImageGenerationCall {
			return item.Get(field).String()
		}
	}
	return ""
}

func appendResponseOutputItems(responseRaw []byte, items []json.RawMessage) ([]byte, error) {
	var response map[string]any
	if err := common.Unmarshal(responseRaw, &response); err != nil {
		return nil, err
	}
	output, _ := response["output"].([]any)
	for _, rawItem := range items {
		var item any
		if err := common.Unmarshal(rawItem, &item); err != nil {
			return nil, err
		}
		output = append(output, item)
	}
	response["output"] = output
	return common.Marshal(response)
}

func ssePayloadFromLine(line string) []byte {
	line = strings.TrimSpace(strings.TrimRight(line, "\r"))
	if !strings.HasPrefix(line, "data:") {
		return nil
	}
	payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
	if payload == "" {
		return nil
	}
	return []byte(payload)
}

func usageFromResponseGJSON(response gjson.Result) *dto.Usage {
	usage := &dto.Usage{}
	usageRaw := response.Get("usage")
	if !usageRaw.Exists() || !usageRaw.IsObject() {
		return usage
	}
	usage.PromptTokens = int(usageRaw.Get("input_tokens").Int())
	usage.CompletionTokens = int(usageRaw.Get("output_tokens").Int())
	usage.TotalTokens = int(usageRaw.Get("total_tokens").Int())
	usage.InputTokens = usage.PromptTokens
	usage.OutputTokens = usage.CompletionTokens
	usage.PromptTokensDetails.CachedTokens = int(usageRaw.Get("input_tokens_details.cached_tokens").Int())
	return usage
}

func usageFromCodexToolUsageImageGen(payload []byte) *dto.Usage {
	usageRaw := gjson.GetBytes(payload, "response.tool_usage.image_gen")
	if !usageRaw.Exists() || !usageRaw.IsObject() {
		return &dto.Usage{}
	}
	var responseUsage dto.Usage
	if err := common.Unmarshal([]byte(usageRaw.Raw), &responseUsage); err != nil {
		return &dto.Usage{}
	}
	return usageFromResponseUsage(&responseUsage)
}

func mergeResponseUsage(dst *dto.Usage, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	if src.PromptTokens != 0 {
		dst.PromptTokens = src.PromptTokens
	}
	if src.CompletionTokens != 0 {
		dst.CompletionTokens = src.CompletionTokens
	}
	if src.TotalTokens != 0 {
		dst.TotalTokens = src.TotalTokens
	}
	if src.InputTokens != 0 {
		dst.InputTokens = src.InputTokens
	}
	if src.OutputTokens != 0 {
		dst.OutputTokens = src.OutputTokens
	}
	if src.InputTokensDetails != nil {
		dst.InputTokensDetails = src.InputTokensDetails
	}
	if src.PromptTokensDetails.CachedTokens != 0 {
		dst.PromptTokensDetails.CachedTokens = src.PromptTokensDetails.CachedTokens
	}
}

func markImageGenerationCall(c *gin.Context, quality string, size string) {
	c.Set("image_generation_call", true)
	if strings.TrimSpace(quality) != "" {
		c.Set("image_generation_call_quality", quality)
	}
	if strings.TrimSpace(size) != "" {
		c.Set("image_generation_call_size", size)
	}
}

func recordResponsesBuiltInToolCall(info *relaycommon.RelayInfo, toolType string) {
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return
	}
	buildToolInfo, ok := info.ResponsesUsageInfo.BuiltInTools[toolType]
	if ok && buildToolInfo != nil {
		buildToolInfo.CallCount++
	}
}

func recordResponsesBuiltInToolUsageFromGJSON(info *relaycommon.RelayInfo, response gjson.Result) {
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return
	}
	tools := response.Get("tools")
	if !tools.IsArray() {
		return
	}
	for _, tool := range tools.Array() {
		buildToolInfo, ok := info.ResponsesUsageInfo.BuiltInTools[tool.Get("type").String()]
		if ok && buildToolInfo != nil {
			buildToolInfo.CallCount++
		}
	}
}

func cloneResponseWithContentType(resp *http.Response, contentType string) *http.Response {
	if resp == nil {
		return nil
	}
	cloned := *resp
	cloned.Header = resp.Header.Clone()
	cloned.Header.Set("Content-Type", contentType)
	cloned.Header.Del("Transfer-Encoding")
	return &cloned
}
