package relay

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildAlphaSearchRequestBodyPreservesUnknownFields(t *testing.T) {
	raw := []byte(`{
		"id":"req_1",
		"model":"gpt-5.1",
		"input":[{"role":"user","content":"hi"}],
		"commands":{"search_query":[{"q":"weather","recency":1}]},
		"settings":{"locale":"en"},
		"future_field":{"nested":true}
	}`)

	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1-mapped")
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(out, &body))
	assert.Equal(t, "gpt-5.1-mapped", body["model"])
	assert.Equal(t, "req_1", body["id"])
	require.Contains(t, body, "commands")
	require.Contains(t, body, "settings")
	require.Contains(t, body, "future_field")
	require.Contains(t, body, "input")

	commands, ok := body["commands"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, commands, "search_query")

	future, ok := body["future_field"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, true, future["nested"])
}

func TestBuildAlphaSearchRequestBodyNoMappingKeepsRawBytes(t *testing.T) {
	raw := []byte(`{"model":"gpt-5.1","commands":{"search_query":[{"q":"x"}]},"future_field":1}`)
	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1")
	require.NoError(t, err)
	assert.Equal(t, raw, out)
}

func TestAlphaSearchOpenAIChannelForwardsAndAccountsForSuccess(t *testing.T) {
	db := setupRelayChannelDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	oldLogs, oldBatch := common.LogConsumeEnabled, common.BatchUpdateEnabled
	common.LogConsumeEnabled, common.BatchUpdateEnabled = false, false
	t.Cleanup(func() { common.LogConsumeEnabled, common.BatchUpdateEnabled = oldLogs, oldBatch })
	for _, status := range []int{http.StatusOK, http.StatusTooManyRequests} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			user := model.User{Username: http.StatusText(status), AffCode: http.StatusText(status), Group: "default", Quota: 1_000_000}
			channel := model.Channel{Name: "search", Type: constant.ChannelTypeOpenAI}
			require.NoError(t, db.Create(&user).Error)
			require.NoError(t, db.Create(&channel).Error)
			upstreamBody := `{"result":"found","future_response":true}`
			if status != http.StatusOK {
				upstreamBody = `{"error":{"message":"rate limited","type":"rate_limit_error"}}`
			}
			var gotPath, gotAuth string
			var gotBody []byte
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath, gotAuth = r.URL.RequestURI(), r.Header.Get("Authorization")
				gotBody, _ = io.ReadAll(r.Body)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = io.WriteString(w, upstreamBody)
			}))
			defer upstream.Close()
			body := `{"model":"search-model","commands":{"search_query":[{"q":"test"}]},"future_field":false}`
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/alpha/search?locale=zh", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyOriginalModel, "search-model")
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "test-upstream-key")
			common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
			common.SetContextKey(c, constant.ContextKeyUserId, user.Id)
			common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
			c.Set("model_mapping", `{"search-model":"mapped-search"}`)
			info := relaycommon.GenRelayInfoAlphaSearch(c, &dto.AlphaSearchRequest{Model: "search-model", RawBody: []byte(body)})
			info.PriceData.GroupRatioInfo = hosttypes.GroupRatioInfo{GroupRatio: 1}
			// The request's reservation was already charged before entering the relay helper.
			info.FinalPreConsumedQuota = 5000
			apiErr := AlphaSearchHelper(c, info)
			assert.Equal(t, "/v1/alpha/search?locale=zh", gotPath)
			assert.Equal(t, "Bearer test-upstream-key", gotAuth)
			assert.JSONEq(t, `{"model":"mapped-search","commands":{"search_query":[{"q":"test"}]},"future_field":false}`, string(gotBody))
			require.NoError(t, db.First(&user, user.Id).Error)
			require.NoError(t, db.First(&channel, channel.Id).Error)
			if status == http.StatusOK {
				require.Nil(t, apiErr)
				assert.Equal(t, upstreamBody, recorder.Body.String())
				assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
				assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
				assert.Equal(t, 5000, user.UsedQuota)
				assert.Equal(t, 1, user.RequestCount)
				assert.Equal(t, int64(5000), channel.UsedQuota)
			} else {
				require.NotNil(t, apiErr)
				assert.Equal(t, status, apiErr.StatusCode)
				assert.Zero(t, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount)
				assert.Zero(t, user.UsedQuota)
				assert.Zero(t, channel.UsedQuota)
			}
		})
	}
}
