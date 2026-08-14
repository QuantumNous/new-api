package config

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validConfig(t *testing.T) Config {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privatePath := filepath.Join(t.TempDir(), "merchant-private.pem")
	publicPath := filepath.Join(t.TempDir(), "wechat-public.pem")
	privateBytes, err := x509.MarshalPKCS8PrivateKey(privateKey)
	require.NoError(t, err)
	publicBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(privatePath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateBytes}), 0o600))
	require.NoError(t, os.WriteFile(publicPath, pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicBytes}), 0o600))

	return Config{
		DatabaseType: "sqlite", DatabaseDSN: "adapter.db", ListenAddr: ":8080",
		PublicBaseURL: "https://pay.example.com", EpayPartnerID: "10001", EpayKey: "epay-secret",
		NewAPINotifyURL: "https://api.example.com/api/user/epay/notify", ReturnURLAllowlist: "https://api.example.com/",
		MaxOrderAmountYuan: "5000.00", WechatAppID: "wx-app", WechatMerchantID: "mch-id",
		WechatCertSerial: "serial", WechatPrivateKey: privatePath, WechatAPIV3Key: "12345678901234567890123456789012",
		WechatNotifyURL: "https://pay.example.com/api/v1/wechat/notify", WechatVerifyMode: VerifyModePublicKey,
		WechatPublicKeyID: "pub-key-id", WechatPublicKeyFile: publicPath,
		AdminAPIToken: "12345678901234567890123456789012", MetricsAPIToken: "abcdefghijabcdefghijabcdefghijab",
		NotificationWorkers: 2, LogLevel: "info",
	}
}

func TestConfigValidateAcceptsCompletePublicKeyConfiguration(t *testing.T) {
	assert.NoError(t, validConfig(t).Validate())
}

func TestConfigValidateRejectsUnsafeOrWeakConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Config)
	}{
		{name: "unsupported database", mutate: func(c *Config) { c.DatabaseType = "oracle" }},
		{name: "missing merchant ID", mutate: func(c *Config) { c.WechatMerchantID = "" }},
		{name: "insecure public URL", mutate: func(c *Config) { c.PublicBaseURL = "http://pay.example.com" }},
		{name: "invalid amount", mutate: func(c *Config) { c.MaxOrderAmountYuan = "0" }},
		{name: "wrong verification mode", mutate: func(c *Config) { c.WechatVerifyMode = "platform_certificate" }},
		{name: "invalid API v3 key length", mutate: func(c *Config) { c.WechatAPIV3Key = "short" }},
		{name: "short admin token", mutate: func(c *Config) { c.AdminAPIToken = "short" }},
		{name: "bad trusted proxy CIDR", mutate: func(c *Config) { c.TrustedProxyCIDRs = []string{"not-a-cidr"} }},
		{name: "partial previous key rotation material", mutate: func(c *Config) { c.WechatPreviousPublicKeyID = "previous-key" }},
		{name: "duplicate previous key ID", mutate: func(c *Config) {
			c.WechatPreviousPublicKeyID = c.WechatPublicKeyID
			c.WechatPreviousPublicKeyFile = c.WechatPublicKeyFile
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			config := validConfig(t)
			test.mutate(&config)
			assert.Error(t, config.Validate())
		})
	}
}

func TestConfigValidateAcceptsPreviousPublicKeyDuringRotation(t *testing.T) {
	config := validConfig(t)
	config.WechatPreviousPublicKeyID = "previous-pub-key-id"
	config.WechatPreviousPublicKeyFile = config.WechatPublicKeyFile
	assert.NoError(t, config.Validate())
}
