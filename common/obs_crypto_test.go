package common

import "testing"

func TestOBSSecretRoundTrip(t *testing.T) {
	for _, plain := range []string{"", "AKIDEXAMPLE", "sk-1234567890/+abcDEF"} {
		enc, err := EncryptOBSSecret(plain)
		if err != nil {
			t.Fatalf("encrypt %q: %v", plain, err)
		}
		if plain != "" && enc == plain {
			t.Errorf("ciphertext equals plaintext for %q", plain)
		}
		got, err := DecryptOBSSecret(enc)
		if err != nil {
			t.Fatalf("decrypt %q: %v", plain, err)
		}
		if got != plain {
			t.Errorf("roundtrip mismatch: got %q want %q", got, plain)
		}
	}
}

func TestDecryptOBSSecretRejectsGarbage(t *testing.T) {
	if _, err := DecryptOBSSecret("not-base64!!!"); err == nil {
		t.Error("expected error for invalid base64")
	}
	if _, err := DecryptOBSSecret("YWJj"); err == nil {
		t.Error("expected error for too-short ciphertext")
	}
}
