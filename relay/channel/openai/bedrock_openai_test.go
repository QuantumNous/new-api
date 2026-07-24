package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetBedrockOpenAIRequestURL(t *testing.T) {
	tests := []struct {
		name        string
		baseURL     string
		model       string
		path        string
		relayMode   int
		key         string
		keyType     dto.AwsKeyType
		expectedURL string
		wantErr     bool
	}{
		{
			name:        "frontier mantle base is derived from region",
			model:       "openai.gpt-5.6-sol",
			path:        "/v1/responses",
			relayMode:   relayconstant.RelayModeResponses,
			key:         "AKID|SECRET|us-east-2",
			expectedURL: "https://bedrock-mantle.us-east-2.api.aws/openai/v1/responses",
		},
		{
			name:        "frontier mantle avoids duplicate segment",
			baseURL:     "https://bedrock-mantle.us-east-2.api.aws/openai/v1/",
			model:       "openai.gpt-5.4",
			path:        "/v1/responses",
			relayMode:   relayconstant.RelayModeResponses,
			expectedURL: "https://bedrock-mantle.us-east-2.api.aws/openai/v1/responses",
		},
		{
			name:        "gpt oss mantle chat path",
			baseURL:     "https://bedrock-mantle.us-east-1.api.aws/openai",
			model:       "openai.gpt-oss-120b",
			path:        "/v1/chat/completions",
			relayMode:   relayconstant.RelayModeChatCompletions,
			expectedURL: "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions",
		},
		{
			name:        "gpt oss mantle responses path",
			baseURL:     "https://bedrock-mantle.us-west-2.api.aws",
			model:       "openai.gpt-oss-20b",
			path:        "/v1/responses",
			relayMode:   relayconstant.RelayModeResponses,
			expectedURL: "https://bedrock-mantle.us-west-2.api.aws/v1/responses",
		},
		{
			name:        "gpt oss runtime base is derived from region",
			model:       "openai.gpt-oss-20b-1:0",
			path:        "/v1/chat/completions",
			relayMode:   relayconstant.RelayModeChatCompletions,
			key:         "bedrock-api-key|us-west-2",
			keyType:     dto.AwsKeyTypeApiKey,
			expectedURL: "https://bedrock-runtime.us-west-2.amazonaws.com/v1/chat/completions",
		},
		{
			name:      "runtime rejects responses",
			baseURL:   "https://bedrock-runtime.us-east-1.amazonaws.com",
			model:     "openai.gpt-oss-120b-1:0",
			path:      "/v1/responses",
			relayMode: relayconstant.RelayModeResponses,
			wantErr:   true,
		},
		{
			name:        "custom proxy is not rewritten",
			baseURL:     "https://bedrock.example.com/provider",
			model:       "openai.gpt-5.5",
			path:        "/v1/responses",
			relayMode:   relayconstant.RelayModeResponses,
			expectedURL: "https://bedrock.example.com/provider/v1/responses",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := tt.key
			if key == "" {
				key = "AKID|SECRET|us-east-1"
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeAwsOpenAI,
					ChannelBaseUrl: tt.baseURL,
					ApiKey:         key,
					ChannelOtherSettings: dto.ChannelOtherSettings{
						AwsKeyType: tt.keyType,
					},
					UpstreamModelName: tt.model,
				},
				RelayMode:      tt.relayMode,
				RequestURLPath: tt.path,
			}

			requestURL, err := getBedrockOpenAIRequestURL(info)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expectedURL, requestURL)
		})
	}
}

func TestParseBedrockOpenAICredentialsRejectsInvalidInput(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ApiKey: "AKID|SECRET|https://example.com",
	}}

	_, err := parseBedrockOpenAICredentials(info)
	require.ErrorContains(t, err, "invalid AWS region")
}

func TestBedrockOpenAISetupRequestHeaderUsesOnlyBearerToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: constant.ChannelTypeAwsOpenAI,
		ApiKey:      "bedrock-api-key|us-east-1",
		ChannelOtherSettings: dto.ChannelOtherSettings{
			AwsKeyType: dto.AwsKeyTypeApiKey,
		},
	}}
	header := http.Header{}

	err := (&Adaptor{}).SetupRequestHeader(ctx, &header, info)
	require.NoError(t, err)
	require.Equal(t, "Bearer bedrock-api-key", header.Get("Authorization"))
}

func TestBedrockOpenAISignRequestUsesEndpointSpecificService(t *testing.T) {
	tests := []struct {
		name            string
		requestURL      string
		model           string
		expectedService string
	}{
		{
			name:            "mantle",
			requestURL:      "https://bedrock-mantle.us-east-1.api.aws/openai/v1/responses",
			model:           "openai.gpt-5.5",
			expectedService: "bedrock-mantle",
		},
		{
			name:            "runtime",
			requestURL:      "https://bedrock-runtime.us-east-1.amazonaws.com/v1/chat/completions",
			model:           "openai.gpt-oss-20b-1:0",
			expectedService: "bedrock",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestBody := `{"model":"` + tt.model + `","input":"hello"}`
			req := httptest.NewRequest(http.MethodPost, tt.requestURL, strings.NewReader(requestBody))
			req.Header.Set("Content-Type", "application/json")
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType:       constant.ChannelTypeAwsOpenAI,
				ApiKey:            "AKID|SECRET|us-east-1",
				UpstreamModelName: tt.model,
			}}

			err := (&Adaptor{}).SignRequest(nil, req, info)
			require.NoError(t, err)
			require.Contains(t, req.Header.Get("Authorization"), "/us-east-1/"+tt.expectedService+"/aws4_request")
			require.NotEmpty(t, req.Header.Get("X-Amz-Date"))
			body, readErr := io.ReadAll(req.Body)
			require.NoError(t, readErr)
			require.Equal(t, requestBody, string(body))
		})
	}
}

func TestBedrockOpenAIAdaptorMetadata(t *testing.T) {
	adaptor := &Adaptor{ChannelType: constant.ChannelTypeAwsOpenAI}
	require.Equal(t, BedrockOpenAIChannelName, adaptor.GetChannelName())
	require.Len(t, adaptor.GetModelList(), len(common.BedrockOpenAIResponsesModels)+len(common.BedrockOpenAIMantleChatModels)+len(common.BedrockOpenAIChatOnlyModels)+len(common.BedrockOpenAIRuntimeChatModels))
}
