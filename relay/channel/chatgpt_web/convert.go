package chatgpt_web

import (
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

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ───────────────────────── 请求体（OpenAI -> ChatGPT 网页 conversation）─────────────────────────

type convAuthor struct {
	Role string `json:"role"`
}

type convContent struct {
	ContentType string   `json:"content_type"`
	Parts       []string `json:"parts"`
}

type convMessage struct {
	ID         string         `json:"id"`
	Author     convAuthor     `json:"author"`
	CreateTime float64        `json:"create_time"`
	Content    convContent    `json:"content"`
	Metadata   map[string]any `json:"metadata"`
}

type conversationRequest struct {
	Action                     string         `json:"action"`
	Messages                   []convMessage  `json:"messages"`
	ParentMessageID            string         `json:"parent_message_id"`
	ConversationID             *string        `json:"conversation_id"`
	Model                      string         `json:"model"`
	ConversationMode           map[string]any `json:"conversation_mode"`
	HistoryAndTrainingDisabled bool           `json:"history_and_training_disabled"`
	ForceUseSSE                bool           `json:"force_use_sse"`
	SupportedEncodings         []string       `json:"supported_encodings"`
	Timezone                   string         `json:"timezone"`
	TimezoneOffsetMin          int            `json:"timezone_offset_min"`
}

func resolveModel(model string) string {
	model = strings.TrimSpace(model)
	if model == "" {
		return "auto"
	}
	return model
}

// mapRole 把 OpenAI 角色映射到 ChatGPT author.role。
func mapRole(role string) string {
	switch role {
	case "assistant":
		return "assistant"
	case "system", "developer":
		return "system"
	case "tool", "function":
		return "tool"
	default:
		return "user"
	}
}

// buildConversationRequest 把 OpenAI messages 转成 conversation 请求体。
// 注：多模态（图片/音频）暂只取文本部分；history_and_training_disabled=true 不入库不训练。
func buildConversationRequest(messages []dto.Message, model string) *conversationRequest {
	now := float64(common.GetTimestamp())
	convMsgs := make([]convMessage, 0, len(messages))
	for _, m := range messages {
		convMsgs = append(convMsgs, convMessage{
			ID:         uuid.NewString(),
			Author:     convAuthor{Role: mapRole(m.Role)},
			CreateTime: now,
			Content:    convContent{ContentType: "text", Parts: []string{m.StringContent()}},
			Metadata:   map[string]any{},
		})
	}
	if len(convMsgs) == 0 {
		convMsgs = append(convMsgs, convMessage{
			ID:         uuid.NewString(),
			Author:     convAuthor{Role: "user"},
			CreateTime: now,
			Content:    convContent{ContentType: "text", Parts: []string{""}},
			Metadata:   map[string]any{},
		})
	}
	return &conversationRequest{
		Action:                     "next",
		Messages:                   convMsgs,
		ParentMessageID:            uuid.NewString(),
		ConversationID:             nil,
		Model:                      resolveModel(model),
		ConversationMode:           map[string]any{"kind": "primary_assistant"},
		HistoryAndTrainingDisabled: true,
		ForceUseSSE:                true,
		SupportedEncodings:         []string{"v1"},
		Timezone:                   "America/Los_Angeles",
		TimezoneOffsetMin:          480,
	}
}

func countPromptTokens(messages []dto.Message, model string) int {
	var sb strings.Builder
	for _, m := range messages {
		sb.WriteString(m.Role)
		sb.WriteString(": ")
		sb.WriteString(m.StringContent())
		sb.WriteString("\n")
	}
	return service.CountTextToken(sb.String(), model)
}

// ───────────────────────── 响应（ChatGPT 网页 v1 delta SSE -> OpenAI）─────────────────────────

// deltaState 解析 ChatGPT 的 v1 delta encoding，增量提取 assistant 的文本。
//
// 事件形态（实测）：
//
//	event: delta_encoding   data: "v1"                                 -> 忽略
//	data: {"o":"add","p":"","v":{"message":{author,content,...}}}      -> 初始化（确定当前消息是否为 assistant 文本）
//	data: {"o":"append","p":"/message/content/parts/0","v":"文本"}      -> 追加
//	data: {"v":"文本"}                                                  -> 裸续写，追加到当前 parts/0
//	data: {"o":"patch","v":[{...append...}]}                           -> 批量
//	data: {"type":"message_stream_complete",...}                       -> 结束
//	data: [DONE]                                                       -> 结束
type deltaState struct {
	activeIsText bool   // 当前正在流式的消息是否为 assistant 的 text 内容
	curText      string // 当前 parts/0 已累计文本（用于 replace 求增量）
}

func (s *deltaState) apply(data string) (delta string, done bool) {
	data = strings.TrimSpace(data)
	if data == "" {
		return "", false
	}
	if data == "[DONE]" {
		return "", true
	}
	// delta_encoding 标记之类的纯 JSON 字符串（如 "v1"）
	if strings.HasPrefix(data, "\"") {
		return "", false
	}
	var ev map[string]any
	if err := common.UnmarshalJsonStr(data, &ev); err != nil {
		return "", false
	}

	if t, ok := ev["type"].(string); ok {
		if t == "message_stream_complete" {
			return "", true
		}
		return "", false
	}

	o, _ := ev["o"].(string)
	p, _ := ev["p"].(string)

	switch o {
	case "add":
		if p == "" {
			return s.handleMessageSnapshot(ev["v"]), false
		}
		if strings.HasSuffix(p, "/parts/0") {
			return s.appendIfText(ev["v"]), false
		}
	case "append":
		if p == "" || strings.HasSuffix(p, "/parts/0") {
			return s.appendIfText(ev["v"]), false
		}
	case "patch":
		return s.handlePatch(ev["v"]), false
	case "replace":
		if strings.HasSuffix(p, "/parts/0") {
			if str, ok := ev["v"].(string); ok && s.activeIsText {
				d := diffSuffix(s.curText, str)
				s.curText = str
				return d, false
			}
		}
	case "":
		// 无 o：要么是文本续写 {"v":"..."}，要么是新消息快照 {"v":{"message":{...}}}。
		// ChatGPT v1 下发新消息正是用裸对象 v（不带 o/p），必须当快照处理，否则会漏掉 assistant 消息。
		switch vv := ev["v"].(type) {
		case string:
			return s.appendIfText(vv), false
		case map[string]any:
			return s.handleMessageSnapshot(vv), false
		}
	}
	return "", false
}

func (s *deltaState) appendIfText(v any) string {
	if !s.activeIsText {
		return ""
	}
	str, ok := v.(string)
	if !ok {
		return ""
	}
	s.curText += str
	return str
}

// handleMessageSnapshot 处理"新消息快照"（{"o":"add","p":"","v":{message}} 或裸 {"v":{message}}）。
// 据此确定当前流式消息是否为 assistant 的 text 内容，并取初始 parts[0]。
func (s *deltaState) handleMessageSnapshot(v any) string {
	m, ok := v.(map[string]any)
	if !ok {
		return ""
	}
	msg, ok := m["message"].(map[string]any)
	if !ok {
		return ""
	}
	role := ""
	if author, ok := msg["author"].(map[string]any); ok {
		role, _ = author["role"].(string)
	}
	contentType := ""
	text := ""
	if content, ok := msg["content"].(map[string]any); ok {
		contentType, _ = content["content_type"].(string)
		if parts, ok := content["parts"].([]any); ok && len(parts) > 0 {
			text, _ = parts[0].(string)
		}
	}
	if role == "assistant" && contentType == "text" {
		s.activeIsText = true
		s.curText = text
		return text
	}
	// 切到非文本消息（如推理 thoughts），停止采集
	s.activeIsText = false
	return ""
}

func (s *deltaState) handlePatch(v any) string {
	arr, ok := v.([]any)
	if !ok {
		return ""
	}
	var sb strings.Builder
	for _, item := range arr {
		op, ok := item.(map[string]any)
		if !ok {
			continue
		}
		oo, _ := op["o"].(string)
		pp, _ := op["p"].(string)
		if (oo == "append" || oo == "add") && strings.HasSuffix(pp, "/parts/0") {
			sb.WriteString(s.appendIfText(op["v"]))
		}
	}
	return sb.String()
}

func diffSuffix(prev, next string) string {
	if strings.HasPrefix(next, prev) {
		return next[len(prev):]
	}
	return next
}

// ───────────────────────── 流式 / 非流式 处理器 ─────────────────────────

// StreamHandler 把 ChatGPT 网页 SSE 转成 OpenAI chat.completion.chunk 下发。
func StreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, promptTokens int) (any, *types.NewAPIError) {
	id := helper.GetResponseID(c)
	created := common.GetTimestamp()
	model := info.UpstreamModelName
	var full strings.Builder
	state := &deltaState{}

	_ = helper.ObjectData(c, helper.GenerateStartEmptyResponse(id, created, model, nil))

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		delta, _ := state.apply(data)
		if delta != "" {
			full.WriteString(delta)
			_ = helper.ObjectData(c, newTextChunk(id, created, model, delta))
		}
	})

	usage := service.ResponseText2Usage(c, full.String(), model, promptTokens)
	_ = helper.ObjectData(c, helper.GenerateStopResponse(id, created, model, "stop"))
	_ = helper.ObjectData(c, helper.GenerateFinalUsageResponse(id, created, model, *usage))
	helper.Done(c)
	return usage, nil
}

func newTextChunk(id string, created int64, model, content string) *dto.ChatCompletionsStreamResponse {
	v := content
	return &dto.ChatCompletionsStreamResponse{
		Id:      id,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &v},
			},
		},
	}
}

// Handler 客户端非流式时：把上游 SSE 累计为完整文本，返回单个 chat.completion。
func Handler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, promptTokens int) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, types.NewError(fmt.Errorf("chatgpt-web upstream status %d: %s", resp.StatusCode, truncate(string(body), 300)), types.ErrorCodeBadResponseBody)
	}

	state := &deltaState{}
	var full strings.Builder
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(line[len("data:"):])
		delta, done := state.apply(data)
		full.WriteString(delta)
		if done {
			break
		}
	}

	model := info.UpstreamModelName
	usage := service.ResponseText2Usage(c, full.String(), model, promptTokens)
	respObj := dto.OpenAITextResponse{
		Id:      helper.GetResponseID(c),
		Model:   model,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				FinishReason: "stop",
			},
		},
		Usage: *usage,
	}
	respObj.Choices[0].Message.Role = "assistant"
	respObj.Choices[0].Message.SetStringContent(full.String())
	c.JSON(http.StatusOK, respObj)
	return usage, nil
}
