package service

import (
	"bytes"
	"encoding/base64"
	"io"
	"strings"
	"testing"
)

// deterministicReader 返回固定字节的 reader，供测试里 nonce 生成使用。
func deterministicReader() io.Reader {
	return bytes.NewReader(make([]byte, 64))
}

func TestGrokCipherRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	cipher, err := newGrokCredentialCipher(key, deterministicReader())
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	envelope, err := cipher.Encrypt("flow-123", "pkce_verifier", "the-verifier")
	if err != nil {
		t.Fatalf("encrypt err %v", err)
	}
	got, err := cipher.Decrypt("flow-123", "pkce_verifier", envelope)
	if err != nil {
		t.Fatalf("decrypt err %v", err)
	}
	if got != "the-verifier" {
		t.Fatalf("round trip = %q", got)
	}
	// AAD 绑定：换 flowID 解密必须失败
	if _, err := cipher.Decrypt("flow-999", "pkce_verifier", envelope); err == nil {
		t.Fatalf("decrypt with wrong sessionID must fail (AAD mismatch)")
	}
}

func TestGrokCipherCompletionKeyRoundTrip(t *testing.T) {
	cipher, err := newGrokCredentialCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	envelope, err := cipher.Encrypt("flow-123", "completion_key", `{"v":1,"access_token":"secret"}`)
	if err != nil {
		t.Fatalf("encrypt err %v", err)
	}
	if strings.Contains(envelope, "secret") {
		t.Fatal("completion envelope must not contain plaintext credentials")
	}
	got, err := cipher.Decrypt("flow-123", "completion_key", envelope)
	if err != nil {
		t.Fatalf("decrypt err %v", err)
	}
	if got != `{"v":1,"access_token":"secret"}` {
		t.Fatalf("round trip = %q", got)
	}
	if _, err := cipher.Decrypt("flow-123", "pkce_verifier", envelope); err == nil {
		t.Fatal("completion ciphertext must not decrypt under the verifier AAD")
	}
}

func TestGrokCipherRejectsDisallowedField(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	cipher, err := newGrokCredentialCipher(key, deterministicReader())
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	// 非白名单字段（access_token）必须拒绝；只有 verifier 和 completion key 可用。
	if _, err := cipher.Encrypt("flow-123", "access_token", "secret"); err == nil {
		t.Fatalf("encrypt with disallowed field must fail")
	}
}

func TestGrokCipherRejectsBadKey(t *testing.T) {
	if _, err := newGrokCredentialCipher(make([]byte, 16), deterministicReader()); err == nil {
		t.Fatalf("16-byte key must be rejected")
	}
	if _, err := newGrokCredentialCipher(make([]byte, 32), nil); err == nil {
		t.Fatalf("nil random reader must be rejected")
	}
}

// TestGrokCipherRejectsInvalidEnvelopes 覆盖 Decrypt 的 fail-closed 边界（照 byteplus 的
// TestBytePlusSensitiveCipherRejectsInvalidEnvelopes）：篡改、错版本前缀、非法 base64、过短 payload 全须拒绝。
func TestGrokCipherRejectsInvalidEnvelopes(t *testing.T) {
	cipher, err := newGrokCredentialCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	envelope, err := cipher.Encrypt("flow-1", "pkce_verifier", "the-verifier")
	if err != nil {
		t.Fatalf("encrypt err %v", err)
	}
	tampered := envelope[:len(envelope)-1] + "A"

	tests := []string{
		tampered, // ① 篡改末字节 -> GCM 认证失败
		"v2:" + strings.TrimPrefix(envelope, "v1:"),                   // ② 错误版本前缀
		"v1:not standard/base64",                                      // ③ 非法 base64（RawURL 不含 '/'、空格）
		"v1:" + base64.RawURLEncoding.EncodeToString([]byte("short")), // ④ 过短 payload（<= nonceSize）
	}
	for _, env := range tests {
		if _, err := cipher.Decrypt("flow-1", "pkce_verifier", env); err == nil {
			t.Fatalf("Decrypt(%q) must fail", env)
		}
	}
}

// TestGrokCipherRejectsEmptyPlaintext：上下文合法（sessionID/field 通过白名单）但 plaintext 为空必须拒绝。
func TestGrokCipherRejectsEmptyPlaintext(t *testing.T) {
	cipher, err := newGrokCredentialCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	if _, err := cipher.Encrypt("flow-1", "pkce_verifier", ""); err == nil {
		t.Fatalf("encrypt with empty plaintext must fail")
	}
}

// TestGrokCipherReturnsRandomReadError：nonce 生成失败（random reader 出错）时 Encrypt 必须 fail-closed
// 返回 error（照 byteplus 的 failReader，reuse 同包内已定义的 failReader）。
func TestGrokCipherReturnsRandomReadError(t *testing.T) {
	cipher, err := newGrokCredentialCipher(bytesOf('k', 32), failReader{})
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	if _, err := cipher.Encrypt("flow-1", "pkce_verifier", "the-verifier"); err == nil {
		t.Fatalf("encrypt must fail when nonce reader fails")
	}
}

// TestLoadGrokCredentialCipherFromEnv：合法 32 字节 base64 key 从 env 装载并可 round-trip。
func TestLoadGrokCredentialCipherFromEnv(t *testing.T) {
	t.Setenv(grokCredentialCipherEnv, base64.StdEncoding.EncodeToString(bytesOf('k', 32)))
	cipher, err := loadGrokCredentialCipherFromEnv()
	if err != nil {
		t.Fatalf("load from env err %v", err)
	}
	envelope, err := cipher.Encrypt("flow-1", "pkce_verifier", "the-verifier")
	if err != nil {
		t.Fatalf("encrypt err %v", err)
	}
	got, err := cipher.Decrypt("flow-1", "pkce_verifier", envelope)
	if err != nil {
		t.Fatalf("decrypt err %v", err)
	}
	if got != "the-verifier" {
		t.Fatalf("round trip = %q", got)
	}
}

// TestLoadGrokCredentialCipherFromEnvRejectsInvalidValues：env 缺失 / 坏 base64 / 解码后长度≠32 都须 fail-closed。
func TestLoadGrokCredentialCipherFromEnvRejectsInvalidValues(t *testing.T) {
	tests := []string{
		"", // env 缺失（空）
		"not base64",
		base64.StdEncoding.EncodeToString(bytesOf('k', 31)), // 解码后 31 字节 ≠ 32
	}
	for _, value := range tests {
		t.Setenv(grokCredentialCipherEnv, value)
		if _, err := loadGrokCredentialCipherFromEnv(); err == nil {
			t.Fatalf("loadGrokCredentialCipherFromEnv(%q) must fail", value)
		}
	}
}
