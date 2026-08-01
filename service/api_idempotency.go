package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	apiIdempotencyRetention = 24 * time.Hour
	apiIdempotencyLease     = 5 * time.Minute
)

type bytePlusVerificationSessionPublicDTO struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"created_at"`
}

func hashAPIIdempotencyKey(raw string) (string, error) {
	key := strings.TrimSpace(raw)
	if key == "" {
		return "", errors.New("idempotency key is required")
	}
	if len(key) > 255 {
		return "", errors.New("idempotency key cannot exceed 255 characters")
	}
	return sha256Hex([]byte(key)), nil
}

func hashCanonicalRequest(value any) (string, error) {
	raw, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	return sha256Hex(raw), nil
}

func hashMultipartAssetRequest(personID, assetType, name, fileSHA256 string, size int64) (string, error) {
	return hashCanonicalRequest(struct {
		PersonID  string
		AssetType string
		Name      string
		FileSHA   string
		Size      int64
	}{
		PersonID:  personID,
		AssetType: strings.TrimSpace(assetType),
		Name:      strings.TrimSpace(name),
		FileSHA:   fileSHA256,
		Size:      size,
	})
}

func marshalAPIIdempotencyResponsePayload(value any) (string, error) {
	raw, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func sha256Hex(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
