package common

import "testing"

func TestEncryptPaymentSecretRoundTrip(t *testing.T) {
	plaintext := "merchant-private-key"

	ciphertext, err := EncryptPaymentSecret(plaintext)
	if err != nil {
		t.Fatalf("EncryptPaymentSecret returned error: %v", err)
	}
	if ciphertext == "" {
		t.Fatal("EncryptPaymentSecret returned empty ciphertext")
	}
	if ciphertext == plaintext {
		t.Fatal("EncryptPaymentSecret returned plaintext")
	}

	decrypted, err := DecryptPaymentSecret(ciphertext)
	if err != nil {
		t.Fatalf("DecryptPaymentSecret returned error: %v", err)
	}
	if decrypted != plaintext {
		t.Fatalf("decrypted secret = %q, want %q", decrypted, plaintext)
	}
}

func TestMaskPaymentSecret(t *testing.T) {
	masked := MaskSecret("abcdef")
	if masked != "abcd****" {
		t.Fatalf("MaskSecret returned %q", masked)
	}
	if !IsMaskedSecret(masked) {
		t.Fatalf("IsMaskedSecret(%q) = false", masked)
	}
	if IsMaskedSecret("abcdef") {
		t.Fatal("IsMaskedSecret returned true for an unmasked secret")
	}
}
