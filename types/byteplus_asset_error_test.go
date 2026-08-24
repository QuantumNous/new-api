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
		"asset_expired":             ErrorCodeAssetExpired,
		"asset_type_mismatch":       ErrorCodeAssetTypeMismatch,
	}
	for want, got := range tests {
		if string(got) != want {
			t.Fatalf("error code = %q, want %q", got, want)
		}
	}
}

func TestBytePlusRealPersonErrorCodes(t *testing.T) {
	tests := map[string]ErrorCode{
		"invalid_real_person_request":     ErrorCodeInvalidRealPersonRequest,
		"real_person_not_found":           ErrorCodeRealPersonNotFound,
		"real_person_not_active":          ErrorCodeRealPersonNotActive,
		"verification_in_progress":        ErrorCodeVerificationInProgress,
		"idempotency_conflict":            ErrorCodeIdempotencyConflict,
		"idempotency_outcome_unknown":     ErrorCodeIdempotencyOutcomeUnknown,
		"asset_profile_conflict":          ErrorCodeAssetProfileConflict,
		"asset_file_too_large":            ErrorCodeAssetFileTooLarge,
		"asset_media_unsupported":         ErrorCodeAssetMediaUnsupported,
		"asset_upload_failed":             ErrorCodeAssetUploadFailed,
		"verification_upstream_error":     ErrorCodeVerificationUpstreamError,
		"real_person_channel_unavailable": ErrorCodeRealPersonChannelUnavailable,
		"real_person_storage_error":       ErrorCodeRealPersonStorageError,
	}
	for want, got := range tests {
		if string(got) != want {
			t.Fatalf("error code = %q, want %q", got, want)
		}
	}
}
