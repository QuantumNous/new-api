package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeHTTPClientOptions_UseGlobalDefaultFingerprint(t *testing.T) {
	proxySetting := system_setting.GetProxySetting()
	original := *proxySetting
	t.Cleanup(func() {
		*proxySetting = original
	})

	proxySetting.DefaultTLSFingerprint = dto.TLSFingerprintChrome
	proxySetting.DefaultTLSCustom = ""

	options, err := normalizeHTTPClientOptions(httpClientOptions{})
	require.NoError(t, err)
	assert.Equal(t, dto.TLSFingerprintChrome, options.TLSFingerprint)
	assert.Empty(t, options.TLSCustom)
}

func TestNormalizeHTTPClientOptions_ChannelSettingOverrideGlobal(t *testing.T) {
	proxySetting := system_setting.GetProxySetting()
	original := *proxySetting
	t.Cleanup(func() {
		*proxySetting = original
	})

	proxySetting.DefaultTLSFingerprint = dto.TLSFingerprintChrome
	proxySetting.DefaultTLSCustom = ""

	options, err := normalizeHTTPClientOptions(httpClientOptions{
		TLSFingerprint: dto.TLSFingerprintFirefox,
	})
	require.NoError(t, err)
	assert.Equal(t, dto.TLSFingerprintFirefox, options.TLSFingerprint)
}

func TestNormalizeHTTPClientOptions_InvalidFingerprint(t *testing.T) {
	_, err := normalizeHTTPClientOptions(httpClientOptions{
		TLSFingerprint: "invalid",
	})
	require.Error(t, err)
}

func TestParseCustomClientHelloSpec_InvalidJSON(t *testing.T) {
	_, err := parseCustomClientHelloSpec("{")
	require.Error(t, err)
}

func TestBuildHTTPClientCacheKey_ContainsCustomHash(t *testing.T) {
	keyA := buildHTTPClientCacheKey(httpClientOptions{
		ProxyURL:       "socks5://127.0.0.1:1080",
		TLSFingerprint: dto.TLSFingerprintCustom,
		TLSCustom:      `{"cipher_suites":[4865],"extensions":[{"name":"server_name"}]}`,
	})
	keyB := buildHTTPClientCacheKey(httpClientOptions{
		ProxyURL:       "socks5://127.0.0.1:1080",
		TLSFingerprint: dto.TLSFingerprintCustom,
		TLSCustom:      `{"cipher_suites":[4866],"extensions":[{"name":"server_name"}]}`,
	})
	assert.NotEqual(t, keyA, keyB)
}
