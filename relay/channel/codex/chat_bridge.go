package codex

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
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
