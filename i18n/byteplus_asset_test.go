package i18n

import "testing"

func TestBytePlusAssetLocaleCoverage(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("i18n init failed: %v", err)
	}

	keys := []string{
		MsgAssetInvalidRequest,
		MsgAssetNotFound,
		MsgAssetNotReady,
		MsgAssetFailed,
		MsgAssetChannelConflict,
		MsgAssetChannelUnavailable,
		MsgAssetGroupInitializing,
		MsgAssetUpstreamError,
		MsgAssetExpired,
		MsgAssetTypeMismatch,
		MsgAssetStorageError,
		MsgRealPersonInvalidRequest,
		MsgRealPersonNotFound,
		MsgRealPersonNotActive,
		MsgRealPersonChannelUnavailable,
		MsgRealPersonStorageError,
		MsgVerificationInProgress,
		MsgVerificationUpstreamError,
		MsgIdempotencyConflict,
		MsgIdempotencyOutcomeUnknown,
		MsgAssetProfileConflict,
		MsgAssetFileTooLarge,
		MsgAssetMediaUnsupported,
		MsgAssetUploadFailed,
	}
	langs := []string{LangEn, LangZhCN, LangZhTW, LangPt}

	for _, lang := range langs {
		for _, key := range keys {
			got := Translate(lang, key)
			if got == "" {
				t.Fatalf("lang %s key %s translated to empty string", lang, key)
			}
			if got == key {
				t.Fatalf("lang %s key %s is missing a translation", lang, key)
			}
		}
	}
}
