package modeltraceapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func signedRequest(t *testing.T, method, target string, body []byte, at time.Time, nonce string) *http.Request {
	t.Helper()
	request := httptest.NewRequest(method, target, nil)
	timestamp := strconv.FormatInt(at.Unix(), 10)
	sum := sha256.Sum256(body)
	mac := hmac.New(sha256.New, testKey)
	_, err := mac.Write([]byte(method + "\n" + target + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(sum[:])))
	require.NoError(t, err)
	request.Header.Set("X-ModelTrace-Timestamp", timestamp)
	request.Header.Set("X-ModelTrace-Nonce", nonce)
	request.Header.Set("X-ModelTrace-Signature", hex.EncodeToString(mac.Sum(nil)))
	return request
}

func TestAuthConfiguration(t *testing.T) {
	for _, size := range []int{0, 31} {
		_, err := NewAuth(make([]byte, size), time.Now, 2)
		assert.Error(t, err)
	}
	for _, capacity := range []int{0, -1, 65537} {
		_, err := NewAuth(testKey, time.Now, capacity)
		assert.Error(t, err)
	}
}

func TestAuthBindsEveryComponent(t *testing.T) {
	at := time.Unix(1700000000, 0)
	body := []byte(`{"value":1}`)
	target := "/v1/modeltrace/probes/probe%3A1?model=a%20b&protocol=chat"
	cases := []struct {
		name string
		edit func(*http.Request)
		body []byte
	}{
		{"body", func(*http.Request) {}, []byte(`{"value":2}`)},
		{"method", func(r *http.Request) { r.Method = http.MethodPost }, body},
		{"path", func(r *http.Request) { r.RequestURI = strings.ReplaceAll(target, "%3A", ":") }, body},
		{"query", func(r *http.Request) { r.RequestURI = target + "&extra=1" }, body},
		{"timestamp", func(r *http.Request) { r.Header.Set("X-ModelTrace-Timestamp", "1700000001") }, body},
		{"nonce", func(r *http.Request) { r.Header.Set("X-ModelTrace-Nonce", strings.Repeat("b", 32)) }, body},
		{"signature", func(r *http.Request) { r.Header.Set("X-ModelTrace-Signature", strings.Repeat("0", 64)) }, body},
		{"duplicate_header", func(r *http.Request) { r.Header.Add("X-ModelTrace-Nonce", strings.Repeat("a", 32)) }, body},
		{"invalid_nonce", func(r *http.Request) { r.Header.Set("X-ModelTrace-Nonce", "short") }, body},
		{"nonexact_nonce", func(r *http.Request) { r.Header.Set("X-ModelTrace-Nonce", strings.Repeat("A", 32)) }, body},
		{"oversize_body", func(*http.Request) {}, make([]byte, (256<<10)+1)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			auth, err := NewAuth(testKey, func() time.Time { return at }, 2)
			require.NoError(t, err)
			request := signedRequest(t, http.MethodGet, target, body, at, strings.Repeat("a", 32))
			tc.edit(request)
			assert.Error(t, auth.Authenticate(request, tc.body))
		})
	}
	auth, err := NewAuth(testKey, func() time.Time { return at }, 2)
	require.NoError(t, err)
	assert.NoError(t, auth.Authenticate(signedRequest(t, http.MethodGet, target, body, at, strings.Repeat("a", 32)), body))
}

func TestAuthTimeReplayCapacityAndRegression(t *testing.T) {
	at := time.Unix(1700000000, 0)
	now := at
	auth, err := NewAuth(testKey, func() time.Time { return now }, 1)
	require.NoError(t, err)
	request := signedRequest(t, http.MethodGet, "/x", nil, at, strings.Repeat("a", 32))
	require.NoError(t, auth.Authenticate(request, nil))
	assert.Error(t, auth.Authenticate(request, nil))
	assert.Error(t, auth.Authenticate(signedRequest(t, http.MethodGet, "/x", nil, at, strings.Repeat("b", 32)), nil))
	now = at.Add(60 * time.Second)
	assert.Error(t, auth.Authenticate(request, nil), "inclusive expiry must not evict a still-valid nonce")
	now = at.Add(61 * time.Second)
	assert.NoError(t, auth.Authenticate(signedRequest(t, http.MethodGet, "/x", nil, now, strings.Repeat("b", 32)), nil))
	now = at
	assert.Error(t, auth.Authenticate(request, nil), "clock regression must not permit replay after pruning")
	for _, offset := range []int{-61, 61} {
		fresh, err := NewAuth(testKey, func() time.Time { return at }, 2)
		require.NoError(t, err)
		assert.Error(t, fresh.Authenticate(signedRequest(t, http.MethodGet, "/x", nil, at.Add(time.Duration(offset)*time.Second), strings.Repeat("c", 32)), nil))
	}
	for _, offset := range []int{-60, 60} {
		fresh, err := NewAuth(testKey, func() time.Time { return at }, 2)
		require.NoError(t, err)
		assert.NoError(t, fresh.Authenticate(signedRequest(t, http.MethodGet, "/x", nil, at.Add(time.Duration(offset)*time.Second), strings.Repeat("c", 32)), nil))
	}
}

func TestSignProducesVerifiableHeadersAndRandomNonce(t *testing.T) {
	at := time.Unix(1700000000, 0)
	request := httptest.NewRequest(http.MethodGet, "/x?model=a%20b", nil)
	require.NoError(t, Sign(request, nil, testKey, at, ""))
	assert.Regexp(t, `^[0-9a-f]{32}$`, request.Header.Get("X-ModelTrace-Nonce"))
	assert.Regexp(t, `^[0-9a-f]{64}$`, request.Header.Get("X-ModelTrace-Signature"))
	auth, err := NewAuth(testKey, func() time.Time { return at }, 2)
	require.NoError(t, err)
	assert.NoError(t, auth.Authenticate(request, nil))
	assert.Error(t, Sign(request, nil, []byte("short"), at, ""))
}
