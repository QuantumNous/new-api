package service

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

type failReader struct{}

func (failReader) Read([]byte) (int, error) {
	return 0, errors.New("random failed")
}

func TestBytePlusSensitiveCipherRoundTripBindsSessionAndField(t *testing.T) {
	cipher, err := newBytePlusSensitiveCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("newBytePlusSensitiveCipher error: %v", err)
	}

	envelope, err := cipher.Encrypt("session-1", "byted_token", "secret-token")
	if err != nil {
		t.Fatalf("Encrypt error: %v", err)
	}
	if !strings.HasPrefix(envelope, "v1:") {
		t.Fatalf("envelope = %q", envelope)
	}
	plaintext, err := cipher.Decrypt("session-1", "byted_token", envelope)
	if err != nil {
		t.Fatalf("Decrypt error: %v", err)
	}
	if plaintext != "secret-token" {
		t.Fatalf("plaintext = %q", plaintext)
	}
	if _, err := cipher.Decrypt("session-2", "byted_token", envelope); err == nil {
		t.Fatal("Decrypt should fail for wrong session")
	}
	if _, err := cipher.Decrypt("session-1", "h5_link", envelope); err == nil {
		t.Fatal("Decrypt should fail for wrong field")
	}
}

func TestBytePlusSensitiveCipherSupportsCallbackTokenField(t *testing.T) {
	cipher, err := newBytePlusSensitiveCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("newBytePlusSensitiveCipher error: %v", err)
	}

	envelope, err := cipher.Encrypt("session-1", "callback_token", "callback-secret")
	if err != nil {
		t.Fatalf("Encrypt callback_token error: %v", err)
	}
	plaintext, err := cipher.Decrypt("session-1", "callback_token", envelope)
	if err != nil {
		t.Fatalf("Decrypt callback_token error: %v", err)
	}
	if plaintext != "callback-secret" {
		t.Fatalf("plaintext = %q", plaintext)
	}
}

func TestBytePlusSensitiveCipherRejectsInvalidConstruction(t *testing.T) {
	if _, err := newBytePlusSensitiveCipher(bytesOf('k', 31), strings.NewReader("nonce")); err == nil {
		t.Fatal("short key should fail")
	}
	if _, err := newBytePlusSensitiveCipher(bytesOf('k', 32), nil); err == nil {
		t.Fatal("nil random should fail")
	}
}

func TestBytePlusSensitiveCipherRejectsEmptyInputs(t *testing.T) {
	cipher, err := newBytePlusSensitiveCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("newBytePlusSensitiveCipher error: %v", err)
	}
	if _, err := cipher.Encrypt("", "field", "plaintext"); err == nil {
		t.Fatal("empty sessionID should fail")
	}
	if _, err := cipher.Encrypt("session", "", "plaintext"); err == nil {
		t.Fatal("empty field should fail")
	}
	if _, err := cipher.Encrypt("session", "field", ""); err == nil {
		t.Fatal("empty plaintext should fail")
	}
	if _, err := cipher.Decrypt("", "field", "v1:abc"); err == nil {
		t.Fatal("empty decrypt sessionID should fail")
	}
	if _, err := cipher.Decrypt("session", "", "v1:abc"); err == nil {
		t.Fatal("empty decrypt field should fail")
	}
}

func TestBytePlusSensitiveCipherRejectsInvalidEnvelopes(t *testing.T) {
	cipher, err := newBytePlusSensitiveCipher(bytesOf('k', 32), strings.NewReader(strings.Repeat("n", 64)))
	if err != nil {
		t.Fatalf("newBytePlusSensitiveCipher error: %v", err)
	}
	envelope, err := cipher.Encrypt("session", "field", "plaintext")
	if err != nil {
		t.Fatalf("Encrypt error: %v", err)
	}
	tampered := envelope[:len(envelope)-1] + "A"

	tests := []string{
		tampered,
		"v2:" + strings.TrimPrefix(envelope, "v1:"),
		"v1:not standard/base64",
		"v1:" + base64.RawURLEncoding.EncodeToString([]byte("short")),
	}
	for _, envelope := range tests {
		if _, err := cipher.Decrypt("session", "field", envelope); err == nil {
			t.Fatalf("Decrypt(%q) should fail", envelope)
		}
	}
}

func TestBytePlusSensitiveCipherReturnsRandomReadError(t *testing.T) {
	cipher, err := newBytePlusSensitiveCipher(bytesOf('k', 32), failReader{})
	if err != nil {
		t.Fatalf("newBytePlusSensitiveCipher error: %v", err)
	}
	if _, err := cipher.Encrypt("session", "field", "plaintext"); err == nil {
		t.Fatal("Encrypt should fail when nonce reader fails")
	}
}

func TestLoadBytePlusSensitiveCipherFromEnv(t *testing.T) {
	t.Setenv(bytePlusSensitiveCipherEnv, base64.StdEncoding.EncodeToString(bytesOf('k', 32)))
	cipher, err := loadBytePlusSensitiveCipherFromEnv()
	if err != nil {
		t.Fatalf("loadBytePlusSensitiveCipherFromEnv error: %v", err)
	}
	envelope, err := cipher.Encrypt("session", "field", "plaintext")
	if err != nil {
		t.Fatalf("Encrypt error: %v", err)
	}
	plaintext, err := cipher.Decrypt("session", "field", envelope)
	if err != nil {
		t.Fatalf("Decrypt error: %v", err)
	}
	if plaintext != "plaintext" {
		t.Fatalf("plaintext = %q", plaintext)
	}
}

func TestLoadBytePlusSensitiveCipherFromEnvRejectsInvalidValues(t *testing.T) {
	tests := []string{
		"",
		"not base64",
		base64.StdEncoding.EncodeToString(bytesOf('k', 31)),
	}
	for _, value := range tests {
		t.Setenv(bytePlusSensitiveCipherEnv, value)
		if _, err := loadBytePlusSensitiveCipherFromEnv(); err == nil {
			t.Fatalf("loadBytePlusSensitiveCipherFromEnv(%q) should fail", value)
		}
	}
}

func bytesOf(value byte, length int) []byte {
	out := make([]byte, length)
	for i := range out {
		out[i] = value
	}
	return out
}
