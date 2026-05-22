package codex

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// ToCompatChatRequest 把 new-api 的 *dto.GeneralOpenAIRequest 转成
// apicompat 的 ChatCompletionsRequest。通过一次 JSON 中转：双方的字段命名
// 都遵循 OpenAI 官方 JSON tag，能直接相互序列化对接。
func ToCompatChatRequest(req *dto.GeneralOpenAIRequest) (*apicompat.ChatCompletionsRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ToCompatChatRequest: nil request")
	}
	raw, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("ToCompatChatRequest: marshal dto: %w", err)
	}
	out := &apicompat.ChatCompletionsRequest{}
	if err := common.Unmarshal(raw, out); err != nil {
		return nil, fmt.Errorf("ToCompatChatRequest: unmarshal compat: %w", err)
	}
	return out, nil
}

// applyCodexConstraints 把 Codex 后端的硬性限制套到一个 Responses 请求体上：
//   - 强制 store=false、stream=true
//   - 清空 Codex 不接受的字段（与 sub2api 对齐的完整名单）
//   - 注入 instructions（按 channel 设置或保留客户端原值；不再用 JSON 字面量包裹，
//     因为 apicompat.ResponsesRequest.Instructions 是 string 类型）
//
// 这个函数是 ChatCompletions 入口和原 Responses 入口的共享钳制点。
func applyCodexConstraints(req *apicompat.ResponsesRequest, info *relaycommon.RelayInfo) {
	if req == nil {
		return
	}
	// 1) 禁字段（其他禁字段如 frequency_penalty / presence_penalty / user / metadata /
	// prompt_cache_retention / safety_identifier / stream_options 在 apicompat.ResponsesRequest
	// 上没有对应字段，apicompat.ChatCompletionsToResponses 已过滤）
	req.MaxOutputTokens = nil
	req.Temperature = nil
	req.TopP = nil

	// 2) 强制 store=false、stream=true
	storeFalse := false
	req.Store = &storeFalse
	req.Stream = true

	// 3) instructions
	systemPrompt := ""
	override := false
	if info != nil {
		systemPrompt = info.ChannelSetting.SystemPrompt
		override = info.ChannelSetting.SystemPromptOverride
	}

	if systemPrompt != "" {
		existing := strings.TrimSpace(req.Instructions)
		switch {
		case existing == "":
			req.Instructions = systemPrompt
		case override:
			req.Instructions = systemPrompt + "\n" + existing
		}
	}
	// 不再补默认空字符串：apicompat.ResponsesRequest.Instructions 的 json tag 为
	// `omitempty`，空字符串会被自然省略。Codex 后端要求出现该字段时，由调用方
	// 在序列化之后做 raw JSON 注入或迁就上游约定。
}
