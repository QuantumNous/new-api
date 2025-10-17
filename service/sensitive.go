package service

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	marshalCommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func CheckSensitiveMessages(messages []dto.Message) ([]string, error) {
	if len(messages) == 0 {
		return nil, nil
	}

	for _, message := range messages {
		arrayContent := message.ParseContent()
		for _, m := range arrayContent {
			if m.Type == "image_url" {
				// TODO: check image url
				continue
			}
			// 检查 text 是否为空
			if m.Text == "" {
				continue
			}
			if ok, words := SensitiveWordContains(m.Text); ok {
				return words, errors.New("sensitive words detected")
			}
		}
	}
	return nil, nil
}

func CheckSensitiveText(text string) (bool, []string) {
	return SensitiveWordContains(text)
}

// SensitiveWordContains 是否包含敏感词，返回是否包含敏感词和敏感词列表
func SensitiveWordContains(text string) (bool, []string) {
	if len(setting.SensitiveWords) == 0 {
		return false, nil
	}
	if len(text) == 0 {
		return false, nil
	}
	checkText := strings.ToLower(text)
	return AcSearch(checkText, setting.SensitiveWords, true)
}

// SensitiveWordReplace 敏感词替换，返回是否包含敏感词和替换后的文本
func SensitiveWordReplace(text string, returnImmediately bool) (bool, []string, string) {
	if len(setting.SensitiveWords) == 0 {
		return false, nil, text
	}
	checkText := strings.ToLower(text)
	m := getOrBuildAC(setting.SensitiveWords)
	hits := m.MultiPatternSearch([]rune(checkText), returnImmediately)
	if len(hits) > 0 {
		words := make([]string, 0, len(hits))
		var builder strings.Builder
		builder.Grow(len(text))
		lastPos := 0

		for _, hit := range hits {
			pos := hit.Pos
			word := string(hit.Word)
			builder.WriteString(text[lastPos:pos])
			builder.WriteString("**###**")
			lastPos = pos + len(word)
			words = append(words, word)
		}
		builder.WriteString(text[lastPos:])
		return true, words, builder.String()
	}
	return false, nil, text
}

// 大模型返回的内容敏感词过滤

const SensitiveWordPlaceholders = "__--sensitive_words--__"
const SensitiveErrorInfo = "\n\nuser sensitive words detected: "

func IsChatCompletionEndpoint(c *gin.Context) bool {
	return (c.Request.URL.Path == "/v1/chat/completions" && c.Request.Method == "POST") ||
		(c.Request.URL.Path == "/v1/responses" && c.Request.Method == "POST") ||
		(c.Request.URL.Path == "/v1/messages" && c.Request.Method == "POST") ||
		(c.Request.URL.Path == "/pg/chat/completions" && c.Request.Method == "POST") ||
		(strings.HasPrefix(c.Request.URL.Path, "/v1beta/models") && c.Request.Method == "POST")
}

type SensitiveWordFilterResponseWriter struct {
	gin.ResponseWriter
	Url             string
	Body            *bytes.Buffer
	Info            *common.RelayInfo
	Context         *gin.Context
	newAPIError     *types.NewAPIError
	responseWritten bool

	// stream
	streamContent              string
	errorStreamMessageTemplate string
}

func (w *SensitiveWordFilterResponseWriter) appendStreamRespContent(content string) {
	w.streamContent += content
}

func (w *SensitiveWordFilterResponseWriter) GetNewAPIError() *types.NewAPIError {
	return w.newAPIError
}

// Write 实现 Write 方法
func (w *SensitiveWordFilterResponseWriter) Write(b []byte) (int, error) {
	if w.responseWritten {
		return len(b), nil // 返回成功但不实际写入，或者返回错误
	}

	body := w.processBody(b)

	if w.newAPIError != nil && !w.responseWritten {
		w.responseWritten = true

		// 根据格式生成错误响应
		if w.Info.IsStream {
			streamError := fmt.Sprintf("data: %s\n\ndata: [DONE]\n\n", w.errorStreamMessageTemplate)
			w.ResponseWriter.Header().Set("Content-Type", "text/event-stream")
			w.ResponseWriter.Header().Set("Cache-Control", "no-cache")
			w.ResponseWriter.Header().Set("Connection", "keep-alive")
			w.ResponseWriter.WriteHeader(w.newAPIError.StatusCode)
			return w.ResponseWriter.Write([]byte(streamError))
		} else {
			var responseData []byte
			switch w.Info.RelayFormat {
			case types.RelayFormatClaude:
				errorResponse := gin.H{
					"type":  "error",
					"error": w.newAPIError.ToClaudeError(),
				}
				responseData, _ = marshalCommon.Marshal(errorResponse)
			default:
				errorResponse := gin.H{
					"error": w.newAPIError.ToOpenAIError(),
				}
				responseData, _ = marshalCommon.Marshal(errorResponse)
			}
			// 设置正确的头部
			w.ResponseWriter.Header().Set("Content-Type", "application/json")
			w.ResponseWriter.Header().Set("Content-Length", fmt.Sprintf("%d", len(responseData)))
			w.ResponseWriter.WriteHeader(w.newAPIError.StatusCode)
			// 写入错误响应并返回，不再处理原始数据
			return w.ResponseWriter.Write(responseData)
		}
	}
	return w.ResponseWriter.Write(body)
}

// processBody 处理响应体
func (w *SensitiveWordFilterResponseWriter) processBody(data []byte) []byte {
	if w.Info.IsStream {
		// 流式响应处理
		return w.processStreamResponse(data)
	} else {
		// 非流式响应处理
		return w.processNonStreamResponse(data)
	}
}

// processNonStreamResponse 处理非流式响应
func (w *SensitiveWordFilterResponseWriter) processNonStreamResponse(bodyBytes []byte) []byte {
	var contents string
	if w.Info.RelayFormat == types.RelayFormatOpenAI {
		var simpleResponse dto.OpenAITextResponse
		if err := marshalCommon.Unmarshal(bodyBytes, &simpleResponse); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return bodyBytes
		}
		for _, choice := range simpleResponse.Choices {
			value, isString := choice.Message.Content.(string)
			if isString {
				contents += value
			}
		}
	} else if w.Info.RelayFormat == types.RelayFormatGemini {
		var geminiResponse dto.GeminiChatResponse
		if err := marshalCommon.Unmarshal(bodyBytes, &geminiResponse); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return bodyBytes
		}
		for _, candidate := range geminiResponse.Candidates {
			for _, part := range candidate.Content.Parts {
				contents += part.Text
			}
		}
	} else if w.Info.RelayFormat == types.RelayFormatClaude {
		var claudeResponse dto.ClaudeResponse
		if err := marshalCommon.Unmarshal(bodyBytes, &claudeResponse); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return bodyBytes
		}
		for _, content := range claudeResponse.Content {
			if content.Text != nil {
				contents += *content.Text
			}
		}
	} else if w.Info.RelayFormat == types.RelayFormatOpenAIResponses {
		var responsesResponse dto.OpenAIResponsesResponse
		if err := marshalCommon.Unmarshal(bodyBytes, &responsesResponse); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return bodyBytes
		}
		for _, output := range responsesResponse.Output {
			for _, content := range output.Content {
				contents += content.Text
			}
		}
	}
	if contents != "" {
		contains, words := CheckSensitiveText(contents)
		if contains {
			logger.LogWarn(w.Context, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			w.newAPIError = types.NewError(fmt.Errorf("user sensitive words detected: %s", strings.Join(words, ", ")), types.ErrorCodeSensitiveWordsDetected)
			return bodyBytes
		}
	}
	return bodyBytes
}

// processStreamResponse 处理流式响应
func (w *SensitiveWordFilterResponseWriter) processStreamResponse(bodyBytes []byte) []byte {
	scanner := bufio.NewScanner(bytes.NewReader(bodyBytes))
	for scanner.Scan() {
		data := scanner.Text()
		if len(data) < 6 {
			continue
		}
		if data[:5] != "data:" && data[:6] != "[DONE]" {
			continue
		}
		data = data[5:]
		data = strings.TrimLeft(data, " ")
		data = strings.TrimSuffix(data, "\r")
		if !strings.HasPrefix(data, "[DONE]") {
			content, ok := w.parserLineChatInfo(data)
			if !ok {
				continue
			}
			w.appendStreamRespContent(content)
		}
	}
	if w.streamContent != "" {
		contains, words := CheckSensitiveText(w.streamContent)
		if contains {
			logger.LogWarn(w.Context, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			w.newAPIError = types.NewError(fmt.Errorf("user sensitive words detected: %s", strings.Join(words, ", ")), types.ErrorCodeSensitiveWordsDetected)
			// 将最后一条
			w.errorStreamMessageTemplate = strings.Replace(w.errorStreamMessageTemplate, SensitiveWordPlaceholders, strings.Join(words, ", "), 1)
			return bodyBytes
		}
	}
	return bodyBytes
}

func (w *SensitiveWordFilterResponseWriter) parserLineChatInfo(data string) (string, bool) {
	var content string
	if w.Info.RelayFormat == types.RelayFormatOpenAI {
		var resp dto.ChatCompletionsStreamResponse
		if err := marshalCommon.UnmarshalJsonStr(data, &resp); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return "", false
		}
		for index, choice := range resp.Choices {
			if choice.Delta.Content != nil {
				// 将流返回的字符串记录
				content += *choice.Delta.Content

				// 更改最后一个信息的内容，提供给后面如果检测到敏感词进行替换返回给前端
				if index == len(resp.Choices)-1 {
					resp.Choices[index].Delta.Content = &[]string{SensitiveErrorInfo + SensitiveWordPlaceholders}[0]
				}
			}
		}

		// 构建错误消息的模版
		streamItemInfo, _ := marshalCommon.Marshal(resp)
		w.errorStreamMessageTemplate = string(streamItemInfo)
	} else if w.Info.RelayFormat == types.RelayFormatGemini {
		var resp dto.GeminiChatResponse
		if err := marshalCommon.UnmarshalJsonStr(data, &resp); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return "", false
		}
		for index, candidate := range resp.Candidates {
			for partIndex, part := range candidate.Content.Parts {
				// 将流返回的字符串记录
				content += part.Text

				// 更改最后一个信息的内容，提供给后面如果检测到敏感词进行替换返回给前端
				if index == len(resp.Candidates)-1 && partIndex == len(candidate.Content.Parts)-1 {
					resp.Candidates[index].Content.Parts[partIndex].Text = SensitiveErrorInfo + SensitiveWordPlaceholders
				}
			}
		}

		// 构建错误消息的模版
		streamItemInfo, _ := marshalCommon.Marshal(resp)
		w.errorStreamMessageTemplate = string(streamItemInfo)
	} else if w.Info.RelayFormat == types.RelayFormatClaude {
		var resp dto.ClaudeResponse
		if err := marshalCommon.UnmarshalJsonStr(data, &resp); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return "", false
		}

		if resp.Type == "content_block_delta" {
			if resp.Delta != nil {
				// 将流返回的字符串记录
				content += *resp.Delta.Text

				// 更改最后一个信息的内容，提供给后面如果检测到敏感词进行替换返回给前端
				resp.Delta.Text = &[]string{SensitiveErrorInfo + SensitiveWordPlaceholders}[0]
			}
		}

		// 构建错误消息的模版
		streamItemInfo, _ := marshalCommon.Marshal(resp)
		w.errorStreamMessageTemplate = string(streamItemInfo)
	} else if w.Info.RelayFormat == types.RelayFormatOpenAIResponses {
		var resp dto.ResponsesStreamResponse
		if err := marshalCommon.UnmarshalJsonStr(data, &resp); err != nil {
			logger.LogError(w.Context, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError).Error())
			return "", false
		}
		if resp.Type == "response.output_text.delta" {
			// 将流返回的字符串记录
			content = resp.Delta
			// 更改最后一个信息的内容，提供给后面如果检测到敏感词进行替换返回给前端
			resp.Delta = SensitiveErrorInfo + SensitiveWordPlaceholders
		}

		// 构建错误消息的模版
		streamItemInfo, _ := marshalCommon.Marshal(resp)
		w.errorStreamMessageTemplate = string(streamItemInfo)
	}
	return content, true
}
