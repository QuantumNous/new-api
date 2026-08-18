package groksubscription

import (
	"errors"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var (
	ErrCompactStreamUnsupported = errors.New("grok compact: stream=true not supported")
	ErrCompactMissingReasoning  = errors.New("grok compact: response missing encrypted reasoning")
	ErrCompactMissingSummary    = errors.New("grok compact: response missing summary text")
	ErrCompactInvalidInput      = errors.New("grok compact: input must be an array of items")
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
	if jsonData, err = sjson.SetBytes(jsonData, "reasoning.encrypted_content", true); err != nil {
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
