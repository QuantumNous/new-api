package channel

import (
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDoRequestUsesSSRFProtectedClientForUserControlledUpstream(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalSetting := *fetchSetting
	defer func() {
		*fetchSetting = originalSetting
	}()

	fetchSetting.EnableSSRFProtection = true
	fetchSetting.AllowPrivateIp = false
	fetchSetting.DomainFilterMode = false
	fetchSetting.IpFilterMode = false
	fetchSetting.DomainList = nil
	fetchSetting.IpList = nil
	fetchSetting.AllowedPorts = []string{"1-65535"}
	fetchSetting.ApplyIPFilterForDomain = true
	service.InitHttpClient()

	requestCount := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/relay", nil)

	protectedRequest, err := http.NewRequest(http.MethodGet, upstream.URL, http.NoBody)
	require.NoError(t, err)
	_, err = doRequest(ctx, protectedRequest, &relaycommon.RelayInfo{
		UseSSRFProtectedClient: true,
		ChannelMeta:            &relaycommon.ChannelMeta{},
	})
	require.Error(t, err)
	assert.Zero(t, requestCount)

	standardRequest, err := http.NewRequest(http.MethodGet, upstream.URL, http.NoBody)
	require.NoError(t, err)
	response, err := doRequest(ctx, standardRequest, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	})
	require.NoError(t, err)
	defer response.Body.Close()
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Equal(t, 1, requestCount)
}
