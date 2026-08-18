package openai

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIRequest_ForceUpstreamStream(t *testing.T) {
	tests := []struct {
		name           string
		clientStream   *bool
		forceUpstream  bool
		wantStreamSent bool // what the upstream should receive
		wantForcedFlag bool // whether UpstreamStreamForced should be set
	}{
		{
			name:           "client non-stream + force -> upstream stream + forced flag",
			clientStream:   lo.ToPtr(false),
			forceUpstream:  true,
			wantStreamSent: true,
			wantForcedFlag: true,
		},
		{
			name:           "client stream + force -> upstream stream, no forced flag",
			clientStream:   lo.ToPtr(true),
			forceUpstream:  true,
			wantStreamSent: true,
			wantForcedFlag: false,
		},
		{
			name:           "client non-stream + no force -> upstream non-stream, no forced flag",
			clientStream:   lo.ToPtr(false),
			forceUpstream:  false,
			wantStreamSent: false,
			wantForcedFlag: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeOpenAI,
					UpstreamModelName: "test-model",
					ChannelSetting:    dto.ChannelSettings{ForceUpstreamStream: tt.forceUpstream},
				},
				RelayFormat: types.RelayFormatOpenAI,
			}

			request := &dto.GeneralOpenAIRequest{
				Model:  "test-model",
				Stream: tt.clientStream,
			}

			adaptor := &Adaptor{ChannelType: constant.ChannelTypeOpenAI}
			result, err := adaptor.ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)

			returnedRequest, ok := result.(*dto.GeneralOpenAIRequest)
			require.True(t, ok, "expected *GeneralOpenAIRequest, got %T", result)

			assert.Equal(t, tt.wantStreamSent, lo.FromPtrOr(returnedRequest.Stream, false),
				"upstream stream field mismatch")
			assert.Equal(t, tt.wantForcedFlag, info.UpstreamStreamForced,
				"UpstreamStreamForced flag mismatch")
		})
	}
}
