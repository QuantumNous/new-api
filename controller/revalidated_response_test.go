package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Requests go through a real engine rather than calling the handler with a
// bare test context: c.Status only records the code on gin's writer, and
// httptest.NewRecorder starts at 200, so a directly-invoked handler could
// report the wrong status for a 304.
func serveOptionRequest(t *testing.T, handler gin.HandlerFunc, path string, ifNoneMatch string) *httptest.ResponseRecorder {
	t.Helper()
	engine := gin.New()
	engine.GET(path, handler)

	request := httptest.NewRequest(http.MethodGet, path, nil)
	if ifNoneMatch != "" {
		request.Header.Set("If-None-Match", ifNoneMatch)
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

func setOptionMap(t *testing.T, values map[string]string) {
	t.Helper()
	previous := common.OptionMap
	common.OptionMap = values
	t.Cleanup(func() { common.OptionMap = previous })
}

func TestGetNoticeServesRevalidationHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"Notice": "scheduled maintenance"})

	response := serveOptionRequest(t, GetNotice, "/api/notice", "")

	require.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"success":true,"message":"","data":"scheduled maintenance"}`, response.Body.String())
	assert.Equal(t, "no-cache", response.Header().Get("Cache-Control"))
	// Asserted by substring, not equality: the compression middleware may also
	// contribute a Vary value, and only the presence of Accept-Encoding is the
	// contract here.
	assert.Contains(t, response.Header().Get("Vary"), "Accept-Encoding")
	// Weak validator: /api is compressed after this handler runs, so the served
	// hash cannot claim byte-for-byte equality across encodings.
	assert.Regexp(t, `^W/"[0-9a-f]{64}"$`, response.Header().Get("ETag"))
}

func TestGetNoticeReturnsNotModifiedForMatchingETag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"Notice": "scheduled maintenance"})

	first := serveOptionRequest(t, GetNotice, "/api/notice", "")
	require.Equal(t, http.StatusOK, first.Code)
	etag := first.Header().Get("ETag")
	require.NotEmpty(t, etag)

	second := serveOptionRequest(t, GetNotice, "/api/notice", etag)

	assert.Equal(t, http.StatusNotModified, second.Code)
	assert.Empty(t, second.Body.String())
	assert.Equal(t, etag, second.Header().Get("ETag"))
	assert.Equal(t, "no-cache", second.Header().Get("Cache-Control"))
}

// An admin edit must invalidate the stored copy immediately; that is the whole
// reason for no-cache instead of max-age.
func TestGetNoticeETagChangesWhenNoticeChanges(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"Notice": "old notice"})

	first := serveOptionRequest(t, GetNotice, "/api/notice", "")
	staleETag := first.Header().Get("ETag")
	require.NotEmpty(t, staleETag)

	common.OptionMap["Notice"] = "new notice"

	second := serveOptionRequest(t, GetNotice, "/api/notice", staleETag)

	require.Equal(t, http.StatusOK, second.Code)
	assert.NotEqual(t, staleETag, second.Header().Get("ETag"))
	assert.JSONEq(t, `{"success":true,"message":"","data":"new notice"}`, second.Body.String())
}

func TestGetHomePageContentReturnsNotModifiedForMatchingETag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"HomePageContent": "# Welcome"})

	first := serveOptionRequest(t, GetHomePageContent, "/api/home_page_content", "")
	require.Equal(t, http.StatusOK, first.Code)
	assert.JSONEq(t, `{"success":true,"message":"","data":"# Welcome"}`, first.Body.String())
	etag := first.Header().Get("ETag")
	require.NotEmpty(t, etag)

	second := serveOptionRequest(t, GetHomePageContent, "/api/home_page_content", etag)

	assert.Equal(t, http.StatusNotModified, second.Code)
	assert.Empty(t, second.Body.String())
}

// The validator has to track content, since that is the only thing standing
// between a revalidating client and a stale notice. Note this is not a
// cross-endpoint uniqueness guarantee: both endpoints build the same envelope,
// so identical content on each yields an identical ETag. That is safe only
// because caches key on the request URI first and never on the validator
// alone.
func TestETagTracksContentAcrossEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{
		"Notice":          "notice text",
		"HomePageContent": "home page text",
	})

	notice := serveOptionRequest(t, GetNotice, "/api/notice", "")
	homePage := serveOptionRequest(t, GetHomePageContent, "/api/home_page_content", "")

	require.Equal(t, http.StatusOK, notice.Code)
	require.Equal(t, http.StatusOK, homePage.Code)
	assert.NotEqual(t, notice.Header().Get("ETag"), homePage.Header().Get("ETag"),
		"different content must not share a validator")

	// A cleared option is a content change like any other and must invalidate.
	common.OptionMap["Notice"] = ""
	cleared := serveOptionRequest(t, GetNotice, "/api/notice", notice.Header().Get("ETag"))
	require.Equal(t, http.StatusOK, cleared.Code)
	assert.NotEqual(t, notice.Header().Get("ETag"), cleared.Header().Get("ETag"))
	assert.JSONEq(t, `{"success":true,"message":"","data":""}`, cleared.Body.String())
}

// GetAbout reads OptionMap like the two above; the legal handlers instead read
// a settings struct. Both sources must produce a working validator, so all
// three are driven through the same conditional-GET cycle.
func TestPublicDocumentEndpointsRevalidate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"About": "# About this service"})

	legal := system_setting.GetLegalSettings()
	previousAgreement := legal.UserAgreement
	previousPolicy := legal.PrivacyPolicy
	legal.UserAgreement = "Terms of use."
	legal.PrivacyPolicy = "Privacy notice."
	t.Cleanup(func() {
		legal.UserAgreement = previousAgreement
		legal.PrivacyPolicy = previousPolicy
	})

	cases := []struct {
		name     string
		handler  gin.HandlerFunc
		path     string
		wantBody string
	}{
		{
			name:     "about",
			handler:  GetAbout,
			path:     "/api/about",
			wantBody: `{"success":true,"message":"","data":"# About this service"}`,
		},
		{
			name:     "user agreement",
			handler:  GetUserAgreement,
			path:     "/api/user-agreement",
			wantBody: `{"success":true,"message":"","data":"Terms of use."}`,
		},
		{
			name:     "privacy policy",
			handler:  GetPrivacyPolicy,
			path:     "/api/privacy-policy",
			wantBody: `{"success":true,"message":"","data":"Privacy notice."}`,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			first := serveOptionRequest(t, testCase.handler, testCase.path, "")
			require.Equal(t, http.StatusOK, first.Code)
			assert.JSONEq(t, testCase.wantBody, first.Body.String())
			assert.Equal(t, "no-cache", first.Header().Get("Cache-Control"))
			assert.Contains(t, first.Header().Get("Vary"), "Accept-Encoding")
			etag := first.Header().Get("ETag")
			require.NotEmpty(t, etag)
			assert.Regexp(t, `^W/"[0-9a-f]{64}"$`, etag)

			second := serveOptionRequest(t, testCase.handler, testCase.path, etag)
			assert.Equal(t, http.StatusNotModified, second.Code)
			assert.Empty(t, second.Body.String())
			assert.Equal(t, etag, second.Header().Get("ETag"))
		})
	}
}

// An edit to a legal document must invalidate its validator, same as an
// OptionMap edit does. These are read from a settings struct rather than the
// option map, so the path is worth covering directly.
func TestLegalDocumentETagChangesWhenDocumentChanges(t *testing.T) {
	gin.SetMode(gin.TestMode)

	legal := system_setting.GetLegalSettings()
	previousAgreement := legal.UserAgreement
	legal.UserAgreement = "Version 1."
	t.Cleanup(func() { legal.UserAgreement = previousAgreement })

	first := serveOptionRequest(t, GetUserAgreement, "/api/user-agreement", "")
	staleETag := first.Header().Get("ETag")
	require.NotEmpty(t, staleETag)

	legal.UserAgreement = "Version 2."

	second := serveOptionRequest(t, GetUserAgreement, "/api/user-agreement", staleETag)
	require.Equal(t, http.StatusOK, second.Code)
	assert.NotEqual(t, staleETag, second.Header().Get("ETag"))
	assert.JSONEq(t, `{"success":true,"message":"","data":"Version 2."}`, second.Body.String())
}

// /api is gzip-compressed, so revalidation has to survive the compression
// middleware. Run against a real server rather than httptest.NewRecorder,
// because only net/http enforces the "no body on a 304" rule that the recorder
// ignores -- a recorder-based test here would prove nothing.
func TestRevalidationThroughGzipMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setOptionMap(t, map[string]string{"Notice": "scheduled maintenance"})

	engine := gin.New()
	engine.Use(gzip.Gzip(gzip.DefaultCompression))
	engine.GET("/api/notice", GetNotice)
	server := httptest.NewServer(engine)
	t.Cleanup(server.Close)

	// DisableCompression stops the transport from injecting its own
	// Accept-Encoding and transparently decoding, so the response is visible
	// as a shared cache would see it.
	client := &http.Client{Transport: &http.Transport{DisableCompression: true}}

	firstRequest, err := http.NewRequest(http.MethodGet, server.URL+"/api/notice", nil)
	require.NoError(t, err)
	firstRequest.Header.Set("Accept-Encoding", "gzip")
	firstResponse, err := client.Do(firstRequest)
	require.NoError(t, err)
	defer func() { _ = firstResponse.Body.Close() }()

	require.Equal(t, http.StatusOK, firstResponse.StatusCode)
	etag := firstResponse.Header.Get("ETag")
	require.NotEmpty(t, etag)
	assert.Contains(t, firstResponse.Header.Values("Vary"), "Accept-Encoding")

	secondRequest, err := http.NewRequest(http.MethodGet, server.URL+"/api/notice", nil)
	require.NoError(t, err)
	secondRequest.Header.Set("Accept-Encoding", "gzip")
	secondRequest.Header.Set("If-None-Match", etag)
	secondResponse, err := client.Do(secondRequest)
	require.NoError(t, err)
	defer func() { _ = secondResponse.Body.Close() }()

	require.Equal(t, http.StatusNotModified, secondResponse.StatusCode)
	body, err := io.ReadAll(secondResponse.Body)
	require.NoError(t, err)
	assert.Empty(t, body, "a 304 must not carry a body, compressed or otherwise")
	assert.Equal(t, etag, secondResponse.Header.Get("ETag"))
}

// The served validator is weak, so that is what this table feeds in as the
// second operand. Weak comparison must ignore W/ on both sides: an earlier
// version stripped it only from the client's value, which made a weak served
// validator match nothing and silently disabled every 304.
func TestETagMatches(t *testing.T) {
	const etag = `W/"abc123"`
	cases := []struct {
		name        string
		ifNoneMatch string
		want        bool
	}{
		{name: "empty header", ifNoneMatch: "", want: false},
		{name: "wildcard", ifNoneMatch: "*", want: true},
		{name: "weak candidate against weak etag", ifNoneMatch: `W/"abc123"`, want: true},
		// A cache or proxy may drop the W/ prefix in transit; weak comparison
		// still has to match, or revalidation breaks behind that hop.
		{name: "strong candidate against weak etag", ifNoneMatch: `"abc123"`, want: true},
		{name: "match inside list", ifNoneMatch: `"other", W/"abc123"`, want: true},
		{name: "mixed strength inside list", ifNoneMatch: `W/"other", "abc123"`, want: true},
		{name: "surrounding whitespace", ifNoneMatch: `  W/"abc123"  `, want: true},
		{name: "different tag", ifNoneMatch: `W/"def456"`, want: false},
		{name: "unquoted value", ifNoneMatch: "abc123", want: false},
		{name: "list without match", ifNoneMatch: `"def456", W/"ghi789"`, want: false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want, etagMatches(testCase.ifNoneMatch, etag))
		})
	}
}
