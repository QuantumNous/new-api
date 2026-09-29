package zhipu_4v

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/hkdf"
)

func TestParseZCodeSigningCredential(t *testing.T) {
	t.Parallel()

	valid, ok := parseZCodeSigningCredential(" abc123.SECRET-value ")
	if !ok {
		t.Fatalf("expected credential to parse")
	}
	if valid.apiKeyID != "abc123" || valid.apiKeySecret != "SECRET-value" || valid.raw != "abc123.SECRET-value" {
		t.Fatalf("unexpected credential: %+v", valid)
	}

	for _, invalid := range []string{"", "nodothere", ".leadingdot", "trailingdot.", "a.b.c", "  .  "} {
		if _, ok := parseZCodeSigningCredential(invalid); ok {
			t.Fatalf("credential %q should not parse", invalid)
		}
	}
}

func TestIsZCodeSigningTargetURL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		url  string
		want bool
	}{
		{"https://api.z.ai/api/anthropic/v1/messages", true},
		{"https://open.bigmodel.cn/api/anthropic/v1/messages", true},
		{"https://dev.bigmodel.cn/api/anthropic/v1/messages", true},
		// ZCode 代理路径属免签白名单（zcode.z.ai 后缀命中 .z.ai 家族，需按路径排除）。
		{"https://zcode.z.ai/api/v1/zcode-plan/anthropic/v1/messages", false},
		{"https://zcode.z.ai/api/v1/off-peak/anthropic/v1/messages", false},
		{"https://zcode.z.ai/api/v1/other", false},
		{"http://api.z.ai/api/anthropic/v1/messages", false},
		{"https://api.example.com/v1/messages", false},
		{"https://fake-z.ai.example.com/v1/messages", false},
		{"not a url", false},
	}
	for _, testCase := range cases {
		if got := isZCodeSigningTargetURL(testCase.url); got != testCase.want {
			t.Fatalf("isZCodeSigningTargetURL(%q) = %v, want %v", testCase.url, got, testCase.want)
		}
	}
}

func TestZCodeSigningHasLeadingZeroBits(t *testing.T) {
	t.Parallel()

	if !zcodeSigningHasLeadingZeroBits([]byte{0x00, 0xff}, 8) {
		t.Fatalf("8 zero bits should pass for leading 0x00")
	}
	if zcodeSigningHasLeadingZeroBits([]byte{0x01}, 8) {
		t.Fatalf("0x01 should fail 8 zero bits")
	}
	if !zcodeSigningHasLeadingZeroBits([]byte{0x0f}, 4) {
		t.Fatalf("0x0f should pass 4 zero bits")
	}
	if zcodeSigningHasLeadingZeroBits([]byte{0x1f}, 4) {
		t.Fatalf("0x1f should fail 4 zero bits")
	}
	if !zcodeSigningHasLeadingZeroBits([]byte{0xff}, 0) {
		t.Fatalf("0 bits should always pass")
	}
}

func TestZCodeSigningSolvePowMatchesProtocol(t *testing.T) {
	t.Parallel()

	apiKeyID, sessionID, ts := "keyid", "session-1", "1750000000000"
	candidate, err := zcodeSigningSolvePow(apiKeyID, sessionID, ts, zcodeSigningPowBits)
	if err != nil {
		t.Fatalf("solvePow returned error: %v", err)
	}
	// 形状：24 位随机 hex 前缀 + 8 位小写 hex 计数器。
	if len(candidate) != (zcodeSigningPowPrefixBytes*2 + 8) {
		t.Fatalf("candidate %q has unexpected length", candidate)
	}
	if _, err := hex.DecodeString(candidate); err != nil {
		t.Fatalf("candidate %q is not hex: %v", candidate, err)
	}
	// 独立复算：challenge = hex(sha256(id\napp\nsession\nts))[:32]。
	challengeSum := sha256.Sum256([]byte(apiKeyID + "\n" + zcodeSigningAppID + "\n" + sessionID + "\n" + ts))
	challenge := hex.EncodeToString(challengeSum[:])[:32]
	verifySum := sha256.Sum256([]byte(challenge + "\n" + candidate))
	if !zcodeSigningHasLeadingZeroBits(verifySum[:], zcodeSigningPowBits) {
		t.Fatalf("candidate does not satisfy %d leading zero bits", zcodeSigningPowBits)
	}
}

// buildZCodePrivateCipher 按 ZCode decryptSigningPrivateKey 的逆过程构造握手响应。
func buildZCodePrivateCipher(t *testing.T, apiKeyID, apiKeySecret string, privateKey ed25519.PrivateKey) string {
	t.Helper()

	der, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	plaintext := base64.StdEncoding.EncodeToString(der)

	reader := hkdf.New(sha256.New, []byte(apiKeySecret), []byte(zcodeSigningKDFSalt), []byte(zcodeSigningEd25519Info))
	aesKey := make([]byte, 32)
	if _, err := io.ReadFull(reader, aesKey); err != nil {
		t.Fatalf("derive aes key: %v", err)
	}
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		t.Fatalf("aes cipher: %v", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("gcm: %v", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		t.Fatalf("nonce: %v", err)
	}
	sealed := gcm.Seal(nil, nonce, []byte(plaintext), []byte(apiKeyID))
	return base64.StdEncoding.EncodeToString(append(nonce, sealed...))
}

func TestZCodeSigningPerformHandshakeRoundTrip(t *testing.T) {
	t.Parallel()

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	cred := zcodeSigningCredential{apiKeyID: "kid-1", apiKeySecret: "secret-1", raw: "kid-1.secret-1"}

	var requestedAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != zcodeSigningHandshakeP {
			t.Errorf("unexpected handshake path %q", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method %q", r.Method)
		}
		requestedAuth = r.Header.Get("Authorization")

		body, _ := io.ReadAll(r.Body)
		var payload struct {
			APIKey string `json:"apiKey"`
			Nonce  string `json:"nonce"`
			Sig    string `json:"sig"`
			Ts     string `json:"ts"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Errorf("invalid handshake body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if payload.APIKey != cred.raw {
			t.Errorf("apiKey = %q, want %q", payload.APIKey, cred.raw)
		}
		if len(payload.Nonce) != zcodeSigningNonceBytes*2 {
			t.Errorf("nonce %q has unexpected length", payload.Nonce)
		}
		// 服务端复算 HMAC：key = HKDF(secret, info=getSignKey_hmac)。
		reader := hkdf.New(sha256.New, []byte(cred.apiKeySecret), []byte(zcodeSigningKDFSalt), []byte(zcodeSigningHMACKeyInfo))
		hmacKey := make([]byte, 32)
		if _, err := io.ReadFull(reader, hmacKey); err != nil {
			t.Errorf("derive hmac key: %v", err)
		}
		mac := hmac.New(sha256.New, hmacKey)
		mac.Write([]byte(zcodeSigningHandshakeOp + "\n" + cred.apiKeyID + "\n" + payload.Ts + "\n" + payload.Nonce))
		wantSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
		if payload.Sig != wantSig {
			t.Errorf("handshake sig mismatch")
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"code":200,"msg":"","data":{"privateCipher":%q}}`,
			buildZCodePrivateCipher(t, cred.apiKeyID, cred.apiKeySecret, priv))
	}))
	defer server.Close()

	got, err := zcodeSigningPerformHandshake("", server.URL, cred)
	if err != nil {
		t.Fatalf("handshake returned error: %v", err)
	}
	if requestedAuth != cred.raw {
		t.Fatalf("Authorization = %q, want raw credential", requestedAuth)
	}
	if !got.Equal(priv) {
		t.Fatalf("handshake private key mismatch")
	}
	// 解出的私钥可产生可被公钥验证的签名。
	message := "kid-1\n1750000000000\n" + zcodeClientVersion + "\nsession\nnonce"
	if !ed25519.Verify(pub, []byte(message), ed25519.Sign(got, []byte(message))) {
		t.Fatalf("signature from handshake key failed verification")
	}
}

func TestZCodeSigningPerformHandshakeRejectsBusinessError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"code":403,"msg":"HANDSHAKE_APIKEY_REVOKED"}`)
	}))
	defer server.Close()

	cred := zcodeSigningCredential{apiKeyID: "kid-2", apiKeySecret: "secret-2", raw: "kid-2.secret-2"}
	if _, err := zcodeSigningPerformHandshake("", server.URL, cred); err == nil {
		t.Fatalf("expected error for business rejection")
	} else if !strings.Contains(err.Error(), "HANDSHAKE_APIKEY_REVOKED") {
		t.Fatalf("error %v should carry handshake reason", err)
	}
}

func newZCodeSigningTestInfo(baseURL, apiKey string, zcodeMode bool) *relaycommon.RelayInfo {
	// 签名路径只在渠道显式开启时可用，且依赖旧版形态的 x-session-id。
	legacyTrace := true
	signing := true
	return &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    baseURL,
			ApiKey:            apiKey,
			UpstreamModelName: "glm-5.3-flash",
			ChannelSetting: dto.ChannelSettings{
				ZcodeModeEnabled:          zcodeMode,
				ZcodeLegacyTraceHeaders:   &legacyTrace,
				ZcodeClientSigningEnabled: &signing,
			},
		},
	}
}

func TestApplyZCodeClientSigningSetsVerifiableHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	cred := zcodeSigningCredential{apiKeyID: "kid-sign", apiKeySecret: "secret-sign", raw: "kid-sign.secret-sign"}
	origin := "https://api.z.ai"
	// 预置握手缓存，隔离网络。
	state := zcodeSigningStateFor(cred.apiKeyID, origin)
	state.key = priv
	state.expiresAt = time.Now().Add(time.Hour)

	headers := make(http.Header)
	info := newZCodeSigningTestInfo("glm-coding-plan-international", cred.raw, true)
	setupZCodeTraceHeaders(&headers, true)
	applyZCodeClientSigning(c, &headers, info, origin+"/api/anthropic/v1/messages")

	sessionID := headers.Get("X-Session-Id")
	if sessionID == "" {
		t.Fatalf("X-Session-Id missing")
	}
	ts := headers.Get("X-Client-Ts")
	if _, err := strconv.ParseInt(ts, 10, 64); err != nil || ts == "" {
		t.Fatalf("X-Client-Ts = %q is not a millisecond timestamp", ts)
	}
	if headers.Get("X-Client-Version") != zcodeClientVersion {
		t.Fatalf("X-Client-Version = %q", headers.Get("X-Client-Version"))
	}
	if headers.Get("X-App-Id") != zcodeSigningAppID {
		t.Fatalf("X-App-Id = %q", headers.Get("X-App-Id"))
	}
	nonce := headers.Get("X-Client-Nonce")
	if len(nonce) != zcodeSigningNonceBytes*2 {
		t.Fatalf("X-Client-Nonce = %q has unexpected length", nonce)
	}
	signature, err := base64.StdEncoding.DecodeString(headers.Get("X-Client-Sig"))
	if err != nil {
		t.Fatalf("X-Client-Sig is not base64: %v", err)
	}
	message := cred.apiKeyID + "\n" + ts + "\n" + zcodeClientVersion + "\n" + sessionID + "\n" + nonce
	if !ed25519.Verify(pub, []byte(message), signature) {
		t.Fatalf("X-Client-Sig failed verification")
	}
	pow := headers.Get("X-Client-Pow")
	challengeSum := sha256.Sum256([]byte(cred.apiKeyID + "\n" + zcodeSigningAppID + "\n" + sessionID + "\n" + ts))
	challenge := hex.EncodeToString(challengeSum[:])[:32]
	powSum := sha256.Sum256([]byte(challenge + "\n" + pow))
	if !zcodeSigningHasLeadingZeroBits(powSum[:], zcodeSigningPowBits) {
		t.Fatalf("X-Client-Pow %q does not satisfy difficulty", pow)
	}
}

func TestApplyZCodeClientSigningSkipsNonTargetAndBadKey(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	cases := []struct {
		name     string
		info     *relaycommon.RelayInfo
		finalURL string
	}{
		{
			name:     "start plan proxy is unsigned",
			info:     newZCodeSigningTestInfo("zcode-start-plan", "jwt.token.value", true),
			finalURL: "https://zcode.z.ai/api/v1/zcode-plan/anthropic/v1/messages",
		},
		{
			name:     "zcode mode off",
			info:     newZCodeSigningTestInfo("glm-coding-plan-international", "kid.secret", false),
			finalURL: "https://api.z.ai/api/anthropic/v1/messages",
		},
		{
			name:     "key without secret part",
			info:     newZCodeSigningTestInfo("glm-coding-plan-international", "plain-jwt-token", true),
			finalURL: "https://api.z.ai/api/anthropic/v1/messages",
		},
	}
	for _, testCase := range cases {
		headers := make(http.Header)
		setupZCodeTraceHeaders(&headers, true)
		applyZCodeClientSigning(c, &headers, testCase.info, testCase.finalURL)
		if headers.Get("X-Client-Sig") != "" {
			t.Fatalf("%s: X-Client-Sig should not be set", testCase.name)
		}
	}
}

func TestMaybeInvalidateZCodeSigningKeyOn401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	cred := zcodeSigningCredential{apiKeyID: "kid-401", apiKeySecret: "secret-401", raw: "kid-401.secret-401"}
	origin := "https://api.z.ai"
	state := zcodeSigningStateFor(cred.apiKeyID, origin)
	state.key = ed25519.NewKeyFromSeed(make([]byte, ed25519.SeedSize))
	state.expiresAt = time.Now().Add(time.Hour)

	info := newZCodeSigningTestInfo("glm-coding-plan-international", cred.raw, true)
	resp := &http.Response{
		StatusCode: http.StatusUnauthorized,
		Body:       io.NopCloser(strings.NewReader(`{"code":401,"msg":"VERIFY_SIGNATURE_INVALID"}`)),
	}
	maybeInvalidateZCodeSigningKey(c, info, origin+"/api/anthropic/v1/messages", resp)

	state.mu.Lock()
	defer state.mu.Unlock()
	if state.key != nil {
		t.Fatalf("signing key should be invalidated")
	}
	// 响应体必须原位回放，供下游错误处理继续读取。
	body, err := io.ReadAll(resp.Body)
	if err != nil || !strings.Contains(string(body), "VERIFY_SIGNATURE_INVALID") {
		t.Fatalf("response body was not restored: %q err=%v", string(body), err)
	}
}

func TestMaybeInvalidateKeepsKeyOnUnrelated401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	cred := zcodeSigningCredential{apiKeyID: "kid-keep", apiKeySecret: "secret-keep", raw: "kid-keep.secret-keep"}
	origin := "https://open.bigmodel.cn"
	state := zcodeSigningStateFor(cred.apiKeyID, origin)
	state.key = ed25519.NewKeyFromSeed(make([]byte, ed25519.SeedSize))
	state.expiresAt = time.Now().Add(time.Hour)

	info := newZCodeSigningTestInfo("glm-coding-plan", cred.raw, true)
	resp := &http.Response{
		StatusCode: http.StatusUnauthorized,
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"invalid api key"}}`)),
	}
	maybeInvalidateZCodeSigningKey(c, info, origin+"/api/anthropic/v1/messages", resp)

	state.mu.Lock()
	defer state.mu.Unlock()
	if state.key == nil {
		t.Fatalf("signing key should be kept for unrelated 401")
	}
}

func TestGetRequestURLAndAuthForStartPlan(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := newZCodeSigningTestInfo("zcode-start-plan", "zcode-jwt-token", false)
	adaptor := &Adaptor{}

	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	if want := "https://zcode.z.ai/api/v1/zcode-plan/anthropic/v1/messages"; got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}

	headers := make(http.Header)
	if err := adaptor.SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("Authorization") != "Bearer zcode-jwt-token" {
		t.Fatalf("Authorization = %q, want Bearer JWT", headers.Get("Authorization"))
	}
	if headers.Get("x-api-key") != "" {
		t.Fatalf("x-api-key should not be set for start plan")
	}
	// 非 ZCode 模式的 Coding Plan 家族默认注入 tracing 头。
	if headers.Get("x-session-id") == "" {
		t.Fatalf("trace headers missing for start plan")
	}
	if headers.Get("X-Client-Sig") != "" {
		t.Fatalf("start plan must not carry V4 signing headers")
	}
}

func TestIsZhipuStartPlanBase(t *testing.T) {
	t.Parallel()

	cases := map[string]bool{
		"zcode-start-plan":                                           true,
		" zcode-start-plan/ ":                                        true,
		"https://zcode.z.ai/api/v1/zcode-plan/anthropic":             true,
		"https://zcode.z.ai/api/v1/zcode-plan/anthropic/v1/messages": true,
		"glm-coding-plan":                                            false,
		"glm-coding-plan-international":                              false,
		"https://api.z.ai/api/anthropic":                             false,
		"https://zcode.z.ai/other":                                   false,
		"":                                                           false,
	}
	for baseURL, want := range cases {
		if got := isZhipuStartPlanBase(baseURL); got != want {
			t.Fatalf("isZhipuStartPlanBase(%q) = %v, want %v", baseURL, got, want)
		}
	}
}

func TestZCodeClientSigningDefaultsOnForPlan(t *testing.T) {
	t.Parallel()

	// 套餐默认签名：未显式配置（nil）即开启。
	enabled := zcodeClientSigningEnabled(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelSetting: dto.ChannelSettings{}},
	})
	if !enabled {
		t.Fatalf("套餐渠道默认应开启 V4 签名")
	}
	// 显式 false 才关闭。
	off := false
	disabled := zcodeClientSigningEnabled(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{ZcodeClientSigningEnabled: &off},
		},
	})
	if disabled {
		t.Fatalf("显式 false 应关闭 V4 签名")
	}
	// 显式 true 也开启。
	on := true
	if !zcodeClientSigningEnabled(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{ZcodeClientSigningEnabled: &on},
		},
	}) {
		t.Fatalf("显式 true 应开启 V4 签名")
	}
}

func TestZCodeSessionIdPresentWhenSigningEnabled(t *testing.T) {
	t.Parallel()

	headers := make(http.Header)
	// 关闭旧版追踪头，只靠签名驱动 x-session-id。
	info := newZCodeSigningTestInfo("glm-coding-plan", "plain-jwt-token", true)
	legacyOff := false
	info.ChannelSetting.ZcodeLegacyTraceHeaders = &legacyOff
	setupZCodeCompatibilityHeaders(&headers, info)
	if headers.Get("x-session-id") == "" {
		t.Fatalf("签名开启时 x-session-id 必须存在，否则签名会静默跳过")
	}
	if headers.Get("x-zcode-session-type") != "" {
		t.Fatalf("旧版追踪头关闭时不应带 x-zcode-session-type")
	}
	// 稳定派生：同一渠道同令牌两次一致。
	headers2 := make(http.Header)
	setupZCodeCompatibilityHeaders(&headers2, newZCodeSigningTestInfo("glm-coding-plan", "plain-jwt-token", true))
	if headers2.Get("x-session-id") != headers.Get("x-session-id") {
		t.Fatalf("x-session-id 应稳定: %q vs %q", headers.Get("x-session-id"), headers2.Get("x-session-id"))
	}
}
