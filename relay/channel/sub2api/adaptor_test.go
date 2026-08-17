package sub2api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLAlphaSearch(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeSub2API,
			ChannelBaseUrl: "https://sub2api.example",
		},
		RequestURLPath: "/v1/alpha/search",
		RelayMode:      relayconstant.RelayModeAlphaSearch,
	}

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://sub2api.example/v1/alpha/search", url)
}

func TestAdaptorInheritsNewAPIResponsesCompactSupport(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeSub2API,
			ChannelBaseUrl: "https://sub2api.example",
		},
		RequestURLPath: "/v1/responses/compact",
		RelayMode:      relayconstant.RelayModeResponsesCompact,
	}

	url, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://sub2api.example/v1/responses/compact", url)
	assert.Equal(t, "sub2api", adaptor.GetChannelName())
	assert.Empty(t, adaptor.GetModelList())
}

func TestRen2HubCompactAttemptsSendExpectedModelToSub2API(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tt := range []struct {
		name      string
		stage     relaycommon.CompactAttemptStage
		wantModel string
	}{
		{name: "exact suffix", stage: relaycommon.CompactAttemptExact, wantModel: "gpt-5-openai-compact"},
		{name: "base fallback", stage: relaycommon.CompactAttemptBase, wantModel: "gpt-5"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			capturedModel := ""
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "/v1/responses/compact", r.URL.Path)
				var payload struct {
					Model string `json:"model"`
				}
				require.NoError(t, common.DecodeJson(r.Body, &payload))
				capturedModel = payload.Model
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"output":[],"usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}`))
			}))
			defer upstream.Close()

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
			info := &relaycommon.RelayInfo{
				RelayMode:           relayconstant.RelayModeResponsesCompact,
				RelayFormat:         "openai_responses_compaction",
				OriginModelName:     "gpt-5",
				RequestedModel:      "gpt-5",
				LogicalBillingModel: "gpt-5-openai-compact",
				CompactAttemptStage: tt.stage,
				RequestURLPath:      "/v1/responses/compact",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeSub2API,
					ChannelBaseUrl: upstream.URL,
					ApiKey:         "test-key",
				},
			}
			request := &dto.OpenAIResponsesRequest{Model: "gpt-5"}
			require.NoError(t, helper.ModelMappedHelper(ctx, info, request))

			adaptor := &Adaptor{}
			adaptor.Init(info)
			converted, err := adaptor.ConvertOpenAIResponsesRequest(ctx, info, *request)
			require.NoError(t, err)
			body, err := common.Marshal(converted)
			require.NoError(t, err)
			response, err := adaptor.DoRequest(ctx, info, bytes.NewReader(body))
			require.NoError(t, err)
			require.NotNil(t, response)
			defer response.(*http.Response).Body.Close()
			require.Equal(t, tt.wantModel, capturedModel)
		})
	}
}
