package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool { return &v }

// 当客户端显式传了 parallel_tool_calls 但未指定 tools 时，必须剔除该字段，
// 否则上游会报 "'parallel_tool_calls' is only allowed when 'tools' are specified"。
func TestConvertOpenAIRequest_DropParallelToolCallsWhenNoTools(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name  string
		tools []dto.ToolCallRequest
		input *bool
		want  *bool // 期望转发给上游的 parallel_tool_calls
	}{
		{
			name:  "empty tools slice drops parallel_tool_calls(false)",
			tools: []dto.ToolCallRequest{},
			input: boolPtr(false),
			want:  nil,
		},
		{
			name:  "nil tools drops parallel_tool_calls(true)",
			tools: nil,
			input: boolPtr(true),
			want:  nil,
		},
		{
			name:  "with tools keeps parallel_tool_calls(false)",
			tools: []dto.ToolCallRequest{{Type: "function"}},
			input: boolPtr(false),
			want:  boolPtr(false),
		},
		{
			name:  "no tools and nil parallel_tool_calls stays nil",
			tools: nil,
			input: nil,
			want:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "gpt-4o",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeOpenAI,
					UpstreamModelName: "gpt-4o",
				},
			}
			request := &dto.GeneralOpenAIRequest{
				Model:            "gpt-4o",
				Tools:            tc.tools,
				ParallelTooCalls: tc.input,
			}

			out, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)

			converted, ok := out.(*dto.GeneralOpenAIRequest)
			require.True(t, ok, "converted request type")

			if tc.want == nil {
				require.Nil(t, converted.ParallelTooCalls)
			} else {
				require.NotNil(t, converted.ParallelTooCalls)
				require.Equal(t, *tc.want, *converted.ParallelTooCalls)
			}
		})
	}
}
