package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service/conversationarchive"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldArchiveRequestAllowsCommonPost(t *testing.T) {
	setConversationArchiveSetting(t, true)
	c := newArchiveTestContext(http.MethodPost, common.RoleCommonUser, "{}")

	require.True(t, shouldArchiveRequest(c))
}

func TestShouldArchiveRequestSkipsAdminAndRoot(t *testing.T) {
	setConversationArchiveSetting(t, true)

	for _, role := range []int{common.RoleAdminUser, common.RoleRootUser} {
		c := newArchiveTestContext(http.MethodPost, role, "{}")
		require.False(t, shouldArchiveRequest(c))
	}
}

func TestShouldArchiveRequestSkipsDisabledSetting(t *testing.T) {
	setConversationArchiveSetting(t, false)
	c := newArchiveTestContext(http.MethodPost, common.RoleCommonUser, "{}")

	require.False(t, shouldArchiveRequest(c))
}

func TestShouldArchiveRequestSkipsNonPost(t *testing.T) {
	setConversationArchiveSetting(t, true)
	c := newArchiveTestContext(http.MethodGet, common.RoleCommonUser, "{}")

	require.False(t, shouldArchiveRequest(c))
}

func TestGetArchiveRequestHeadersRoundTrip(t *testing.T) {
	c := newArchiveTestContext(http.MethodPost, common.RoleCommonUser, "{}")
	c.Request.Header.Set("Authorization", "Bearer test")
	c.Request.Header.Add("X-Trace", "first")
	c.Request.Header.Add("X-Trace", "second")

	compressed, err := getArchiveRequestHeaders(c)
	require.NoError(t, err)
	raw, err := conversationarchive.DecompressBytes(compressed)
	require.NoError(t, err)

	var headers map[string][]string
	require.NoError(t, common.Unmarshal(raw, &headers))
	require.Equal(t, []string{"Bearer test"}, headers["Authorization"])
	require.Equal(t, []string{"first", "second"}, headers["X-Trace"])
}

func TestArchiveKindMarksCanceledRequestAbnormal(t *testing.T) {
	c := newArchiveTestContext(http.MethodPost, common.RoleCommonUser, "{}")
	ctx, cancel := context.WithCancel(c.Request.Context())
	cancel()
	c.Request = c.Request.WithContext(ctx)

	require.Equal(t, conversationarchive.ArchiveKindAbnormal, archiveKind(c))
}

func TestArchiveKindDefaultsNormal(t *testing.T) {
	c := newArchiveTestContext(http.MethodPost, common.RoleCommonUser, "{}")

	require.Equal(t, conversationarchive.ArchiveKindNormal, archiveKind(c))
}

func newArchiveTestContext(method string, role int, body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(method, "/v1/chat/completions", strings.NewReader(body))
	common.SetContextKey(c, constant.ContextKeyUserRole, role)
	return c
}

func setConversationArchiveSetting(t *testing.T, enabled bool) {
	t.Helper()
	setting := operation_setting.GetConversationArchiveSetting()
	previous := setting.Enabled
	setting.Enabled = enabled
	t.Cleanup(func() {
		setting.Enabled = previous
	})
}
