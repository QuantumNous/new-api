package controller

import (
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/hwsync"

	"github.com/gin-gonic/gin"
)

// The system update button used to hand the browser a link to the upstream
// release page, where the image sits that would replace our fork. It now shows
// how far our own sync has come: the newest upstream tag, the tag our main
// branch already contains, and the open PR of the sync branch if there is one.
// The browser cannot ask GitHub (the CSP keeps connect-src at 'self'), so the
// server asks, at most once per cache window, and degrades to prNumber null
// instead of failing: an unreachable GitHub must not hide the tag progress.
var (
	hwSyncStatusReleasesURL = "https://api.github.com/repos/QuantumNous/new-api/releases?per_page=100"
	hwSyncStatusPullsURL    = "https://api.github.com/repos/hisarweb-be/hisarweb-ai/pulls"
	hwSyncStatusBranch      = "sync/upstream-"
)

const (
	hwSyncStatusTTL      = time.Hour
	hwSyncStatusMaxBody  = 4 << 20
	hwSyncStatusPageSize = 100
)

var hwSyncStatusClient = &http.Client{Timeout: 5 * time.Second}

var hwSyncStatusCache struct {
	sync.Mutex
	tag       string
	prNumber  *int
	expiresAt time.Time
}

type hwSyncStatusData struct {
	UpstreamTag string `json:"upstreamTag"`
	MergedTag   string `json:"mergedTag"`
	PRNumber    *int   `json:"prNumber"`
	CheckedAt   string `json:"checkedAt"`
}

type hwUpstreamRelease struct {
	TagName    string `json:"tag_name"`
	Draft      bool   `json:"draft"`
	Prerelease bool   `json:"prerelease"`
}

type hwSyncPull struct {
	Number int `json:"number"`
}

// HwSyncStatus serves the sync position of our fork to administrators.
// A GitHub failure keeps the internal error out of the answer: the tags stay
// correct, only the PR number goes missing until the next cache window.
func HwSyncStatus(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "Only administrators can check for updates",
		})
		return
	}
	cache := &hwSyncStatusCache
	cache.Lock()
	defer cache.Unlock()
	if time.Now().After(cache.expiresAt) {
		cache.tag = hwFetchLatestUpstreamTag()
		cache.prNumber = nil
		// Without a tag there is no sync branch to look for: asking GitHub for
		// "sync/upstream-" would answer for some other branch.
		if cache.tag != "" {
			cache.prNumber = hwFetchOpenSyncPull(hwSyncStatusBranch + cache.tag)
		}
		cache.expiresAt = time.Now().Add(hwSyncStatusTTL)
	}
	if cache.tag == "" {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "The upstream release list is not available right now",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": hwSyncStatusData{
			UpstreamTag: cache.tag,
			MergedTag:   hwsync.MergedTag(),
			PRNumber:    cache.prNumber,
			CheckedAt:   time.Now().UTC().Format(time.RFC3339),
		},
	})
}

// hwFetchLatestUpstreamTag returns the newest published upstream release tag,
// ordered by upstream's own release list. An empty string means the call failed.
func hwFetchLatestUpstreamTag() string {
	body, ok := hwSyncStatusGet(hwSyncStatusReleasesURL)
	if !ok {
		return ""
	}
	var releases []hwUpstreamRelease
	if err := common.Unmarshal(body, &releases); err != nil {
		common.SysLog("hw: upstream release list is not readable: " + err.Error())
		return ""
	}
	latest := ""
	for _, release := range releases {
		if release.Draft || release.Prerelease || release.TagName == "" {
			continue
		}
		if latest == "" {
			latest = release.TagName
			continue
		}
		higher, err := hwsync.CompareTags(release.TagName, latest)
		if err != nil {
			common.SysLog("hw: upstream tag is not comparable: " + err.Error())
			continue
		}
		if higher > 0 {
			latest = release.TagName
		}
	}
	return latest
}

// hwFetchOpenSyncPull returns the number of the open pull request whose head is
// the sync branch, or nil when there is none or GitHub cannot be asked.
func hwFetchOpenSyncPull(branch string) *int {
	query := url.Values{}
	query.Set("state", "open")
	query.Set("head", "hisarweb-be:"+branch)
	body, ok := hwSyncStatusGet(hwSyncStatusPullsURL + "?" + query.Encode())
	if !ok {
		return nil
	}
	var pulls []hwSyncPull
	if err := common.Unmarshal(body, &pulls); err != nil {
		common.SysLog("hw: sync pull request list is not readable: " + err.Error())
		return nil
	}
	if len(pulls) == 0 || pulls[0].Number <= 0 {
		return nil
	}
	number := pulls[0].Number
	return &number
}

// hwSyncStatusGet performs one unauthenticated GitHub call. The repository is
// public, so no token is stored here and a rate limit only costs the PR number.
func hwSyncStatusGet(target string) ([]byte, bool) {
	request, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		return nil, false
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	response, err := hwSyncStatusClient.Do(request)
	if err != nil {
		common.SysLog("hw: GitHub call failed: " + err.Error())
		return nil, false
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		common.SysLog("hw: GitHub answered " + response.Status + " for " + target)
		return nil, false
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, hwSyncStatusMaxBody))
	if err != nil {
		return nil, false
	}
	return body, true
}
