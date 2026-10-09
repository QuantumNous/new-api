package model

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setClientInfoToggles overrides the client-info system switches for the
// duration of one test and restores the previous values afterwards.
func setClientInfoToggles(t *testing.T, recordEnabled, userVisible bool) {
	t.Helper()
	previousRecord := common.LogRecordClientInfoEnabled
	previousVisible := common.LogClientInfoUserVisibleEnabled
	common.LogRecordClientInfoEnabled = recordEnabled
	common.LogClientInfoUserVisibleEnabled = userVisible
	t.Cleanup(func() {
		common.LogRecordClientInfoEnabled = previousRecord
		common.LogClientInfoUserVisibleEnabled = previousVisible
	})
}

func newClientInfoTestContext(t *testing.T, userAgent string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	request := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	request.Header.Set("User-Agent", userAgent)
	request.RemoteAddr = "203.0.113.8:12345"
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = request
	return c
}

func fetchLogByRequestId(t *testing.T, requestId string) *Log {
	t.Helper()
	var log Log
	require.NoError(t, LOG_DB.Where("request_id = ?", requestId).First(&log).Error)
	return &log
}

// createRecordIpOptInUser inserts a user whose personal setting opted into
// IP recording, the pre-existing per-user feature the system switch must not
// disturb.
func createRecordIpOptInUser(t *testing.T, id int, username string) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: username,
		Password: "test-password",
		AffCode:  username + "-aff",
		Setting:  `{"record_ip_log":true}`,
	}
	require.NoError(t, DB.Create(user).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Unscoped().Delete(&User{}, id).Error)
	})
}

func TestRecordConsumeLogClientInfoFollowsSystemSwitch(t *testing.T) {
	testCases := []struct {
		name          string
		recordEnabled bool
		userAgent     string
		wantAgent     string
		wantRecorded  bool
	}{
		{
			name:          "records ip and agent when switch on",
			recordEnabled: true,
			userAgent:     "OpenAI/Python 1.0",
			wantAgent:     "OpenAI/Python 1.0",
			wantRecorded:  true,
		},
		{
			name:          "records nothing when switch off",
			recordEnabled: false,
			userAgent:     "OpenAI/Python 1.0",
			wantRecorded:  false,
		},
		{
			name:          "caps agent at 512 runes",
			recordEnabled: true,
			userAgent:     strings.Repeat("哦", 600),
			wantAgent:     strings.Repeat("哦", 512),
			wantRecorded:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setClientInfoToggles(t, tc.recordEnabled, false)
			c := newClientInfoTestContext(t, tc.userAgent)
			requestId := "ci-consume-" + tc.name
			c.Set(common.RequestIdKey, requestId)

			RecordConsumeLog(c, 1, RecordConsumeLogParams{
				ModelName: "gpt-test",
				TokenName: "test-token",
				Content:   "test",
				// Non-nil so the stored metadata is a parseable JSON object
				// even when nothing is recorded.
				Other: NewLogOther(),
			})

			log := fetchLogByRequestId(t, requestId)
			parsed, err := common.StrToMap(log.Other)
			require.NoError(t, err)
			if tc.wantRecorded {
				assert.Equal(t, "203.0.113.8", parsed["client_ip"])
				assert.Equal(t, tc.wantAgent, parsed["client_agent"])
			} else {
				assert.NotContains(t, parsed, "client_ip")
				assert.NotContains(t, parsed, "client_agent")
			}
			// The ip column stays reserved for the per-user opt-in feature.
			assert.Empty(t, log.Ip)
		})
	}
}

func TestRecordErrorLogClientInfoFollowsSystemSwitch(t *testing.T) {
	setClientInfoToggles(t, true, false)
	c := newClientInfoTestContext(t, "curl/8.0")
	requestId := "ci-error-1"
	c.Set(common.RequestIdKey, requestId)

	RecordErrorLog(c, 1, 7, "gpt-test", "test-token", "boom", 1, 2, false, "default", nil)

	log := fetchLogByRequestId(t, requestId)
	parsed, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, "203.0.113.8", parsed["client_ip"])
	assert.Equal(t, "curl/8.0", parsed["client_agent"])
	assert.Equal(t, LogTypeError, log.Type)
	assert.Empty(t, log.Ip)
}

func TestRecordConsumeLogIpColumnStaysUserOptIn(t *testing.T) {
	setClientInfoToggles(t, true, false)
	createRecordIpOptInUser(t, 4242, "client-info-optin")

	c := newClientInfoTestContext(t, "OpenAI/Python 1.0")
	c.Set(common.RequestIdKey, "ci-optin-1")
	c.Set("username", "client-info-optin")

	RecordConsumeLog(c, 4242, RecordConsumeLogParams{
		ModelName: "gpt-test",
		TokenName: "test-token",
		Content:   "test",
	})

	log := fetchLogByRequestId(t, "ci-optin-1")
	// Both features coexist: the opt-in keeps writing the ip column while the
	// system switch adds the client metadata.
	assert.Equal(t, "203.0.113.8", log.Ip)
	parsed, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, "203.0.113.8", parsed["client_ip"])
	assert.Equal(t, "OpenAI/Python 1.0", parsed["client_agent"])
}
