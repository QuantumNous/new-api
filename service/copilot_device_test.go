package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func resetCopilotDeviceTestState(t *testing.T) {
	t.Helper()
	oldStart := copilotDeviceStartEndpoint
	oldToken := copilotDeviceTokenEndpoint
	oldUpdater := modelUpdateCopilotCredential
	oldRedisEnabled := common.RedisEnabled
	oldRedis := common.RDB
	oldClientID := system_setting.GetCopilotSettings().ClientID
	system_setting.GetCopilotSettings().ClientID = "copilot-test-client-id"
	mini := miniredis.RunT(t)
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{Addr: mini.Addr()})
	InitHttpClient()
	t.Cleanup(func() {
		copilotDeviceStartEndpoint = oldStart
		copilotDeviceTokenEndpoint = oldToken
		modelUpdateCopilotCredential = oldUpdater
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRedis
		system_setting.GetCopilotSettings().ClientID = oldClientID
	})
}

func TestCopilotDeviceFlowConcurrentPollWritesCredentialOnceAcrossRedisClaim(t *testing.T) {
	resetCopilotDeviceTestState(t)
	var writes atomic.Int32
	modelUpdateCopilotCredential = func(channelID int, credential string) error {
		writes.Add(1)
		time.Sleep(30 * time.Millisecond)
		return nil
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"access_token":"gho_github-access-token"}`))
	}))
	defer server.Close()
	copilotDeviceTokenEndpoint = server.URL

	flowID := "concurrent-flow"
	session := copilotDeviceSession{DeviceCode: "device", AdminID: 7, ChannelID: 112, ExpiresAt: time.Now().Add(time.Minute).Unix(), Interval: 1}
	require.NoError(t, saveCopilotDeviceSession(flowID, session))

	const pollers = 12
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < pollers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, _ = PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
		}()
	}
	close(start)
	wg.Wait()
	require.Equal(t, int32(1), writes.Load())
}

func TestCopilotDeviceFlowBindsOwnerAndConsumesAuthorizationOnce(t *testing.T) {
	resetCopilotDeviceTestState(t)
	var savedChannel int
	var savedCredential string
	modelUpdateCopilotCredential = func(channelID int, credential string) error {
		savedChannel, savedCredential = channelID, credential
		return nil
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/start":
			_, _ = w.Write([]byte(`{"device_code":"server-only-device-code","user_code":"ABCD-EFGH","verification_uri":"https://github.com/login/device","expires_in":900,"interval":1}`))
		case "/poll":
			require.NoError(t, r.ParseForm())
			require.Equal(t, "server-only-device-code", r.Form.Get("device_code"))
			_, _ = w.Write([]byte(`{"access_token":"gho_github-access-token"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	copilotDeviceStartEndpoint = server.URL + "/start"
	copilotDeviceTokenEndpoint = server.URL + "/poll"

	flow, err := StartCopilotDeviceFlow(context.Background(), 7, 112, "")
	require.NoError(t, err)
	require.NotEmpty(t, flow.FlowID)
	require.Equal(t, "ABCD-EFGH", flow.UserCode)
	require.NotContains(t, flow.FlowID, "server-only-device-code")

	_, err = PollCopilotDeviceFlow(context.Background(), flow.FlowID, 8, 112, "")
	require.EqualError(t, err, "copilot device authorization session does not match")
	result, err := PollCopilotDeviceFlow(context.Background(), flow.FlowID, 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "authorized", result.Status)
	require.Equal(t, 112, savedChannel)
	require.Equal(t, "gho_github-access-token", savedCredential)

	result, err = PollCopilotDeviceFlow(context.Background(), flow.FlowID, 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "expired", result.Status)
}

func TestCopilotDeviceFlowHandlesPendingSlowDownAndDenied(t *testing.T) {
	resetCopilotDeviceTestState(t)
	responses := []string{
		`{"error":"authorization_pending"}`,
		`{"error":"slow_down","interval":8}`,
		`{"error":"access_denied"}`,
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := responses[0]
		responses = responses[1:]
		_, _ = w.Write([]byte(response))
	}))
	defer server.Close()
	copilotDeviceTokenEndpoint = server.URL

	flowID := "pending-flow"
	session := copilotDeviceSession{DeviceCode: "device", AdminID: 7, ChannelID: 112, ExpiresAt: time.Now().Add(time.Minute).Unix(), Interval: 1}
	require.NoError(t, saveCopilotDeviceSession(flowID, session))
	result, err := PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "pending", result.Status)

	session, found, err := loadCopilotDeviceSession(context.Background(), flowID)
	require.NoError(t, err)
	require.True(t, found)
	session.NextPollAt = 0
	require.NoError(t, saveCopilotDeviceSession(flowID, session))
	result, err = PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "pending", result.Status)

	session, found, err = loadCopilotDeviceSession(context.Background(), flowID)
	require.NoError(t, err)
	require.True(t, found)
	require.GreaterOrEqual(t, session.Interval, 8)
	session.NextPollAt = 0
	require.NoError(t, saveCopilotDeviceSession(flowID, session))
	result, err = PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "denied", result.Status)
}

func TestCopilotDeviceStartNeverExposesDeviceCode(t *testing.T) {
	resetCopilotDeviceTestState(t)
	var received url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		received = r.Form
		_, _ = w.Write([]byte(`{"device_code":"secret-device","user_code":"CODE","verification_uri":"https://github.com/login/device","expires_in":600,"interval":5}`))
	}))
	defer server.Close()
	copilotDeviceStartEndpoint = server.URL

	flow, err := StartCopilotDeviceFlow(context.Background(), 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "copilot-test-client-id", received.Get("client_id"))
	encoded, err := common.Marshal(flow)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "secret-device")
}

func TestCopilotDeviceFlowUsesSystemSettingClientID(t *testing.T) {
	resetCopilotDeviceTestState(t)
	system_setting.GetCopilotSettings().ClientID = " configured-client-id "
	var received url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		received = r.Form
		_, _ = w.Write([]byte(`{"device_code":"secret-device","user_code":"CODE","verification_uri":"https://github.com/login/device","expires_in":600,"interval":5}`))
	}))
	defer server.Close()
	copilotDeviceStartEndpoint = server.URL

	_, err := StartCopilotDeviceFlow(context.Background(), 7, 112, "")
	require.NoError(t, err)
	require.Equal(t, "configured-client-id", received.Get("client_id"))
}

func TestCopilotDeviceFlowRequiresConfiguredClientID(t *testing.T) {
	resetCopilotDeviceTestState(t)
	system_setting.GetCopilotSettings().ClientID = ""

	_, err := StartCopilotDeviceFlow(context.Background(), 7, 112, "")
	require.EqualError(t, err, "Copilot Device Flow is not configured; configure the Copilot Client ID")
}

func TestCopilotDeviceFlowFailsClosedWithoutRedis(t *testing.T) {
	resetCopilotDeviceTestState(t)
	common.RedisEnabled = false

	_, err := StartCopilotDeviceFlow(context.Background(), 7, 112, "")
	require.EqualError(t, err, "Copilot Device Flow requires Redis")
}

func TestCopilotDeviceFlowDoesNotWriteCredentialWhenConsumeFails(t *testing.T) {
	resetCopilotDeviceTestState(t)
	var writes atomic.Int32
	modelUpdateCopilotCredential = func(channelID int, credential string) error {
		writes.Add(1)
		return nil
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		common.RDB = redis.NewClient(&redis.Options{Addr: "127.0.0.1:0", DialTimeout: time.Millisecond})
		_, _ = w.Write([]byte(`{"access_token":"gho_github-access-token"}`))
	}))
	defer server.Close()
	copilotDeviceTokenEndpoint = server.URL
	flowID := "consume-failure-flow"
	session := copilotDeviceSession{DeviceCode: "device", AdminID: 7, ChannelID: 112, ExpiresAt: time.Now().Add(time.Minute).Unix(), Interval: 1}
	require.NoError(t, saveCopilotDeviceSession(flowID, session))

	_, err := PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
	require.ErrorContains(t, err, "session could not be consumed")
	require.Zero(t, writes.Load())
}

func TestCopilotDeviceFlowRejectsNonOAuthAppCredential(t *testing.T) {
	resetCopilotDeviceTestState(t)
	var writes atomic.Int32
	modelUpdateCopilotCredential = func(channelID int, credential string) error {
		writes.Add(1)
		return nil
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"access_token":"ghu_legacy-credential"}`))
	}))
	defer server.Close()
	copilotDeviceTokenEndpoint = server.URL
	flowID := "unsupported-credential-flow"
	session := copilotDeviceSession{DeviceCode: "device", AdminID: 7, ChannelID: 112, ExpiresAt: time.Now().Add(time.Minute).Unix(), Interval: 1}
	require.NoError(t, saveCopilotDeviceSession(flowID, session))

	_, err := PollCopilotDeviceFlow(context.Background(), flowID, 7, 112, "")
	require.EqualError(t, err, "copilot device authorization returned an unsupported credential")
	require.Zero(t, writes.Load())
}
