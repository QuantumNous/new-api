package signing

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
)

const minimumKeyBytes = 32

func Sign(value any, key []byte) (string, error) {
	if len(key) < minimumKeyBytes {
		return "", errors.New("signing key must contain at least 32 bytes")
	}
	payload, err := canonicalPayload(value)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(payload)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func Verify(value any, key []byte, signature string) error {
	expected, err := Sign(value, key)
	if err != nil {
		return err
	}
	actualBytes, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return errors.New("signature is not valid base64url")
	}
	expectedBytes, _ := base64.RawURLEncoding.DecodeString(expected)
	if !hmac.Equal(actualBytes, expectedBytes) {
		return errors.New("signature mismatch")
	}
	return nil
}

func canonicalPayload(value any) ([]byte, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var normalized any
	if err := decoder.Decode(&normalized); err != nil {
		return nil, err
	}
	if object, ok := normalized.(map[string]any); ok {
		delete(object, "signature")
	}
	return json.Marshal(normalized)
}
