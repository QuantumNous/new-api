package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestIdempotencyHashKeyTrimStableAndRejectsInvalid(t *testing.T) {
	first, err := hashAPIIdempotencyKey("  stable-key  ")
	require.NoError(t, err)
	second, err := hashAPIIdempotencyKey("stable-key")
	require.NoError(t, err)
	require.Equal(t, first, second)
	require.Len(t, first, 64)

	other, err := hashAPIIdempotencyKey("other-key")
	require.NoError(t, err)
	require.NotEqual(t, first, other)
	_, err = hashAPIIdempotencyKey("   ")
	require.Error(t, err)
	_, err = hashAPIIdempotencyKey(strings.Repeat("a", 256))
	require.Error(t, err)
}

func TestIdempotencyHashCanonicalRequestIsStableAndDifferent(t *testing.T) {
	first, err := hashCanonicalRequest(map[string]any{"name": "Alice", "size": int64(42)})
	require.NoError(t, err)
	second, err := hashCanonicalRequest(map[string]any{"name": "Alice", "size": int64(42)})
	require.NoError(t, err)
	third, err := hashCanonicalRequest(map[string]any{"name": "Alice", "size": int64(43)})
	require.NoError(t, err)
	require.Equal(t, first, second)
	require.NotEqual(t, first, third)
}

func TestIdempotencyHashMultipartAssetRequestNormalizesFields(t *testing.T) {
	first, err := hashMultipartAssetRequest("person_1", " Image ", " avatar.png ", "abc123", 1024)
	require.NoError(t, err)
	second, err := hashMultipartAssetRequest("person_1", "Image", "avatar.png", "abc123", 1024)
	require.NoError(t, err)
	third, err := hashMultipartAssetRequest("person_1", "Video", "avatar.png", "abc123", 1024)
	require.NoError(t, err)
	require.Equal(t, first, second)
	require.NotEqual(t, first, third)
}

func TestAPIIdempotencyResponsePayloadUsesPublicDTO(t *testing.T) {
	payload, err := marshalAPIIdempotencyResponsePayload(bytePlusVerificationSessionPublicDTO{
		ID:        "rvs_public",
		Object:    "verification_session",
		Status:    "pending",
		CreatedAt: 123,
	})
	require.NoError(t, err)
	require.NotContains(t, payload, "verification_url")
	var decoded map[string]any
	require.NoError(t, common.Unmarshal([]byte(payload), &decoded))
	require.Equal(t, "rvs_public", decoded["id"])
}
