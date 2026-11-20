package service

import (
	"bytes"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func setupImageProxyTest(t *testing.T) {
	t.Helper()
	previousSecret := common.CryptoSecret
	previousPublicAddress := system_setting.TaskPublicAddress
	previousServerAddress := system_setting.ServerAddress
	common.CryptoSecret = "image-proxy-test-secret"
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	system_setting.TaskPublicAddress = "https://images.example/gateway/"
	system_setting.ServerAddress = "https://fallback.example"
	t.Cleanup(func() {
		common.CryptoSecret = previousSecret
		system_setting.TaskPublicAddress = previousPublicAddress
		system_setting.ServerAddress = previousServerAddress
	})
}

func imageProxyTokenForTest(t *testing.T, rawURL string) string {
	t.Helper()
	proxyURL, err := BuildImageProxyURL(rawURL, 37)
	require.NoError(t, err)
	parsed, err := url.Parse(proxyURL)
	require.NoError(t, err)
	return parsed.Query().Get("token")
}

func TestImageProxyCapabilityRoundTrip(t *testing.T) {
	setupImageProxyTest(t)
	rawURL := "https://upstream.example/private/image.png?signature=provider-secret&expires=123"
	token := imageProxyTokenForTest(t, rawURL)
	target, err := ReadImageProxyToken(token)
	require.NoError(t, err)
	assert.Equal(t, &ImageProxyTarget{URL: rawURL, ChannelID: 37}, target)
	assert.NotEqual(t, token, imageProxyTokenForTest(t, rawURL))

	ciphertext, err := base64.RawURLEncoding.Strict().DecodeString(token)
	require.NoError(t, err)
	for _, plaintext := range []string{rawURL, "upstream.example", "provider-secret", `"channel_id":37`} {
		assert.False(t, bytes.Contains(ciphertext, []byte(plaintext)))
		assert.NotContains(t, token, plaintext)
	}
}

func TestImageProxyCapabilityRejectsTamperingAndWrongSecret(t *testing.T) {
	setupImageProxyTest(t)
	token := imageProxyTokenForTest(t, "https://upstream.example/image.png")
	ciphertext, err := base64.RawURLEncoding.DecodeString(token)
	require.NoError(t, err)
	for _, position := range []int{0, len(ciphertext) / 2, len(ciphertext) - 1} {
		altered := bytes.Clone(ciphertext)
		altered[position] ^= 1
		target, err := ReadImageProxyToken(base64.RawURLEncoding.EncodeToString(altered))
		assert.Nil(t, target)
		assert.ErrorIs(t, err, ErrImageProxyInvalid)
	}
	for _, invalid := range []string{"", "not.a.token", token + "=", token + "\n", token[:len(token)-1], strings.Repeat("a", 200000)} {
		target, err := ReadImageProxyToken(invalid)
		assert.Nil(t, target)
		assert.ErrorIs(t, err, ErrImageProxyInvalid)
	}

	common.CryptoSecret = "different-node-secret"
	_, err = ReadImageProxyToken(token)
	assert.ErrorIs(t, err, ErrImageProxyInvalid)
	common.CryptoSecret = ""
	_, err = ReadImageProxyToken(token)
	assert.ErrorIs(t, err, ErrImageProxyInvalid)
	_, err = BuildImageProxyURL("https://upstream.example/image.png", 37)
	assert.ErrorIs(t, err, ErrImageProxySecretRequired)
}

func TestImageProxyCapabilityDoesNotExpire(t *testing.T) {
	setupImageProxyTest(t)
	synctest.Test(t, func(t *testing.T) {
		const rawURL = "https://upstream.example/image.png"
		token := imageProxyTokenForTest(t, rawURL)
		time.Sleep(2 * time.Hour)
		target, err := ReadImageProxyToken(token)
		require.NoError(t, err)
		assert.Equal(t, &ImageProxyTarget{URL: rawURL, ChannelID: 37}, target)
	})
}

func TestBuildImageProxyURLRejectsInvalidTargets(t *testing.T) {
	setupImageProxyTest(t)
	for _, rawURL := range []string{
		"", "/image.png", "//upstream.example/image.png", "file:///tmp/image.png", "data:image/png;base64,YQ==",
		"ftp://upstream.example/image.png", "https://user:secret@upstream.example/image.png",
		"https://upstream.example/image.png#fragment", "https://upstream.example/image.png#",
		" https://upstream.example/image.png", "https://upstream.example/image.png ",
		"https://:443/image.png", "https://upstream.example:0/image.png", "https://upstream.example:65536/image.png",
		"https://upstream.example:/image.png", "https://upstream.example:invalid/image.png",
	} {
		t.Run(rawURL, func(t *testing.T) {
			_, err := BuildImageProxyURL(rawURL, 37)
			assert.ErrorIs(t, err, ErrImageProxyInvalid)
			if err != nil && rawURL != "" {
				assert.NotContains(t, err.Error(), rawURL)
			}
		})
	}
	for _, channelID := range []int{0, -1} {
		_, err := BuildImageProxyURL("https://upstream.example/image.png", channelID)
		assert.ErrorIs(t, err, ErrImageProxyInvalid)
	}
}

func TestBuildImageProxyURLUsesConfiguredSiteAddress(t *testing.T) {
	setupImageProxyTest(t)
	for _, test := range []struct {
		name, publicAddress, serverAddress, want string
	}{
		{"public address", "https://media.example/prefix/", "https://fallback.example", "https://media.example/prefix/v1/images/proxy"},
		{"server fallback", "", "https://fallback.example/root", "https://fallback.example/root/v1/images/proxy"},
		{"escaped prefix", "https://media.example/tenant%20one/", "", "https://media.example/tenant%20one/v1/images/proxy"},
	} {
		t.Run(test.name, func(t *testing.T) {
			system_setting.TaskPublicAddress = test.publicAddress
			system_setting.ServerAddress = test.serverAddress
			proxyURL, err := BuildImageProxyURL("https://upstream.example/image.png?key=hidden", 37)
			require.NoError(t, err)
			parsed, err := url.Parse(proxyURL)
			require.NoError(t, err)
			assert.Len(t, parsed.Query(), 1)
			assert.NotEmpty(t, parsed.Query().Get("token"))
			assert.NotContains(t, proxyURL, "upstream.example")
			parsed.RawQuery = ""
			assert.Equal(t, test.want, parsed.String())
		})
	}
	for _, address := range []string{"", "/relative", "ftp://site.example", "https://user:secret@site.example", "https://site.example?key=value", "https://site.example#fragment", "not-a-url"} {
		system_setting.TaskPublicAddress = address
		system_setting.ServerAddress = ""
		_, err := BuildImageProxyURL("https://upstream.example/image.png", 37)
		assert.EqualError(t, err, "image proxy base URL is invalid")
	}
	system_setting.TaskPublicAddress = "not-a-url"
	system_setting.ServerAddress = "https://valid-fallback.example"
	_, err := BuildImageProxyURL("https://upstream.example/image.png", 37)
	assert.EqualError(t, err, "image proxy base URL is invalid")
}

func TestRewriteImageURLsLeavesDisabledAndUnrelatedResponsesUntouched(t *testing.T) {
	for _, test := range []struct {
		path    string
		enabled bool
	}{
		{"/v1/images/generations", false},
		{"/v1/images/edits", false},
		{"/v1/chat/completions", true},
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, test.path, nil)
		c.Set(string(constant.ContextKeyChannelSetting), dto.ChannelSettings{ImageURLProxy: test.enabled})
		body := []byte("{\n  \"data\": [{\"url\":\"https://upstream.example/image.png\"}], \"extra\": 123 }")
		rewritten, err := RewriteImageURLs(c, body)
		require.NoError(t, err)
		assert.Equal(t, body, rewritten)
	}
}

func TestRewriteImageURLsPreservesEnvelopeAndBase64(t *testing.T) {
	setupImageProxyTest(t)
	for _, test := range []struct {
		name, path, body string
		paths            []string
	}{
		{"standard array", "/v1/images/generations", `{"created":123,"data":[{"url":"https://upstream.example/one.png","b64_json":"kept","extra":{"seed":7}},{"url":"https://upstream.example/two.png"}],"unknown":{"nested":true}}`, []string{"data.0.url", "data.1.url"}},
		{"object response", "/v1/images/edits", `{"data":{"url":"https://upstream.example/image.png","revised_prompt":"kept"},"vendor_field":"kept"}`, []string{"data.url"}},
		{"stream event", "/v1/images/generations", `{"type":"image_generation.completed","url":"https://upstream.example/image.png","partial_image_b64":"kept"}`, []string{"url"}},
		{"base64 only", "/v1/images/edits", `{"data":[{"b64_json":"kept"},{"url":"data:image/png;base64,YQ=="}],"other":true}`, nil},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, test.path, nil)
			c.Set(string(constant.ContextKeyChannelSetting), dto.ChannelSettings{ImageURLProxy: true})
			c.Set(string(constant.ContextKeyChannelId), 37)
			rewritten, err := RewriteImageURLs(c, []byte(test.body))
			require.NoError(t, err)
			for _, responsePath := range test.paths {
				proxyURL, err := url.Parse(gjson.GetBytes(rewritten, responsePath).String())
				require.NoError(t, err)
				target, err := ReadImageProxyToken(proxyURL.Query().Get("token"))
				require.NoError(t, err)
				assert.Equal(t, gjson.Get(test.body, responsePath).String(), target.URL)
				assert.Equal(t, 37, target.ChannelID)
				rewritten, err = sjson.SetBytes(rewritten, responsePath, target.URL)
				require.NoError(t, err)
			}
			assert.JSONEq(t, test.body, string(rewritten))
			if len(test.paths) == 0 {
				assert.Equal(t, test.body, string(rewritten))
			}
		})
	}
}

func TestImageProxyCapabilityAcceptsUpstreamImageProxyURLs(t *testing.T) {
	setupImageProxyTest(t)
	rawURL := "https://upstream.example/prefix/v1/images/proxy?token=upstream-capability"
	token := imageProxyTokenForTest(t, rawURL)
	target, err := ReadImageProxyToken(token)
	require.NoError(t, err)
	assert.Equal(t, rawURL, target.URL)
}
