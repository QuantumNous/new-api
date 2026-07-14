package coze

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

// convertCozeChatRequest maps supported OpenAI chat fields to a Coze request.
func convertCozeChatRequest(c *gin.Context, request dto.GeneralOpenAIRequest) *CozeChatRequest {
	var messages []CozeEnterMessage
	// 将 request的messages的role为user的content转换为CozeMessage
	for _, message := range request.Messages {
		if message.Role == "user" {
			messages = append(messages, CozeEnterMessage{
				Role:    "user",
				Content: message.Content,
				// TODO: support more content type
				ContentType: "text",
			})
		}
	}
	user := request.User
	if len(user) == 0 {
		user = json.RawMessage(helper.GetResponseID(c))
	}
	cozeRequest := &CozeChatRequest{
		BotId:              c.GetString("bot_id"),
		UserId:             user,
		AdditionalMessages: messages,
		Stream:             lo.FromPtrOr(request.Stream, false),
	}
	return cozeRequest
}

// cozeChatHandler converts a completed Coze response to the OpenAI response format.
func cozeChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.CloseResponseBodyGracefully(resp)
	// convert coze response to openai response
	var response dto.TextResponse
	var cozeResponse CozeChatDetailResponse
	response.Model = info.UpstreamModelName
	err = common.Unmarshal(responseBody, &cozeResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if cozeResponse.Code != 0 {
		return nil, types.NewError(errors.New(cozeResponse.Msg), types.ErrorCodeBadResponseBody)
	}
	// 从上下文获取 usage
	var usage dto.Usage
	usage.PromptTokens = c.GetInt("coze_input_count")
	usage.CompletionTokens = c.GetInt("coze_output_count")
	usage.TotalTokens = c.GetInt("coze_token_count")
	response.Usage = usage
	response.Id = helper.GetResponseID(c)

	var responseContent json.RawMessage
	for _, data := range cozeResponse.Data {
		if data.Type == "answer" {
			responseContent = data.Content
			response.Created = data.CreatedAt
		}
	}
	// 添加 response.Choices
	response.Choices = []dto.OpenAITextResponseChoice{
		{
			Index:        0,
			Message:      dto.Message{Role: "assistant", Content: responseContent},
			FinishReason: "stop",
		},
	}
	jsonResponse, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	return &usage, nil
}

// cozeChatStreamHandler requires an explicit terminal event and keeps failures
// retryable until real model output has reached the downstream client.
func cozeChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	helper.SetEventStreamHeaders(c)
	id := helper.GetResponseID(c)
	var responseText string

	var currentEvent string
	var currentData string
	var usage = &dto.Usage{}
	var streamErr *types.NewAPIError
	completed := false

	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			if currentEvent != "" && currentData != "" {
				completed, streamErr = handleCozeEvent(c, currentEvent, currentData, &responseText, usage, id, info)
				currentEvent = ""
				currentData = ""
				if completed || streamErr != nil {
					break
				}
			}
			continue
		}

		if strings.HasPrefix(line, "event:") {
			currentEvent = strings.TrimSpace(line[6:])
			continue
		}

		if strings.HasPrefix(line, "data:") {
			currentData = strings.TrimSpace(line[5:])
			continue
		}
	}

	// Last event
	if !completed && streamErr == nil && currentEvent != "" && currentData != "" {
		completed, streamErr = handleCozeEvent(c, currentEvent, currentData, &responseText, usage, id, info)
	}

	if streamErr == nil {
		if err := scanner.Err(); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		} else if !completed {
			streamErr = types.NewOpenAIError(io.ErrUnexpectedEOF, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
	}
	if streamErr != nil {
		if !helper.HasWrittenUpstreamResponse(c) {
			return nil, streamErr
		}
		_ = helper.ObjectData(c, gin.H{"error": streamErr.ToOpenAIError()})
		if usage.TotalTokens == 0 {
			usage = service.ResponseText2Usage(c, responseText, info.UpstreamModelName, c.GetInt("coze_input_count"))
		}
		return usage, nil
	}
	helper.Done(c)

	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, responseText, info.UpstreamModelName, c.GetInt("coze_input_count"))
	}

	return usage, nil
}

// handleCozeEvent converts one Coze SSE event and reports whether it is the
// terminal event, keeping protocol errors retryable until output is written.
func handleCozeEvent(c *gin.Context, event string, data string, responseText *string, usage *dto.Usage, id string, info *relaycommon.RelayInfo) (bool, *types.NewAPIError) {
	switch event {
	case "conversation.chat.completed":
		// 将 data 解析为 CozeChatResponseData
		var chatData CozeChatResponseData
		err := common.Unmarshal([]byte(data), &chatData)
		if err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}

		usage.PromptTokens = chatData.Usage.InputCount
		usage.CompletionTokens = chatData.Usage.OutputCount
		usage.TotalTokens = chatData.Usage.TokenCount

		finishReason := "stop"
		stopResponse := helper.GenerateStopResponse(id, common.GetTimestamp(), info.UpstreamModelName, finishReason)
		if err := helper.ObjectData(c, stopResponse); err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		return true, nil

	case "conversation.message.delta":
		// 将 data 解析为 CozeChatV3MessageDetail
		var messageData CozeChatV3MessageDetail
		err := common.Unmarshal([]byte(data), &messageData)
		if err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}

		var content string
		err = common.Unmarshal(messageData.Content, &content)
		if err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}

		*responseText += content

		openaiResponse := dto.ChatCompletionsStreamResponse{
			Id:      id,
			Object:  "chat.completion.chunk",
			Created: common.GetTimestamp(),
			Model:   info.UpstreamModelName,
		}

		choice := dto.ChatCompletionsStreamResponseChoice{
			Index: 0,
		}
		choice.Delta.SetContentString(content)
		openaiResponse.Choices = append(openaiResponse.Choices, choice)

		if err := helper.ObjectData(c, openaiResponse); err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}

	case "error":
		var errorData CozeError
		err := common.Unmarshal([]byte(data), &errorData)
		if err != nil {
			return false, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		return false, types.WithOpenAIError(types.OpenAIError{
			Message: errorData.Message,
			Type:    "coze_error",
			Code:    errorData.Code,
		}, http.StatusBadGateway)
	}
	return false, nil
}

// checkIfChatComplete polls a non-stream Coze conversation until it reaches a
// terminal state or returns a provider error.
func checkIfChatComplete(a *Adaptor, c *gin.Context, info *relaycommon.RelayInfo) (error, bool) {
	requestURL := fmt.Sprintf("%s/v3/chat/retrieve", info.ChannelBaseUrl)

	requestURL = requestURL + "?conversation_id=" + c.GetString("coze_conversation_id") + "&chat_id=" + c.GetString("coze_chat_id")
	// 将 conversationId和chatId作为参数发送get请求
	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return err, false
	}
	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return err, false
	}

	resp, err := doRequest(req, info) // 调用 doRequest
	if err != nil {
		return err, false
	}
	if resp == nil { // 确保在 doRequest 失败时 resp 不为 nil 导致 panic
		return fmt.Errorf("resp is nil"), false
	}
	defer resp.Body.Close() // 确保响应体被关闭

	// 解析 resp 到 CozeChatResponse
	var cozeResponse CozeChatResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body failed: %w", err), false
	}
	err = common.Unmarshal(responseBody, &cozeResponse)
	if err != nil {
		return fmt.Errorf("unmarshal response body failed: %w", err), false
	}
	if cozeResponse.Data.Status == "completed" {
		// 在上下文设置 usage
		c.Set("coze_token_count", cozeResponse.Data.Usage.TokenCount)
		c.Set("coze_output_count", cozeResponse.Data.Usage.OutputCount)
		c.Set("coze_input_count", cozeResponse.Data.Usage.InputCount)
		return nil, true
	} else if cozeResponse.Data.Status == "failed" || cozeResponse.Data.Status == "canceled" || cozeResponse.Data.Status == "requires_action" {
		return fmt.Errorf("chat status: %s", cozeResponse.Data.Status), false
	} else {
		return nil, false
	}
}

// getChatDetail retrieves the messages for a completed Coze conversation.
func getChatDetail(a *Adaptor, c *gin.Context, info *relaycommon.RelayInfo) (*http.Response, error) {
	requestURL := fmt.Sprintf("%s/v3/chat/message/list", info.ChannelBaseUrl)

	requestURL = requestURL + "?conversation_id=" + c.GetString("coze_conversation_id") + "&chat_id=" + c.GetString("coze_chat_id")
	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

// doRequest sends a Coze polling request with the configured proxy client.
func doRequest(req *http.Request, info *relaycommon.RelayInfo) (*http.Response, error) {
	var client *http.Client
	var err error // 声明 err 变量
	if info.ChannelSetting.Proxy != "" {
		client, err = service.NewProxyHttpClient(info.ChannelSetting.Proxy)
		if err != nil {
			return nil, fmt.Errorf("new proxy http client failed: %w", err)
		}
	} else {
		client = service.GetHttpClient()
	}
	resp, err := client.Do(req)
	if err != nil { // 增加对 client.Do(req) 返回错误的检查
		return nil, fmt.Errorf("client.Do failed: %w", err)
	}
	// _ = resp.Body.Close()
	return resp, nil
}
