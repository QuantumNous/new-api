package openai

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func OaiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = common.Unmarshal(responseBody, &responsesResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	return writeFinalResponsesResponse(c, info, resp, &responsesResponse, responseBody)
}

// OaiResponsesBufferedStreamHandler serves non-streaming clients against
// upstreams that only support streaming (e.g. the Codex backend): it consumes
// the upstream SSE stream and writes a single aggregated JSON response.
func OaiResponsesBufferedStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	result, apiErr := bufferResponsesStreamFinalResponse(c, info, resp)
	if apiErr != nil {
		return nil, apiErr
	}
	if !result.terminalSeen {
		return nil, types.NewOpenAIError(fmt.Errorf("responses stream ended without a terminal event"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	responseBody := []byte(result.responseBody)
	if len(responseBody) == 0 {
		var err error
		responseBody, err = common.Marshal(result.response)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
		}
	}
	setBufferedJSONResponseContentType(resp)

	return writeFinalResponsesResponse(c, info, resp, result.response, responseBody)
}

func setBufferedJSONResponseContentType(resp *http.Response) {
	if resp.Header == nil {
		resp.Header = make(http.Header)
	}
	resp.Header.Set("Content-Type", "application/json")
}

type bufferedResponsesResult struct {
	response     *dto.OpenAIResponsesResponse
	responseBody json.RawMessage
	terminalSeen bool
}

type bufferedResponsesAccumulator struct {
	inner            *relayconvert.ResponsesBufferedAccumulator
	itemRaws         map[int]json.RawMessage
	supplementedRaws []json.RawMessage
}

func newBufferedResponsesAccumulator() *bufferedResponsesAccumulator {
	return &bufferedResponsesAccumulator{
		inner:    relayconvert.NewResponsesBufferedAccumulator(),
		itemRaws: make(map[int]json.RawMessage),
	}
}

func (a *bufferedResponsesAccumulator) ProcessEvent(event *dto.ResponsesStreamResponse, raw string) {
	if a == nil || event == nil {
		return
	}
	a.inner.ProcessEvent(event)
	switch event.Type {
	case "response.output_item.done":
		if event.Item == nil {
			return
		}
		var itemEvent struct {
			Item json.RawMessage `json:"item"`
		}
		if err := common.UnmarshalJsonStr(raw, &itemEvent); err != nil || len(itemEvent.Item) == 0 {
			return
		}
		key := -1
		if event.OutputIndex != nil {
			key = *event.OutputIndex
		} else if event.Item.ID != "" {
			key = int(crc32.ChecksumIEEE([]byte(event.Item.ID)))
		}
		a.itemRaws[key] = itemEvent.Item
	case "response.completed", "response.done":
		a.supplementedRaws = nil
	}
}

func (a *bufferedResponsesAccumulator) SupplementResponseOutput(resp *dto.OpenAIResponsesResponse) {
	if a == nil || resp == nil || len(resp.Output) > 0 {
		return
	}
	typed := a.inner.BuildOutput()
	if len(typed) == 0 && len(a.itemRaws) == 0 {
		return
	}
	output := make([]json.RawMessage, 0, len(typed)+len(a.itemRaws))
	for i := range typed {
		raw, err := common.Marshal(&typed[i])
		if err != nil {
			continue
		}
		output = append(output, raw)
	}
	keys := make([]int, 0, len(a.itemRaws))
	for key := range a.itemRaws {
		keys = append(keys, key)
	}
	sort.Ints(keys)
	for _, key := range keys {
		output = append(output, a.itemRaws[key])
	}
	rawOutput, err := common.Marshal(output)
	if err != nil {
		return
	}
	if err := common.Unmarshal(rawOutput, &resp.Output); err != nil {
		resp.Output = typed
		return
	}
	a.supplementedRaws = output
}

func (a *bufferedResponsesAccumulator) SupplementedOutputRaw() json.RawMessage {
	if a == nil || len(a.supplementedRaws) == 0 {
		return nil
	}
	raw, err := common.Marshal(a.supplementedRaws)
	if err != nil {
		return nil
	}
	return raw
}

// bufferResponsesStreamFinalResponse consumes an upstream Responses SSE stream.
// Callers can distinguish a real terminal response from the synthesized fallback
// retained for compatibility with non-standard chat-completions upstreams.
func bufferResponsesStreamFinalResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*bufferedResponsesResult, *types.NewAPIError) {
	result := &bufferedResponsesResult{}
	accumulator := newBufferedResponsesAccumulator()

	if c != nil && c.Request != nil {
		stopCancel := context.AfterFunc(c.Request.Context(), func() {
			_ = resp.Body.Close()
		})
		defer stopCancel()
	}

	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		data, ok := strings.CutPrefix(scanner.Text(), "data:")
		if !ok {
			continue
		}
		data = strings.TrimSpace(data)
		if data == "" {
			continue
		}
		if data == "[DONE]" {
			break
		}

		var streamResp dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResp); err != nil {
			logger.LogError(c, "failed to unmarshal buffered responses stream event: "+err.Error())
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if streamResp.Type == "error" {
			var errorEvent struct {
				Error   *types.OpenAIError `json:"error"`
				Message string             `json:"message"`
				Code    any                `json:"code"`
				Param   string             `json:"param"`
			}
			if err := common.UnmarshalJsonStr(data, &errorEvent); err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			if errorEvent.Error != nil {
				if errorEvent.Error.Type == "" {
					errorEvent.Error.Type = "server_error"
				}
				return nil, types.WithOpenAIError(*errorEvent.Error, http.StatusInternalServerError)
			}
			if errorEvent.Message == "" {
				errorEvent.Message = "responses stream error"
			}
			return nil, types.WithOpenAIError(types.OpenAIError{
				Message: errorEvent.Message,
				Type:    "server_error",
				Param:   errorEvent.Param,
				Code:    errorEvent.Code,
			}, http.StatusInternalServerError)
		}

		accumulator.ProcessEvent(&streamResp, data)
		switch streamResp.Type {
		case "response.completed", "response.done", "response.incomplete":
			result.terminalSeen = true
			result.response = streamResp.Response
			var terminalEvent struct {
				Response json.RawMessage `json:"response"`
			}
			if err := common.UnmarshalJsonStr(data, &terminalEvent); err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			result.responseBody = terminalEvent.Response
			if streamResp.Type == "response.incomplete" && result.response == nil {
				result.response = &dto.OpenAIResponsesResponse{Status: json.RawMessage(`"incomplete"`)}
				result.responseBody = nil
			}
			if result.response == nil {
				return nil, types.NewOpenAIError(fmt.Errorf("responses terminal event is missing response"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			if streamResp.Type == "response.incomplete" && len(result.response.Status) == 0 {
				result.response.Status = json.RawMessage(`"incomplete"`)
				result.responseBody = nil
			}
		case "response.failed", "response.error":
			if streamResp.Response != nil {
				if oaiErr := streamResp.Response.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
					return nil, types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
				}
			}
			return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: %s", streamResp.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		if result.terminalSeen {
			break
		}
	}
	if c != nil && c.Request != nil {
		if err := c.Request.Context().Err(); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if result.response == nil {
		result.response = &dto.OpenAIResponsesResponse{
			ID:        helper.GetResponseID(c),
			CreatedAt: int(time.Now().Unix()),
			Model:     info.UpstreamModelName,
			Status:    json.RawMessage(`"completed"`),
		}
	}
	outputWasMissing := len(result.response.Output) == 0
	accumulator.SupplementResponseOutput(result.response)
	if outputWasMissing {
		if outputRaw := accumulator.SupplementedOutputRaw(); len(outputRaw) > 0 && len(result.responseBody) > 0 {
			var responseFields map[string]json.RawMessage
			if err := common.Unmarshal(result.responseBody, &responseFields); err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			responseFields["output"] = outputRaw
			var err error
			result.responseBody, err = common.Marshal(responseFields)
			if err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			}
		}
	}
	return result, nil
}

// writeFinalResponsesResponse writes the final Responses JSON body to the
// client and computes usage plus per-call tool/image billing from it.
func writeFinalResponsesResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, responsesResponse *dto.OpenAIResponsesResponse, responseBody []byte) (*dto.Usage, *types.NewAPIError) {
	if oaiError := responsesResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	usage := dto.Usage{}
	if responsesResponse.Usage != nil {
		usage.PromptTokens = responsesResponse.Usage.InputTokens
		usage.CompletionTokens = responsesResponse.Usage.OutputTokens
		usage.TotalTokens = responsesResponse.Usage.TotalTokens
		if responsesResponse.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = responsesResponse.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.CacheWriteTokens = responsesResponse.Usage.InputTokensDetails.CacheWriteTokens
		}
	}
	// Count actual tool invocations from Output (not tool declarations).
	for _, output := range responsesResponse.Output {
		switch output.Type {
		case dto.BuildInCallWebSearchCall:
			info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
		case dto.BuildInCallFileSearchCall:
			info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
		case dto.BuildInCallFunctionCall:
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, output.Name)
		}
	}

	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	if !relaycommon.IsNonBillableResponsesStatus(responsesResponse.Status) {
		for i := range responsesResponse.Output {
			idx := i
			imageCounter.Observe(&responsesResponse.Output[i], &idx)
		}
	}
	imageCounter.Commit(info)

	return &usage, nil
}

func OaiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var usage = &dto.Usage{}
	var responseTextBuilder strings.Builder
	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	imageCommitted := false

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		sendResponsesStreamData(c, streamResponse, data)
		switch streamResponse.Type {
		case "response.completed", "response.done":
			if streamResponse.Response != nil {
				if streamResponse.Response.Usage != nil {
					if streamResponse.Response.Usage.InputTokens != 0 {
						usage.PromptTokens = streamResponse.Response.Usage.InputTokens
					}
					if streamResponse.Response.Usage.OutputTokens != 0 {
						usage.CompletionTokens = streamResponse.Response.Usage.OutputTokens
					}
					if streamResponse.Response.Usage.TotalTokens != 0 {
						usage.TotalTokens = streamResponse.Response.Usage.TotalTokens
					}
					if streamResponse.Response.Usage.InputTokensDetails != nil {
						usage.PromptTokensDetails.CachedTokens = streamResponse.Response.Usage.InputTokensDetails.CachedTokens
						usage.PromptTokensDetails.CacheWriteTokens = streamResponse.Response.Usage.InputTokensDetails.CacheWriteTokens
					}
				}
				if !imageCommitted {
					if relaycommon.IsNonBillableResponsesStatus(streamResponse.Response.Status) {
						imageCounter.Reset()
						imageCounter.Commit(info)
						imageCommitted = true
					} else {
						for i := range streamResponse.Response.Output {
							idx := i
							imageCounter.Observe(&streamResponse.Response.Output[i], &idx)
						}
						imageCounter.Commit(info)
						imageCommitted = true
					}
				}
			} else if !imageCommitted {
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.failed", "response.incomplete", "response.cancelled", "response.canceled":
			if !imageCommitted {
				imageCounter.Reset()
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.output_text.delta":
			// 处理输出文本
			responseTextBuilder.WriteString(streamResponse.Delta)
		case dto.ResponsesOutputTypeItemDone:
			if streamResponse.Item != nil {
				switch streamResponse.Item.Type {
				case dto.BuildInCallWebSearchCall:
					info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				case dto.BuildInCallFileSearchCall:
					info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
				case dto.BuildInCallFunctionCall:
					info.CountBillableToolCall(dto.BuildInCallFunctionCall, streamResponse.Item.Name)
				case dto.ResponsesOutputTypeImageGenerationCall:
					if !imageCommitted {
						imageCounter.Observe(streamResponse.Item, streamResponse.OutputIndex)
					}
				}
			}
		}
	})

	if usage.CompletionTokens == 0 {
		// 计算输出文本的 token 数量
		tempStr := responseTextBuilder.String()
		if len(tempStr) > 0 {
			// 非正常结束，使用输出文本的 token 数量
			completionTokens := service.CountTextToken(tempStr, info.UpstreamModelName)
			usage.CompletionTokens = completionTokens
		}
	}

	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}

	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	return usage, nil
}
