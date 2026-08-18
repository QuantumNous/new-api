package service

import (
	"bytes"
	"io"
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

func TestGrokCipherRejectsDisallowedField(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	cipher, err := newGrokCredentialCipher(key, deterministicReader())
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	// 非白名单字段（access_token）必须拒绝，verifier 之外不受此 cipher 保护。
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
