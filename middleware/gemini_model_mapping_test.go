package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/newapi"
	"github.com/QuantumNous/new-api/relay/channel/sub2api"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestGeminiModelMappingRouting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settings := model_setting.GetGlobalSettings()
	previousPassThrough := settings.PassThroughRequestEnabled
	settings.PassThroughRequestEnabled = false
	t.Cleanup(func() { settings.PassThroughRequestEnabled = previousPassThrough })
	geminiSettings := model_setting.GetGeminiSettings()
	previousGemini := *geminiSettings
	geminiSettings.VersionSettings = map[string]string{"default": "v1beta"}
	t.Cleanup(func() { *geminiSettings = previousGemini })

	for _, provider := range []struct {
		name        string
		channelType int
		adaptor     channel.Adaptor
	}{
		{"gemini", constant.ChannelTypeGemini, &gemini.Adaptor{}},
		{"newapi", constant.ChannelTypeNewAPI, &newapi.Adaptor{}},
		{"sub2api", constant.ChannelTypeSub2API, &sub2api.Adaptor{}},
	} {
		t.Run(provider.name, func(t *testing.T) {
			for _, tc := range []struct {
				name           string
				model          string
				mapping        string
				upstream       string
				action         string
				version        string
				passThrough    bool
				disableAdapter bool
			}{
				{name: "mapped effort name", model: "gemini-3.8-flash", mapping: `{"gemini-3.8-flash":"gemini-3.8-flash-high"}`, upstream: "gemini-3.8-flash-high"},
				{name: "mapped effort name stream", model: "gemini-3.8-flash", mapping: `{"gemini-3.8-flash":"gemini-3.8-flash-high"}`, upstream: "gemini-3.8-flash-high", action: "streamGenerateContent"},
				{name: "mapped effort name chain", model: "client-alias", mapping: `{"client-alias":"gemini-3.8-flash","gemini-3.8-flash":"gemini-3.8-flash-high"}`, upstream: "gemini-3.8-flash-high"},
				{name: "mapped effort name passthrough", model: "gemini-3.8-flash", mapping: `{"gemini-3.8-flash":"gemini-3.8-flash-high"}`, upstream: "gemini-3.8-flash-high", passThrough: true},
				{name: "mapped effort name with explicit modifier", model: "client-alias", mapping: `{"client-alias":"gemini-3.8-flash-high@effort:low"}`, upstream: "gemini-3.8-flash-high"},
				{name: "unmapped legacy effort", model: "gemini-3.8-flash-high", upstream: "gemini-3.8-flash"},
				{name: "disabled legacy adapter", model: "gemini-3.8-flash-high", upstream: "gemini-3.8-flash-high", disableAdapter: true},
				{name: "mapped", model: "client-alias", mapping: `{"client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "stream", model: "client-alias", mapping: `{"client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash", action: "streamGenerateContent"},
				{name: "v1", model: "client-alias", mapping: `{"client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash", version: "v1"},
				{name: "chain", model: "client-alias", mapping: `{"client-alias":"intermediate","intermediate":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "exact modifier mapping", model: "client-alias@thinking:on@effort:high", mapping: `{"client-alias@thinking:on@effort:high":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "base modifier mapping", model: "client-alias@thinking:on", mapping: `{"client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "mapped modifier", model: "client-alias", mapping: `{"client-alias":"gemini-2.5-flash@thinking:off"}`, upstream: "gemini-2.5-flash"},
				{name: "unmapped modifier", model: "gemini-2.5-flash@thinking:off", upstream: "gemini-2.5-flash"},
				{name: "colon alias", model: "provider:client-alias", mapping: `{"provider:client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "escaped alias", model: "client alias/预览", mapping: `{"client alias/预览":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash"},
				{name: "body passthrough", model: "client-alias", mapping: `{"client-alias":"gemini-2.5-flash"}`, upstream: "gemini-2.5-flash", passThrough: true},
				{name: "unmapped", model: "gemini-2.5-flash", upstream: "gemini-2.5-flash"},
			} {
				t.Run(tc.name, func(t *testing.T) {
					geminiSettings.ThinkingAdapterEnabled = !tc.disableAdapter
					version := tc.version
					if version == "" {
						version = "v1beta"
					}
					action := tc.action
					if action == "" {
						action = "generateContent"
					}
					requestURL := "/" + version + "/models/" + url.PathEscape(tc.model) + ":" + action + "?trace=client-alias%3AgenerateContent&trace=second"
					if action == "streamGenerateContent" {
						requestURL += "&alt=sse"
					}
					const body = `{"contents":[{"role":"user","parts":[{"text":"hello"}]}]}`
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Request = httptest.NewRequest(http.MethodPost, requestURL, strings.NewReader(body))
					c.Request.Header.Set("Content-Type", "application/json")
					modelRequest, shouldSelect, err := getModelRequest(c)
					require.NoError(t, err)
					require.True(t, shouldSelect)
					assert.Equal(t, tc.model, modelRequest.Model)
					common.SetContextKey(c, constant.ContextKeyOriginalModel, modelRequest.Model)
					common.SetContextKey(c, constant.ContextKeyChannelType, provider.channelType)
					common.SetContextKey(c, constant.ContextKeyChannelModelMapping, tc.mapping)
					common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: tc.passThrough})

					var receivedPath, receivedQuery, receivedBody string
					upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						receivedPath, receivedQuery = r.URL.Path, r.URL.RawQuery
						data, readErr := io.ReadAll(r.Body)
						assert.NoError(t, readErr)
						receivedBody = string(data)
						w.WriteHeader(http.StatusNoContent)
					}))
					t.Cleanup(upstream.Close)
					common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
					request, err := helper.GetAndValidateGeminiRequest(c)
					require.NoError(t, err)
					info := relaycommon.GenRelayInfoGemini(c, request)
					originalPath := info.RequestURLPath
					originalQuery := c.Request.URL.RawQuery
					info.InitChannelMeta(c)
					require.NoError(t, helper.ModelMappedHelper(c, info, request))
					require.NoError(t, helper.ApplyReasoningModelSuffix(c, info, request))
					provider.adaptor.Init(info)
					payload := []byte(body)
					if !tc.passThrough {
						converted, convertErr := provider.adaptor.ConvertGeminiRequest(c, info, request)
						require.NoError(t, convertErr)
						payload, err = common.Marshal(converted)
						require.NoError(t, err)
					}
					response, err := provider.adaptor.DoRequest(c, info, strings.NewReader(string(payload)))
					require.NoError(t, err)
					httpResponse, ok := response.(*http.Response)
					require.True(t, ok)
					require.NoError(t, httpResponse.Body.Close())
					if provider.channelType == constant.ChannelTypeGemini {
						version = "v1beta"
					} else {
						assert.Equal(t, originalQuery, receivedQuery)
					}
					assert.Equal(t, "/"+version+"/models/"+tc.upstream+":"+action, receivedPath)
					assert.Equal(t, string(payload), receivedBody)
					if tc.model == "gemini-3.8-flash" {
						assert.False(t, gjson.Get(receivedBody, "generationConfig.thinkingConfig").Exists(), "a literal mapped suffix must not synthesize thinking controls")
					}
					assert.Equal(t, tc.model, info.OriginModelName)
					assert.Equal(t, tc.upstream, info.UpstreamModelName)
					assert.Equal(t, originalPath, info.RequestURLPath, "retry must retain the client URL")
					assert.Equal(t, requestURL, c.Request.URL.String())
				})
			}
		})
	}
}

func TestGeminiModelMappingJSONProtocolsAndRetry(t *testing.T) {
	for _, provider := range []struct {
		name        string
		channelType int
		adaptor     channel.Adaptor
	}{
		{"gemini", constant.ChannelTypeGemini, &gemini.Adaptor{}},
		{"newapi", constant.ChannelTypeNewAPI, &newapi.Adaptor{}},
		{"sub2api", constant.ChannelTypeSub2API, &sub2api.Adaptor{}},
	} {
		for _, protocol := range []struct {
			path   string
			format types.RelayFormat
			body   string
		}{
			{"/v1/chat/completions", types.RelayFormatOpenAI, `{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"hello"}]}`},
			{"/v1/responses", types.RelayFormatOpenAIResponses, `{"model":"gemini-3.8-flash","input":"hello"}`},
			{"/v1/messages", types.RelayFormatClaude, `{"model":"gemini-3.8-flash","max_tokens":1024,"messages":[{"role":"user","content":"hello"}]}`},
		} {
			t.Run(provider.name+protocol.path, func(t *testing.T) {
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest(http.MethodPost, protocol.path, strings.NewReader(protocol.body))
				c.Request.Header.Set("Content-Type", "application/json")
				modelRequest, _, err := getModelRequest(c)
				require.NoError(t, err)
				common.SetContextKey(c, constant.ContextKeyOriginalModel, modelRequest.Model)
				common.SetContextKey(c, constant.ContextKeyChannelType, provider.channelType)
				common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://upstream.example")
				request, err := helper.GetAndValidateRequest(c, protocol.format)
				require.NoError(t, err)
				info, err := relaycommon.GenRelayInfo(c, protocol.format, request, nil)
				require.NoError(t, err)
				for _, mapping := range []struct{ value, upstream string }{
					{`{"gemini-3.8-flash":"gemini-3.8-flash-high"}`, "gemini-3.8-flash-high"},
					{`{"gemini-3.8-flash":"gemini-3.8-flash-low"}`, "gemini-3.8-flash-low"},
					{"{}", "gemini-3.8-flash"},
				} {
					common.SetContextKey(c, constant.ContextKeyChannelModelMapping, mapping.value)
					info.InitChannelMeta(c)
					require.NoError(t, helper.ModelMappedHelper(c, info, request))
					require.NoError(t, helper.ApplyReasoningModelSuffix(c, info, request))
					provider.adaptor.Init(info)
					var converted any
					switch req := request.(type) {
					case *dto.GeneralOpenAIRequest:
						converted, err = provider.adaptor.ConvertOpenAIRequest(c, info, req)
					case *dto.OpenAIResponsesRequest:
						converted, err = provider.adaptor.ConvertOpenAIResponsesRequest(c, info, *req)
					case *dto.ClaudeRequest:
						converted, err = provider.adaptor.ConvertClaudeRequest(c, info, req)
					}
					require.NoError(t, err)
					data, err := common.Marshal(converted)
					require.NoError(t, err)
					upstreamURL, err := provider.adaptor.GetRequestURL(info)
					require.NoError(t, err)
					if provider.channelType == constant.ChannelTypeGemini {
						assert.Equal(t, "https://upstream.example/v1beta/models/"+mapping.upstream+":generateContent", upstreamURL)
					} else {
						assert.Equal(t, mapping.upstream, gjson.GetBytes(data, "model").String())
						assert.Equal(t, "https://upstream.example"+protocol.path, upstreamURL)
					}
					assert.Equal(t, mapping.upstream, info.UpstreamModelName)
					assert.Equal(t, "gemini-3.8-flash", info.OriginModelName)
					assert.Nil(t, info.ReasoningState())
				}
			})
		}
	}
}

func TestGeminiGatewayModelURLPreservesActionAndQuery(t *testing.T) {
	for _, adaptor := range []channel.Adaptor{&newapi.Adaptor{}, &sub2api.Adaptor{}} {
		for _, action := range []string{"generateContent", "streamGenerateContent", "embedContent", "batchEmbedContents"} {
			t.Run(adaptor.GetChannelName()+"/"+action, func(t *testing.T) {
				const rawQuery = "alt=sse&trace=client%3Aalias&trace=second"
				requestPath := "/v1/models/client:alias:" + action + "?" + rawQuery
				info := &relaycommon.RelayInfo{
					RelayFormat:     types.RelayFormatGemini,
					OriginModelName: "client:alias",
					RequestURLPath:  requestPath,
					ChannelMeta: &relaycommon.ChannelMeta{
						ChannelBaseUrl: "https://upstream.example/proxy",
					},
				}
				// Rebuild from the client URL on every attempt, including mapped
				// model IDs containing characters that require URL escaping.
				for _, upstream := range []string{"gemini-3.8-flash-high", "vendor/model #1?preview", "client:alias"} {
					info.UpstreamModelName = upstream
					rawURL, err := adaptor.GetRequestURL(info)
					require.NoError(t, err)
					parsed, err := url.Parse(rawURL)
					require.NoError(t, err)
					assert.Equal(t, "/proxy/v1/models/"+upstream+":"+action, parsed.Path)
					assert.Equal(t, rawQuery, parsed.RawQuery)
					assert.Empty(t, parsed.Fragment)
					assert.Equal(t, requestPath, info.RequestURLPath)
				}
			})
		}
	}
}
