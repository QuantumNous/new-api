package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

// TestUnsupportedClaudeConvertersReturnErrors prevents unsupported provider
// conversions from crashing the relay process with implementation panics.
func TestUnsupportedClaudeConvertersReturnErrors(t *testing.T) {
	tests := []struct {
		name    string
		apiType int
	}{
		{name: "baidu", apiType: constant.APITypeBaidu},
		{name: "cloudflare", apiType: constant.APITypeCloudflare},
		{name: "cohere", apiType: constant.APITypeCohere},
		{name: "dify", apiType: constant.APITypeDify},
		{name: "jina", apiType: constant.APITypeJina},
		{name: "mistral", apiType: constant.APITypeMistral},
		{name: "mokaai", apiType: constant.APITypeMokaAI},
		{name: "palm", apiType: constant.APITypePaLM},
		{name: "tencent", apiType: constant.APITypeTencent},
		{name: "xunfei", apiType: constant.APITypeXunfei},
		{name: "zhipu", apiType: constant.APITypeZhipu},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adaptor := GetAdaptor(tt.apiType)
			require.NotNil(t, adaptor)
			converted, err := adaptor.ConvertClaudeRequest(nil, nil, &dto.ClaudeRequest{})
			require.Error(t, err)
			require.Nil(t, converted)
		})
	}
}
