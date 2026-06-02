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
)

// ───────────────────────── Responses 请求 -> conversation ─────────────────────────

// buildResponsesConversationRequest 把 /v1/responses 的 Input/Instructions 转成 conversation 体。
// Input 可能是字符串，也可能是输入项数组（每项含 role + content）。
func buildResponsesConversationRequest(req dto.OpenAIResponsesRequest, model string) (*conversationRequest, []dto.Message) {
	msgs := make([]dto.Message, 0, 4)

	// instructions -> system
	if len(req.Instructions) > 0 {
		var instr string
		if err := common.Unmarshal(req.Instructions, &instr); err == nil && strings.TrimSpace(instr) != "" {
			m := dto.Message{Role: "system"}
			m.SetStringContent(instr)
			msgs = append(msgs, m)
		}
	}

	// input：先试字符串，再试数组
	var asString string
	if err := common.Unmarshal(req.Input, &asString); err == nil {
		m := dto.Message{Role: "user"}
		m.SetStringContent(asString)
		msgs = append(msgs, m)
	} else {
		var arr []map[string]any
		if err := common.Unmarshal(req.Input, &arr); err == nil {
			for _, item := range arr {
				role, _ := item["role"].(string)
				if role == "" {
					// 非 message 类输入项（如 function_call_output）暂跳过
					if _, hasContent := item["content"]; !hasContent {
						continue
					}
					role = "user"
				}
				text := contentToText(item["content"])
				m := dto.Message{Role: role}
				m.SetStringContent(text)
				msgs = append(msgs, m)
			}
		}
	}

	return buildConversationRequest(msgs, model), msgs
}

func contentToText(content any) string {
	switch v := content.(type) {
	case string:
		return v
	case []any:
		var sb strings.Builder
		for _, p := range v {
			if pm, ok := p.(map[string]any); ok {
				if t, _ := pm["text"].(string); t != "" {
					sb.WriteString(t)
				}
			}
		}
		return sb.String()
	}
	return ""
}

// ───────────────────────── conversation SSE -> Responses 事件 ─────────────────────────

func respIDs(c *gin.Context) (respID, itemID string) {
	logID := c.GetString(common.RequestIdKey)
	return "resp_" + logID, "msg_" + logID
}

func sendResponsesEvent(c *gin.Context, eventType string, payload map[string]any) {
	payload["type"] = eventType
	data, err := common.Marshal(payload)
	if err != nil {
		return
	}
	helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: eventType}, string(data))
}

func buildResponseObject(respID, model, status string, output []any, usage map[string]any, created int) map[string]any {
	obj := map[string]any{
		"id":                  respID,
		"object":              "response",
		"created_at":          created,
		"status":              status,
		"model":               model,
		"output":              output,
		"parallel_tool_calls": true,
		"tools":               []any{},
	}
	if usage != nil {
		obj["usage"] = usage
	}
	return obj
}

func buildMessageItem(itemID, status, text string) map[string]any {
	return map[string]any{
		"type":   "message",
		"id":     itemID,
		"status": status,
		"role":   "assistant",
		"content": []any{
			map[string]any{"type": "output_text", "text": text, "annotations": []any{}},
		},
	}
}

// ResponsesStreamHandler 把 ChatGPT 网页 SSE 合成为 OpenAI Responses 流式事件。
func ResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, promptTokens int) (any, *types.NewAPIError) {
	respID, itemID := respIDs(c)
	model := info.UpstreamModelName
	created := int(common.GetTimestamp())

	// 起始事件
	sendResponsesEvent(c, "response.created", map[string]any{
		"response": buildResponseObject(respID, model, "in_progress", []any{}, nil, created),
	})
	sendResponsesEvent(c, "response.output_item.added", map[string]any{
		"output_index": 0,
		"item":         buildMessageItem(itemID, "in_progress", ""),
	})
	sendResponsesEvent(c, "response.content_part.added", map[string]any{
		"item_id":       itemID,
		"output_index":  0,
		"content_index": 0,
		"part":          map[string]any{"type": "output_text", "text": "", "annotations": []any{}},
	})

	var full strings.Builder
	state := &deltaState{}
	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		delta, _ := state.apply(data)
		if delta != "" {
			full.WriteString(delta)
			sendResponsesEvent(c, "response.output_text.delta", map[string]any{
				"item_id":       itemID,
				"output_index":  0,
				"content_index": 0,
				"delta":         delta,
			})
		}
	})

	text := full.String()
	usage := service.ResponseText2Usage(c, text, model, promptTokens)
	usageObj := map[string]any{
		"input_tokens":  usage.PromptTokens,
		"output_tokens": usage.CompletionTokens,
		"total_tokens":  usage.TotalTokens,
	}

	sendResponsesEvent(c, "response.output_text.done", map[string]any{
		"item_id":       itemID,
		"output_index":  0,
		"content_index": 0,
		"text":          text,
	})
	sendResponsesEvent(c, "response.content_part.done", map[string]any{
		"item_id":       itemID,
		"output_index":  0,
		"content_index": 0,
		"part":          map[string]any{"type": "output_text", "text": text, "annotations": []any{}},
	})
	sendResponsesEvent(c, "response.output_item.done", map[string]any{
		"output_index": 0,
		"item":         buildMessageItem(itemID, "completed", text),
	})
	sendResponsesEvent(c, "response.completed", map[string]any{
		"response": buildResponseObject(respID, model, "completed",
			[]any{buildMessageItem(itemID, "completed", text)}, usageObj, created),
	})
	return usage, nil
}

// ResponsesHandler 非流式：累计完整文本，返回单个 Responses 响应对象。
func ResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, promptTokens int) (any, *types.NewAPIError) {
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

	respID, itemID := respIDs(c)
	model := info.UpstreamModelName
	created := int(common.GetTimestamp())
	text := full.String()
	usage := service.ResponseText2Usage(c, text, model, promptTokens)
	usageObj := map[string]any{
		"input_tokens":  usage.PromptTokens,
		"output_tokens": usage.CompletionTokens,
		"total_tokens":  usage.TotalTokens,
	}
	out := buildResponseObject(respID, model, "completed",
		[]any{buildMessageItem(itemID, "completed", text)}, usageObj, created)
	c.JSON(http.StatusOK, out)
	return usage, nil
}
