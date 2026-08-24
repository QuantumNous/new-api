package groksubscription

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
)

// chatCompletionsRequestToResponsesBody 把一个 Chat Completions 请求转换成
// Grok CLI proxy 期望的 Responses 请求体。
//
// 里程碑 A 的文本上游只有 /v1/responses（CLI proxy 不暴露 /v1/chat/completions）。
// 当通用 Chat→Responses bridge 因全局策略默认关闭而未生效时，请求会以
// RelayModeChatCompletions 落到本 adaptor 的 plain 路径；此处在 adaptor 内部
// 自行完成 Chat→Responses 转换，使 adaptor 自洽、不依赖任何可变全局开关
// （对齐 Codex 的做法，但 Grok 无 Codex 的 store/stream/fingerprint 约束）。
//
// 走 pkg/apicompat（无 relay/channel 依赖的独立底层包）而非 service 包，
// 以避免 service → relay/channel → groksubscription 的 import 循环。
func chatCompletionsRequestToResponsesBody(req *dto.GeneralOpenAIRequest) (*apicompat.ResponsesRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("grok chat→responses: nil request")
	}
	// dto 与 apicompat 两侧字段均遵循 OpenAI 官方 JSON tag，可经一次 JSON 中转对接。
	raw, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("grok chat→responses: marshal request: %w", err)
	}
	compatChat := &apicompat.ChatCompletionsRequest{}
	if err := common.Unmarshal(raw, compatChat); err != nil {
		return nil, fmt.Errorf("grok chat→responses: unmarshal compat: %w", err)
	}
	compatResp, err := apicompat.ChatCompletionsToResponses(compatChat)
	if err != nil {
		return nil, fmt.Errorf("grok chat→responses: convert: %w", err)
	}
	return compatResp, nil
}
