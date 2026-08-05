package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestAssetResponsePublicShapeOmitsProviderStorageAndHashFields(t *testing.T) {
	resp := AssetResponse{
		ID:              "ast_public",
		Object:          "asset",
		AssetType:       "Image",
		Status:          "Active",
		AssetURL:        "asset://ast_public",
		CreatedAt:       1785678901,
		SourceExpiresAt: 1788270901,
	}

	raw, err := common.Marshal(resp)

	require.NoError(t, err)
	body := string(raw)
	require.Contains(t, body, `"asset_url":"asset://ast_public"`)
	require.Contains(t, body, `"source_expires_at":1788270901`)
	requireAssetDTOHasNoPrivateFields(t, body)
}

func TestAssetResponseOmitsEmptySourceExpiresAt(t *testing.T) {
	raw, err := common.Marshal(AssetResponse{ID: "ast_public", Object: "asset", AssetURL: "asset://ast_public"})

	require.NoError(t, err)
	require.NotContains(t, string(raw), "source_expires_at")
}

func TestAssetCreateAndUploadSessionRequestsUseCanonicalJSONTags(t *testing.T) {
	var create AssetCreateRequest
	require.NoError(t, common.Unmarshal([]byte(`{"url":"https://cdn.example/image.png","asset_type":"Image","model":"gpt-4.1"}`), &create))
	require.Equal(t, "https://cdn.example/image.png", create.URL)
	require.Equal(t, "Image", create.AssetType)
	require.Equal(t, "gpt-4.1", create.Model)

	var session AssetUploadSessionRequest
	require.NoError(t, common.Unmarshal([]byte(`{"asset_type":"Video","content_type":"video/mp4","size_bytes":123,"model":"seedance-2.0"}`), &session))
	require.Equal(t, "Video", session.AssetType)
	require.Equal(t, "video/mp4", session.ContentType)
	require.EqualValues(t, 123, session.SizeBytes)
	require.Equal(t, "seedance-2.0", session.Model)
}

func TestAssetUploadSessionResponsePublicShapeOmitsStorageFields(t *testing.T) {
	resp := AssetUploadSessionResponse{
		UploadID:      "upl_public",
		AssetID:       "ast_public",
		Object:        "asset.upload",
		Status:        "pending",
		UploadURL:     "https://signed.example/upload",
		UploadHeaders: map[string]string{"x-goog-if-generation-match": "0"},
		ExpiresAt:     1785682501,
	}

	raw, err := common.Marshal(resp)

	require.NoError(t, err)
	body := string(raw)
	require.Contains(t, body, `"upload_url":"https://signed.example/upload"`)
	require.Contains(t, body, `"x-goog-if-generation-match":"0"`)
	requireAssetDTOHasNoPrivateFields(t, body)
}

func requireAssetDTOHasNoPrivateFields(t *testing.T, body string) {
	t.Helper()
	for _, forbidden := range []string{
		"provider",
		"channel",
		"upstream",
		"bucket",
		"object_key",
		"hash",
		"sha256",
		"signed_get",
		"moderation",
		"credential",
		"service_account",
	} {
		require.NotContains(t, body, forbidden)
	}
}
