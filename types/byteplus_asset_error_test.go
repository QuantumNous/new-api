package types

import "testing"

func TestBytePlusAssetErrorCodes(t *testing.T) {
	tests := map[string]ErrorCode{
		"invalid_asset_request":     ErrorCodeInvalidAssetRequest,
		"asset_not_found":           ErrorCodeAssetNotFound,
		"asset_not_ready":           ErrorCodeAssetNotReady,
		"asset_failed":              ErrorCodeAssetFailed,
		"asset_channel_conflict":    ErrorCodeAssetChannelConflict,
		"asset_channel_unavailable": ErrorCodeAssetChannelUnavailable,
		"asset_group_initializing":  ErrorCodeAssetGroupInitializing,
		"asset_upstream_error":      ErrorCodeAssetUpstreamError,
		"asset_storage_error":       ErrorCodeAssetStorageError,
	}
	for want, got := range tests {
		if string(got) != want {
			t.Fatalf("error code = %q, want %q", got, want)
		}
	}
}
