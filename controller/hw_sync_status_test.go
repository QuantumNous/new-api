package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/hwsync"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHwSyncStatus covers what the dashboard reads: the newest upstream tag, the
// tag our main branch already contains, and the sync PR number when GitHub
// answers. A GitHub failure must cost only the PR number, and a non-admin must
// never reach the endpoint.
func TestHwSyncStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	releasesStatus, pullsStatus, calls := http.StatusOK, http.StatusOK, 0
	github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		switch {
		case strings.HasSuffix(r.URL.Path, "/releases"):
			w.WriteHeader(releasesStatus)
			_, _ = w.Write([]byte(`[
				{"tag_name":"v1.0.0-rc.50","draft":true,"prerelease":true},
				{"tag_name":"v1.0.0-rc.49","draft":false,"prerelease":true},
				{"tag_name":"v1.0.0-rc.48","draft":false,"prerelease":false}
			]`))
		case strings.HasSuffix(r.URL.Path, "/pulls"):
			// The sync branch of the tag just read, never of another tag.
			assert.Equal(t, "sync/upstream-v1.0.0-rc.48", r.URL.Query().Get("head")[len("hisarweb-be:"):])
			w.WriteHeader(pullsStatus)
			_, _ = w.Write([]byte(`[{"number":231}]`))
		default:
			t.Errorf("unexpected GitHub path %s", r.URL.Path)
		}
	}))
	defer github.Close()
	previousReleases, previousPulls := hwSyncStatusReleasesURL, hwSyncStatusPullsURL
	hwSyncStatusReleasesURL, hwSyncStatusPullsURL = github.URL+"/repos/x/releases", github.URL+"/repos/x/pulls"
	t.Cleanup(func() {
		hwSyncStatusReleasesURL, hwSyncStatusPullsURL = previousReleases, previousPulls
		hwSyncStatusCache.expiresAt = time.Time{}
	})
	request := func(role int) (int, hwSyncStatusEnvelope) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set("role", role)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/hw/sync-status", nil)
		HwSyncStatus(c)
		var body hwSyncStatusEnvelope
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body), recorder.Body.String())
		return recorder.Code, body
	}

	code, body := request(common.RoleCommonUser)
	assert.Equal(t, http.StatusForbidden, code)
	assert.False(t, body.Success)
	assert.Equal(t, 0, calls, "a non-admin never triggers a GitHub call")

	code, body = request(common.RoleAdminUser)
	require.Equal(t, http.StatusOK, code)
	assert.True(t, body.Success)
	assert.Equal(t, "v1.0.0-rc.48", body.Data.UpstreamTag,
		"a draft or pre-release candidate is not the tag we sync to")
	assert.Equal(t, hwsync.MergedTag(), body.Data.MergedTag)
	require.NotNil(t, body.Data.PRNumber)
	assert.Equal(t, 231, *body.Data.PRNumber)
	_, err := time.Parse(time.RFC3339, body.Data.CheckedAt)
	assert.NoError(t, err, "checkedAt is RFC3339")

	callsBefore := calls
	code, body = request(common.RoleAdminUser)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, 231, *body.Data.PRNumber)
	assert.Equal(t, callsBefore, calls, "a second check within the hour is served from the cache")

	hwSyncStatusCache.expiresAt = time.Time{}
	pullsStatus = http.StatusInternalServerError
	code, body = request(common.RoleAdminUser)
	require.Equal(t, http.StatusOK, code, "an unreachable pull request list must not fail the check")
	assert.Equal(t, "v1.0.0-rc.48", body.Data.UpstreamTag)
	assert.Nil(t, body.Data.PRNumber)

	hwSyncStatusCache.expiresAt = time.Time{}
	releasesStatus = http.StatusForbidden
	code, body = request(common.RoleAdminUser)
	assert.Equal(t, http.StatusBadGateway, code, "without a tag there is no status to show")
	assert.False(t, body.Success)
}

type hwSyncStatusEnvelope struct {
	Success bool             `json:"success"`
	Data    hwSyncStatusData `json:"data"`
}

// TestHwSyncStatusMergedTag pins the value the embed carries, so a sync that
// forgets to rewrite merged-tag.txt fails here instead of in the dashboard.
func TestHwSyncStatusMergedTag(t *testing.T) {
	assert.Regexp(t, `^v1\.0\.0-rc\.\d+$`, hwsync.MergedTag())
}
