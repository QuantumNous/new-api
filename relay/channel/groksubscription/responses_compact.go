package groksubscription

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var (
	ErrCompactStreamUnsupported = errors.New("grok compact: stream=true not supported")
	ErrCompactMissingReasoning  = errors.New("grok compact: response missing encrypted reasoning")
	ErrCompactMissingSummary    = errors.New("grok compact: response missing summary text")
	ErrCompactInvalidInput      = errors.New("grok compact: input must be an array of items")
	ErrCompactInvalidInclude    = errors.New("grok compact: include must be an array")
)

// summaryInstruction 是自撰的服务端 summary 指令（clean-room，不复制 sub2api 文本）。
const summaryInstruction = "Summarize the preceding conversation faithfully and concisely, preserving decisions, facts, and open questions. Return only the summary."

// CompactionItem 是转换后的 OpenAI compaction item。
type CompactionItem struct {
	EncryptedContent string
	Summary          string
}

// getBool 读取顶层布尔键（缺失/非布尔按 false 计）。
func getBool(jsonData []byte, key string) bool {
	return gjson.GetBytes(jsonData, key).Bool()
}

// hasSummaryItem 判断 input 数组末尾是否为本包追加的 summary 指令 item。
// 与 BuildCompactTurn 写入 input.-1 的 item 自洽（content == summaryInstruction）。
func hasSummaryItem(jsonData []byte) bool {
	arr := gjson.GetBytes(jsonData, "input").Array()
	if len(arr) == 0 {
		return false
	}
	last := arr[len(arr)-1]
	return last.Get("content").String() == summaryInstruction
}

// BuildCompactTurn 把 compact 请求改造成普通非流式 Responses summary turn。
func BuildCompactTurn(jsonData []byte) ([]byte, error) {
	if gjson.GetBytes(jsonData, "stream").Bool() {
		return nil, ErrCompactStreamUnsupported
	}
	// 非数组 input（string/对象等简写形态）下 sjson 的 "input.-1" 是覆写而非追加，
	// 会静默丢弃原始对话并产出非法上游请求，故直接拒绝；简写归一化留给后续接线任务。
	if r := gjson.GetBytes(jsonData, "input"); r.Exists() && !r.IsArray() {
		return nil, ErrCompactInvalidInput
	}
	var err error
	summaryItem := map[string]any{
		"role":    "user",
		"content": summaryInstruction,
	}
	jsonData, err = sjson.SetBytes(jsonData, "input.-1", summaryItem)
	if err != nil {
		return nil, err
	}
	if jsonData, err = sjson.SetBytes(jsonData, "stream", false); err != nil {
		return nil, err
	}
	if jsonData, err = sjson.SetBytes(jsonData, "store", false); err != nil {
		return nil, err
	}
	// encrypted reasoning 必须通过 include 数组请求（仓库先例：
	// pkg/apicompat/chatcompletions_to_responses.go、relay/channel/codex/image.go
	// 均用 include:[]string{"reasoning.encrypted_content"}）。布尔形态
	// reasoning.encrypted_content=true 上游不会回 encrypted reasoning，会让
	// ConvertCompactResponse 恒 ErrCompactMissingReasoning。"include.-1" 追加，
	// 保留客户端可能已传入的其它 include 项。
	// 与 input 守卫对称：非数组 include（标量/对象等，Include 是 json.RawMessage，
	// 客户端可传任意 JSON 类型）下 sjson 的 "include.-1" 不是追加，而是把 include 变成
	// {"-1":...} 对象，产出非法上游请求 → 上游忽略 encrypted 请求 → 恒
	// ErrCompactMissingReasoning，故直接拒绝。
	if r := gjson.GetBytes(jsonData, "include"); r.Exists() && !r.IsArray() {
		return nil, ErrCompactInvalidInclude
	}
	if jsonData, err = sjson.SetBytes(jsonData, "include.-1", "reasoning.encrypted_content"); err != nil {
		return nil, err
	}
	return SanitizeCompactRequest(jsonData)
}

// ConvertCompactResponse 只在同时得到 encrypted reasoning + 合法 summary 时转换。
func ConvertCompactResponse(respBody []byte) (CompactionItem, error) {
	var enc, summary string
	gjson.GetBytes(respBody, "output").ForEach(func(_, item gjson.Result) bool {
		switch item.Get("type").String() {
		case "reasoning":
			if e := item.Get("encrypted_content").String(); e != "" {
				enc = e
			}
		case "message":
			item.Get("content").ForEach(func(_, c gjson.Result) bool {
				if c.Get("type").String() == "output_text" {
					summary += c.Get("text").String()
				}
				return true
			})
		}
		return true
	})
	if enc == "" {
		return CompactionItem{}, ErrCompactMissingReasoning
	}
	if summary == "" {
		return CompactionItem{}, ErrCompactMissingSummary
	}
	return CompactionItem{EncryptedContent: enc, Summary: summary}, nil
}

// grokCompactUsageFromBody 从上游普通 Responses body 的 usage 映射出 *dto.Usage。
// 始终返回 non-nil（缺失时零值占位）——入口层 responses_handler.go 对 DoResponse 的
// usage 返回值无条件做 usage.(*dto.Usage)，nil 会 panic。映射与
// OaiResponsesCompactionHandler 对齐：input→Prompt、output→Completion、total→Total，
// 同时保留 Responses 风格的 InputTokens/OutputTokens，便于响应体按 Responses usage 回写。
func grokCompactUsageFromBody(respBody []byte) *dto.Usage {
	u := &dto.Usage{}
	usage := gjson.GetBytes(respBody, "usage")
	if !usage.Exists() {
		return u
	}
	in := int(usage.Get("input_tokens").Int())
	out := int(usage.Get("output_tokens").Int())
	total := int(usage.Get("total_tokens").Int())
	if total == 0 && (in != 0 || out != 0) {
		total = in + out
	}
	u.PromptTokens = in
	u.CompletionTokens = out
	u.TotalTokens = total
	u.InputTokens = in
	u.OutputTokens = out
	return u
}

// buildCompactionOutput 构造回给客户端的 compaction item Output 数组。
//
// 设计 §9（docs/superpowers/specs/2026-08-17-grok-subscription-design.md）路由矩阵
// 与文本节点只点名了两个语义字段名 encrypted_content 与 summary（§9 行 252/290:
// “把 reasoning encrypted content/summary 转回 OpenAI compaction item”），并未逐字
// 转录对外 Output item 的完整线格。按 Task 12.5 契约，缺完整线格时以
// {type:"reasoning", encrypted_content, summary} 为 clean-room 基线（不复制 sub2api
// LGPL 文本）：单个 reasoning item 同时承载 encrypted 载荷与人读 summary，语义自洽。
func buildCompactionOutput(item CompactionItem) (json.RawMessage, error) {
	out := []byte(`[]`)
	var err error
	if out, err = sjson.SetBytes(out, "-1", map[string]any{
		"type":              "reasoning",
		"encrypted_content": item.EncryptedContent,
		"summary":           item.Summary,
	}); err != nil {
		return nil, err
	}
	return json.RawMessage(out), nil
}

// grokCompactResponseHandler 处理 compact turn 的上游回包。Grok 上游走 CLI proxy 的
// /v1/responses，回的是普通 Responses JSON（非 OpenAI compact 格式，故不能复用
// openai.OaiResponsesCompactionHandler）。流程：读 body → 非 200 保留状态码 →
// ConvertCompactResponse 提取 encrypted reasoning + summary（失败返回稳定错误、绝不
// 伪造）→ 组装 dto.OpenAIResponsesCompactionResponse 回写客户端 → 映射 usage。
//
// 凭证安全：encrypted_content 是要回给客户端的响应数据（写响应体 OK），但绝不进日志/
// 错误信息；本函数的所有错误路径都不回显上游 body 或 encrypted 载荷。
func grokCompactResponseHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return &dto.Usage{}, types.NewErrorWithStatusCode(
			errors.New("grok subscription channel: nil upstream response"),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	defer service.CloseResponseBodyGracefully(resp)

	// 上限读取照 refresh.go / chat_response_bridge.go 的 LimitReader 先例，防超大响应。
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxTokenResponseBytes))

	if resp.StatusCode != http.StatusOK {
		truncated := ""
		if len(body) == maxTokenResponseBytes {
			truncated = " (truncated)"
		}
		// 保留上游状态码，否则上层重试/限流策略失去信号（429/5xx 不再退避/切渠道）。
		return &dto.Usage{}, types.NewErrorWithStatusCode(
			fmt.Errorf("grok subscription channel: upstream status %d%s", resp.StatusCode, truncated),
			types.ErrorCodeBadResponse, resp.StatusCode)
	}

	usage := grokCompactUsageFromBody(body)

	item, err := ConvertCompactResponse(body)
	if err != nil {
		// 稳定错误、绝不伪造 compaction item。err 只含固定文案（见 ErrCompact* 定义），
		// 不含上游 body / encrypted 载荷，可安全进入错误链。
		return usage, types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	output, err := buildCompactionOutput(item)
	if err != nil {
		return usage, types.NewErrorWithStatusCode(
			errors.New("grok subscription channel: failed to encode compaction item"),
			types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	// 保留上游 Responses 的 id/object/created_at，Output 换成 compaction item，usage 回写。
	compactResp := dto.OpenAIResponsesCompactionResponse{
		ID:        gjson.GetBytes(body, "id").String(),
		Object:    gjson.GetBytes(body, "object").String(),
		CreatedAt: int(gjson.GetBytes(body, "created_at").Int()),
		Output:    output,
		Usage:     usage,
	}
	payload, mErr := common.Marshal(&compactResp)
	if mErr != nil {
		return usage, types.NewErrorWithStatusCode(
			errors.New("grok subscription channel: failed to encode compaction response"),
			types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, payload)
	return usage, nil
}
