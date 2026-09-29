package zhipu_4v

// ZCode 客户端请求签名 V4（Client Request Signing V4）的 Go 实现。
// 算法逐字段对齐 ZCode Desktop 3.11.2 反编译产物（out/host/chunk-RWMCBKS2.js
// 中 ClientRequestSigningV4Signer / createHandshakeSignature /
// decryptSigningPrivateKey / createClientRequestProofOfWork）：
//
//  1. 渠道密钥即签名凭据，格式 apiKeyId.apiKeySecret（BigModel 密钥原生形态）；
//  2. 握手：POST {origin}/api/paas/c1f3a7e2/v2/client，
//     sig = base64(HMAC-SHA256(HKDF(secret, salt=WD_CLIENT_SIGN_KDF_SALT,
//     info=getSignKey_hmac), "get_sign_key\n{apiKeyId}\n{ts}\n{nonce}"))，
//     响应 data.privateCipher 用 HKDF(info=ed25519_priv) 的 AES-256-GCM 解密
//     （iv=前 12 字节，AAD=apiKeyId，密文尾部 16 字节 tag），明文为
//     base64(PKCS8 Ed25519 私钥)；
//  3. 每请求：X-Client-Sig = base64(Ed25519(
//     "{apiKeyId}\n{ts}\n{clientVersion}\n{sessionId}\n{nonce}"))，
//     X-Client-Pow 为 hashcash 式工作量证明（sha256 前 8 个零比特）；
//  4. 401 响应携带 VERIFY_SIGNATURE_INVALID / VERIFY_APIKEY_EXPIRED 时作废
//     缓存私钥触发重握手；握手或签名失败一律 fail-open 裸发（与 ZCode 一致）。
//
// 仅对 ZCode 模式下发往智谱业务域（api.z.ai / *.bigmodel.cn）的请求生效；
// zcode.z.ai 的 zcode-plan / off-peak 代理路径在 ZCode 客户端即属免签白名单。
//
// 版本现状：官方 3.14.3 客户端解包产物里已不存在 X-Client-Sig / X-Client-Pow /
// X-Client-Nonce / X-Client-Version、握手路径与 KDF 常量；但上游仍按验签发放套餐
// 权益，因此对套餐渠道默认保持签名，渠道可显式关闭。

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/hkdf"
)

const (
	zcodeSigningAppID       = "zcode"
	zcodeSigningHandshakeP  = "/api/paas/c1f3a7e2/v2/client"
	zcodeSigningKDFSalt     = "WD_CLIENT_SIGN_KDF_SALT"
	zcodeSigningHMACKeyInfo = "getSignKey_hmac"
	zcodeSigningHandshakeOp = "get_sign_key"
	zcodeSigningEd25519Info = "ed25519_priv"
	// ZCode 固定 powBits=8（Xw=8）；协议允许 0..32。
	zcodeSigningPowBits        = 8
	zcodeSigningNonceBytes     = 16
	zcodeSigningPowPrefixBytes = 12
	zcodeSigningPowMaxCounter  = 1<<32 - 1

	zcodeSigningHandshakeTimeout = 10 * time.Second
	// ZCode 缓存私钥直至 401 作废；此处附加 TTL 作为密钥轮换兜底。
	zcodeSigningKeyTTL = 6 * time.Hour

	zcodeSigningRespBodyLimit = 64 * 1024
)

// ZCode 客户端免签路径（isUnsignedModelRequestPath 白名单），命中即不签名。
var zcodeSigningUnsignedPathPrefixes = []string{
	"/api/v1/zcode-plan/",
	"/api/v1/off-peak/",
}

// 服务端验签失败错误码：命中即作废缓存私钥，下次请求重握手。
var zcodeSigningRefreshableReasons = []string{
	"VERIFY_SIGNATURE_INVALID",
	"VERIFY_APIKEY_EXPIRED",
}

type zcodeSigningCredential struct {
	apiKeyID     string
	apiKeySecret string
	raw          string
}

// parseZCodeSigningCredential 解析 apiKeyId.apiKeySecret 形态的签名凭据。
// 与 ZCode parseClientSigningCredential 一致：有且仅有一个 "."，两侧非空。
func parseZCodeSigningCredential(key string) (zcodeSigningCredential, bool) {
	trimmed := strings.TrimSpace(key)
	idx := strings.Index(trimmed, ".")
	if idx <= 0 || idx != strings.LastIndex(trimmed, ".") {
		return zcodeSigningCredential{}, false
	}
	id := strings.TrimSpace(trimmed[:idx])
	secret := strings.TrimSpace(trimmed[idx+1:])
	if id == "" || secret == "" {
		return zcodeSigningCredential{}, false
	}
	return zcodeSigningCredential{apiKeyID: id, apiKeySecret: secret, raw: trimmed}, true
}

// isZCodeSigningTargetURL 判定最终上游 URL 是否需要 V4 签名：
// https + 智谱业务域 + 非免签路径。业务域对齐 ZCode 的 family 精确列表
// （api.z.ai / bigmodel.cn 家族）；zcode.z.ai 为 StartPlan 代理 origin，
// 不提供握手端点，必须排除（免签路径规则再作一层防御）。
func isZCodeSigningTargetURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	family := host == "api.z.ai" ||
		host == "bigmodel.cn" || strings.HasSuffix(host, ".bigmodel.cn")
	if !family {
		return false
	}
	path := parsed.EscapedPath()
	for _, prefix := range zcodeSigningUnsignedPathPrefixes {
		if strings.HasPrefix(path, prefix) {
			return false
		}
	}
	return true
}

func zcodeSigningRandomHex(n int) string {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand 失败属系统级异常；返回定长 0 填充保持协议形状。
		return strings.Repeat("0", n*2)
	}
	return hex.EncodeToString(buf)
}

func zcodeSigningDeriveBytes(ikm, info string) ([]byte, error) {
	reader := hkdf.New(sha256.New, []byte(ikm), []byte(zcodeSigningKDFSalt), []byte(info))
	out := make([]byte, 32)
	if _, err := io.ReadFull(reader, out); err != nil {
		return nil, err
	}
	return out, nil
}

func zcodeSigningBase64(raw []byte) string {
	return base64.StdEncoding.EncodeToString(raw)
}

// zcodeSigningSolvePow 复现 createClientRequestProofOfWork：
// challenge = hex(sha256("{apiKeyId}\n{appId}\n{sessionId}\n{ts}"))[:32]，
// candidate = randomHex(12) + 计数器 8 位小写 hex，
// 求 sha256("{challenge}\n{candidate}") 前 powBits 个零比特。
func zcodeSigningSolvePow(apiKeyID, sessionID, ts string, powBits int) (string, error) {
	if powBits < 0 || powBits > 32 {
		return "", fmt.Errorf("zcode signing: powBits %d out of range", powBits)
	}
	challengeSum := sha256.Sum256([]byte(apiKeyID + "\n" + zcodeSigningAppID + "\n" + sessionID + "\n" + ts))
	challenge := hex.EncodeToString(challengeSum[:])[:32]
	prefix := zcodeSigningRandomHex(zcodeSigningPowPrefixBytes)
	for counter := 0; counter <= zcodeSigningPowMaxCounter; counter++ {
		candidate := prefix + fmt.Sprintf("%08x", counter)
		sum := sha256.Sum256([]byte(challenge + "\n" + candidate))
		if zcodeSigningHasLeadingZeroBits(sum[:], powBits) {
			return candidate, nil
		}
	}
	return "", errors.New("zcode signing: unable to solve client request proof of work")
}

func zcodeSigningHasLeadingZeroBits(hash []byte, bits int) bool {
	fullBytes := bits / 8
	for i := 0; i < fullBytes; i++ {
		if i >= len(hash) || hash[i] != 0 {
			return false
		}
	}
	remainder := bits % 8
	if remainder == 0 {
		return true
	}
	if fullBytes >= len(hash) {
		return false
	}
	mask := byte(0xFF) << (8 - remainder)
	return hash[fullBytes]&mask == 0
}

type zcodeSigningHandshakeEnvelope struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		PrivateCipher string `json:"privateCipher"`
	} `json:"data"`
}

// zcodeSigningPerformHandshake 向业务域换取请求签名用 Ed25519 私钥。
func zcodeSigningPerformHandshake(proxyURL, origin string, cred zcodeSigningCredential) (ed25519.PrivateKey, error) {
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	nonce := zcodeSigningRandomHex(zcodeSigningNonceBytes)

	hmacKey, err := zcodeSigningDeriveBytes(cred.apiKeySecret, zcodeSigningHMACKeyInfo)
	if err != nil {
		return nil, fmt.Errorf("derive handshake key: %w", err)
	}
	mac := hmac.New(sha256.New, hmacKey)
	mac.Write([]byte(zcodeSigningHandshakeOp + "\n" + cred.apiKeyID + "\n" + ts + "\n" + nonce))
	sig := zcodeSigningBase64(mac.Sum(nil))

	payload, err := common.Marshal(map[string]string{
		"apiKey": cred.raw,
		"nonce":  nonce,
		"sig":    sig,
		"ts":     ts,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal handshake body: %w", err)
	}

	client, err := service.NewProxyHttpClient(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("handshake http client: %w", err)
	}
	// ZCode 握手使用 redirect:"manual"：3xx 一律视为失败。
	manualClient := *client
	manualClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	ctx, cancel := context.WithTimeout(context.Background(), zcodeSigningHandshakeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(origin, "/")+zcodeSigningHandshakeP, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", cred.raw)
	req.Header.Set("Content-Type", "application/json")

	resp, err := manualClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("handshake request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, zcodeSigningRespBodyLimit))
	if err != nil {
		return nil, fmt.Errorf("handshake response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("handshake http status %d", resp.StatusCode)
	}
	var envelope zcodeSigningHandshakeEnvelope
	if err = common.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("handshake invalid json: %w", err)
	}
	if envelope.Code != http.StatusOK {
		return nil, fmt.Errorf("handshake rejected: code=%d msg=%s", envelope.Code, envelope.Msg)
	}
	if envelope.Data.PrivateCipher == "" {
		return nil, errors.New("handshake omitted privateCipher")
	}
	return zcodeSigningDecryptPrivateKey(cred, envelope.Data.PrivateCipher)
}

// zcodeSigningDecryptPrivateKey 复现 decryptSigningPrivateKey：
// AES-256-GCM(key=HKDF(info=ed25519_priv), iv=cipher[:12], AAD=apiKeyId)，
// 明文为 base64(PKCS8 Ed25519 私钥)。
func zcodeSigningDecryptPrivateKey(cred zcodeSigningCredential, privateCipher string) (ed25519.PrivateKey, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(privateCipher)
	if err != nil {
		return nil, fmt.Errorf("privateCipher base64: %w", err)
	}
	if len(ciphertext) <= 12+16 {
		return nil, errors.New("privateCipher is too short")
	}
	aesKey, err := zcodeSigningDeriveBytes(cred.apiKeySecret, zcodeSigningEd25519Info)
	if err != nil {
		return nil, fmt.Errorf("derive private key: %w", err)
	}
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	plaintext, err := gcm.Open(nil, ciphertext[:12], ciphertext[12:], []byte(cred.apiKeyID))
	if err != nil {
		return nil, fmt.Errorf("decrypt privateCipher: %w", err)
	}
	der, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(plaintext)))
	if err != nil {
		return nil, fmt.Errorf("private key base64: %w", err)
	}
	parsed, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, fmt.Errorf("private key pkcs8: %w", err)
	}
	privateKey, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("private key is not Ed25519")
	}
	return privateKey, nil
}

type zcodeSigningKeyState struct {
	mu        sync.Mutex
	key       ed25519.PrivateKey
	expiresAt time.Time
	// 握手失败的短负缓存：端点异常时避免每个请求都吃满握手超时。
	lastErr   error
	lastErrAt time.Time
}

var zcodeSigningKeyStates sync.Map // "{apiKeyId}\n{origin}" -> *zcodeSigningKeyState

func zcodeSigningStateFor(apiKeyID, origin string) *zcodeSigningKeyState {
	cacheKey := apiKeyID + "\n" + origin
	if loaded, ok := zcodeSigningKeyStates.Load(cacheKey); ok {
		return loaded.(*zcodeSigningKeyState)
	}
	state := &zcodeSigningKeyState{}
	actual, _ := zcodeSigningKeyStates.LoadOrStore(cacheKey, state)
	return actual.(*zcodeSigningKeyState)
}

const zcodeSigningHandshakeFailureBackoff = 30 * time.Second

func zcodeSigningGetKey(proxyURL, origin string, cred zcodeSigningCredential) (ed25519.PrivateKey, error) {
	state := zcodeSigningStateFor(cred.apiKeyID, origin)
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.key != nil && time.Now().Before(state.expiresAt) {
		return state.key, nil
	}
	if state.lastErr != nil && time.Since(state.lastErrAt) < zcodeSigningHandshakeFailureBackoff {
		return nil, state.lastErr
	}
	key, err := zcodeSigningPerformHandshake(proxyURL, origin, cred)
	if err != nil {
		state.lastErr = err
		state.lastErrAt = time.Now()
		return nil, err
	}
	state.key = key
	state.expiresAt = time.Now().Add(zcodeSigningKeyTTL)
	state.lastErr = nil
	return key, nil
}

func zcodeSigningInvalidateKey(apiKeyID, origin string) {
	state := zcodeSigningStateFor(apiKeyID, origin)
	state.mu.Lock()
	defer state.mu.Unlock()
	state.key = nil
	state.expiresAt = time.Time{}
	state.lastErr = nil
	state.lastErrAt = time.Time{}
}

// applyZCodeClientSigning 为最终上游请求附加 X-Client-* 签名头。
// 任一前置条件不满足或密码学操作失败时静默放行（fail-open，与 ZCode 一致），
// 保证签名子系统故障不阻断转发。
func applyZCodeClientSigning(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo, finalURL string) {
	if req == nil || info == nil {
		return
	}
	if !isZhipuZcodeMode(info) || !isZCodeSigningTargetURL(finalURL) {
		return
	}
	// 套餐默认签名；渠道显式关闭才跳过（上游已改免签代理时用）。
	if !zcodeClientSigningEnabled(info) {
		return
	}
	cred, ok := parseZCodeSigningCredential(info.ApiKey)
	if !ok {
		return
	}
	sessionID := strings.TrimSpace(req.Get("X-Session-Id"))
	if sessionID == "" {
		return
	}
	parsed, err := url.Parse(finalURL)
	if err != nil {
		return
	}
	origin := parsed.Scheme + "://" + parsed.Host

	key, err := zcodeSigningGetKey(info.ChannelSetting.Proxy, origin, cred)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("zcode signing handshake failed (fail-open): %v", err))
		return
	}

	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	nonce := zcodeSigningRandomHex(zcodeSigningNonceBytes)
	// 签名串里的版本必须与本次请求声明的指纹版本一致。
	message := cred.apiKeyID + "\n" + ts + "\n" + zcodeFingerprintVersion(info) + "\n" + sessionID + "\n" + nonce
	signature := zcodeSigningBase64(ed25519.Sign(key, []byte(message)))

	pow, err := zcodeSigningSolvePow(cred.apiKeyID, sessionID, ts, zcodeSigningPowBits)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("zcode signing pow failed (fail-open): %v", err))
		return
	}

	req.Set("X-Client-Ts", ts)
	req.Set("X-Client-Version", zcodeFingerprintVersion(info))
	req.Set("X-Client-Sig", signature)
	req.Set("X-Client-Nonce", nonce)
	req.Set("X-App-Id", zcodeSigningAppID)
	req.Set("X-Client-Pow", pow)
}

// maybeInvalidateZCodeSigningKey 嗅探 401 响应体中的验签失败错误码，
// 命中即作废缓存私钥（下次请求重握手）。响应体读取后原位回放，不影响下游处理。
func maybeInvalidateZCodeSigningKey(c *gin.Context, info *relaycommon.RelayInfo, finalURL string, resp *http.Response) {
	if resp == nil || resp.StatusCode != http.StatusUnauthorized || resp.Body == nil {
		return
	}
	if info == nil || !isZhipuZcodeMode(info) || !isZCodeSigningTargetURL(finalURL) {
		return
	}
	if !zcodeClientSigningEnabled(info) {
		return
	}
	cred, ok := parseZCodeSigningCredential(info.ApiKey)
	if !ok {
		return
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, zcodeSigningRespBodyLimit))
	resp.Body.Close()
	resp.Body = io.NopCloser(bytes.NewReader(body))
	if err != nil {
		return
	}
	text := string(body)
	for _, reason := range zcodeSigningRefreshableReasons {
		if strings.Contains(text, reason) {
			parsed, parseErr := url.Parse(finalURL)
			if parseErr != nil {
				return
			}
			origin := parsed.Scheme + "://" + parsed.Host
			zcodeSigningInvalidateKey(cred.apiKeyID, origin)
			logger.LogWarn(c, fmt.Sprintf("zcode signing key invalidated by upstream (%s), will re-handshake", reason))
			return
		}
	}
}
