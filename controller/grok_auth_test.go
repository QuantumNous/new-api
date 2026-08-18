package controller

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/service"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupGrokAuthTestDB 建独立 sqlite 文件库并接管 model.DB。
// 必须用文件库而非 :memory:：UpdateChannelKeyForType/ClaimGrokAuthFlow 走事务，
// gorm 连接池下 :memory: 每个连接各一份库会互相看不见（照 cli_device_authorization_test 模式）。
func setupGrokAuthTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalUsingSQLite := common.UsingSQLite
	common.UsingSQLite = true
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/grok-auth.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.GrokAuthFlow{}, &model.GrokChannelState{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		// Windows 下必须先关连接池，否则 t.TempDir 的 RemoveAll 会被占用中的 db 文件卡死。
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

// setGrokCipherKey 注入确定性的 32 字节 cipher key（照 service/grok_credential_cipher_test 模式；
// env 变量名与 service.grokCredentialCipherEnv 保持一致）。
func setGrokCipherKey(t *testing.T) {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte('a' + i%26)
	}
	t.Setenv("GROK_CREDENTIAL_CIPHER_KEY", base64.StdEncoding.EncodeToString(key))
}

func TestGrokPKCEStartProducesChallenge(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)

	start, err := GrokPKCEStart(42, "https://newapi.example/callback")
	require.NoError(t, err)
	require.NotEmpty(t, start.AuthorizeURL)
	require.NotEmpty(t, start.FlowID)
	require.True(t, strings.Contains(start.AuthorizeURL, "code_challenge="), "authorize url must carry code_challenge")
	require.True(t, strings.Contains(start.AuthorizeURL, "code_challenge_method=S256"), "must use S256")

	u, err := url.Parse(start.AuthorizeURL)
	require.NoError(t, err)
	q := u.Query()
	require.Equal(t, "code", q.Get("response_type"))
	require.Equal(t, groksubscription.OAuthClientID, q.Get("client_id"))
	require.Equal(t, "https://newapi.example/callback", q.Get("redirect_uri"))
	require.Equal(t, groksubscription.OAuthScope, q.Get("scope"))
	require.Equal(t, "S256", q.Get("code_challenge_method"))
	require.NotEmpty(t, q.Get("state"), "state must be set for CSRF protection")
	require.Equal(t, q.Get("state"), start.State, "state must round-trip for callback verification")

	// flow 落库断言：记录存在，Verifier 存的是密文（cipher round-trip 验证），state 存 hash。
	var flow model.GrokAuthFlow
	require.NoError(t, model.DB.Where("flow_id = ?", start.FlowID).First(&flow).Error)
	require.Equal(t, 42, flow.ChannelID)
	require.Equal(t, "https://newapi.example/callback", flow.RedirectURI)
	require.NotEqual(t, start.State, flow.StateHash, "state must be stored as hash, not plaintext")
	sum := sha256.Sum256([]byte(start.State))
	require.Equal(t, hex.EncodeToString(sum[:]), flow.StateHash)
	require.WithinDuration(t, time.Now().Add(10*time.Minute), time.Unix(flow.ExpiresAt, 0), 2*time.Minute)

	cipher, err := service.LoadGrokCredentialCipher()
	require.NoError(t, err)
	verifier, err := cipher.Decrypt(flow.FlowID, "pkce_verifier", flow.EncryptedVerifier)
	require.NoError(t, err)
	require.NotEmpty(t, verifier)
	require.NotContains(t, start.AuthorizeURL, verifier, "verifier must never appear in authorize URL")
	vsum := sha256.Sum256([]byte(verifier))
	require.Equal(t, base64.RawURLEncoding.EncodeToString(vsum[:]), q.Get("code_challenge"), "code_challenge must be S256(verifier)")
}

func TestGrokPKCEStartRejectsInvalidArgs(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	if _, err := GrokPKCEStart(0, "https://newapi.example/callback"); err == nil {
		t.Fatalf("channelID<=0 must be rejected")
	}
	if _, err := GrokPKCEStart(42, ""); err == nil {
		t.Fatalf("empty redirectURI must be rejected")
	}
}

// TestGrokPKCEStartRequiresCipherKey 守护 fail-closed：cipher key 未配置时绝不落库（verifier 无加密手段）。
func TestGrokPKCEStartRequiresCipherKey(t *testing.T) {
	setupGrokAuthTestDB(t)
	t.Setenv("GROK_CREDENTIAL_CIPHER_KEY", "")
	if _, err := GrokPKCEStart(42, "https://newapi.example/callback"); err == nil {
		t.Fatalf("missing cipher key must fail closed")
	}
	var count int64
	require.NoError(t, model.DB.Model(&model.GrokAuthFlow{}).Count(&count).Error)
	require.Zero(t, count, "no flow may be persisted without cipher key")
}
