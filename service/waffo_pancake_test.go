package service

import (
	"encoding/base64"
	"encoding/pem"
	"testing"
)

func TestNormalizeWaffoPancakePrivateKey(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("test-private-key"))
	block, _ := pem.Decode([]byte(normalizeWaffoPancakePrivateKey(encoded)))
	if block == nil || block.Type != "PRIVATE KEY" || string(block.Bytes) != "test-private-key" {
		t.Fatal("raw base64 PKCS#8 key was not converted to a private-key PEM block")
	}

	pemKey := "-----BEGIN PRIVATE KEY-----\nZm9v\n-----END PRIVATE KEY-----"
	if got := normalizeWaffoPancakePrivateKey(pemKey); got != pemKey {
		t.Fatal("PEM key should be retained unchanged")
	}
}
