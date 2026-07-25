package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestInputTokenDetailsParsesAndNormalizesCacheWriteTokens(t *testing.T) {
	var details InputTokenDetails
	if err := common.Unmarshal([]byte(`{"cached_creation_tokens":12,"cache_write_tokens":18}`), &details); err != nil {
		t.Fatal(err)
	}
	if got := details.CacheCreationTokensTotal(); got != 18 {
		t.Fatalf("normalized cache write tokens = %d, want 18", got)
	}

	details = InputTokenDetails{CachedCreationTokens: 21, CacheWriteTokens: 18}
	if got := details.CacheCreationTokensTotal(); got != 21 {
		t.Fatalf("legacy/native max = %d, want 21", got)
	}

	details = InputTokenDetails{CachedCreationTokens: -1, CacheWriteTokens: -2}
	if got := details.CacheCreationTokensTotal(); got != 0 {
		t.Fatalf("negative normalized count = %d, want 0", got)
	}
}
