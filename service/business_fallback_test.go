package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	businessfallback "github.com/QuantumNous/new-api/setting/business_fallback"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func resetBusinessFallbackTestState(t *testing.T) {
	t.Helper()
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	memoryBusinessFallbackHealth = &memoryBusinessFallbackHealthStore{
		buckets: make(map[string]memoryHealthBucket),
		blocks:  make(map[string]time.Time),
	}
	if err := businessfallback.UpdateConfig(businessfallback.DefaultConfigJSON); err != nil {
		t.Fatalf("reset business fallback config: %v", err)
	}
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		memoryBusinessFallbackHealth = &memoryBusinessFallbackHealthStore{
			buckets: make(map[string]memoryHealthBucket),
			blocks:  make(map[string]time.Time),
		}
		_ = businessfallback.UpdateConfig(businessfallback.DefaultConfigJSON)
	})
}

func TestMatchImageBusinessFallbackFamily(t *testing.T) {
	resetBusinessFallbackTestState(t)

	tests := map[string]string{
		"gpt-image-2":                    "gpt_image",
		"gpt-image":                      "",
		"gpt-image-1":                    "",
		"gpt-image-2-preview":            "",
		"gemini-3.1-flash-image-preview": "gemini_image",
		"gemini-image":                   "",
		"banana":                         "",
		"banana-pro":                     "",
		"doubao-seedream-5-0":            "seedream",
		"doubao-seedream-5-0-preview":    "seedream",
		"seedream":                       "",
		"ordinary-chat-model":            "",
		"":                               "",
	}
	for model, want := range tests {
		if got := MatchImageBusinessFallbackFamily(model); got != want {
			t.Fatalf("MatchImageBusinessFallbackFamily(%q) = %q, want %q", model, got, want)
		}
	}
}

func TestMatchImageBusinessFallbackFamilyExplicitPrefix(t *testing.T) {
	resetBusinessFallbackTestState(t)
	cfg := `{
	  "enabled": true,
	  "image_generation": {
	    "families": {
	      "gpt_image": {"match_models": ["prefix:gpt-image-2"], "select_model": "gpt-image-2"},
	      "gemini_image": {"match_models": ["gemini-3.1-flash-image-preview"], "select_model": "gemini-3.1-flash-image-preview"},
	      "seedream": {"match_models": ["doubao-seedream-5-0*"], "select_model": "doubao-seedream-5-0"}
	    },
	    "chains": {
	      "gpt_image": ["gpt_image", "gemini_image", "seedream"],
	      "gemini_image": ["gemini_image", "gpt_image", "seedream"],
	      "seedream": ["seedream"]
	    },
	    "health": {
	      "enabled": true,
	      "monitored_families": ["gpt_image", "gemini_image"],
	      "window_minutes": 60,
	      "min_samples": 10,
	      "success_rate_threshold": 0.3,
	      "block_minutes": 60
	    }
	  }
	}`
	if err := businessfallback.UpdateConfig(cfg); err != nil {
		t.Fatalf("UpdateConfig returned error: %v", err)
	}
	if got := MatchImageBusinessFallbackFamily("gpt-image-2-preview"); got != "gpt_image" {
		t.Fatalf("prefix match = %q, want gpt_image", got)
	}
	if got := MatchImageBusinessFallbackFamily("gpt-image-1"); got != "" {
		t.Fatalf("prefix should not match gpt-image-1, got %q", got)
	}
}

func TestResolveImageBusinessFallbackPlanOrder(t *testing.T) {
	resetBusinessFallbackTestState(t)

	plan, ok := ResolveImageBusinessFallbackPlan("gpt-image-2")
	if !ok {
		t.Fatal("expected gpt_image fallback plan")
	}
	assertAttemptFamilies(t, plan.Attempts, []string{"gpt_image", "gemini_image", "seedream"})
	assertAttemptModels(t, plan.Attempts, []string{"gpt-image-2", "gemini-3.1-flash-image-preview", "doubao-seedream-5-0"})

	plan, ok = ResolveImageBusinessFallbackPlan("gemini-3.1-flash-image-preview")
	if !ok {
		t.Fatal("expected gemini_image fallback plan")
	}
	assertAttemptFamilies(t, plan.Attempts, []string{"gemini_image", "gpt_image", "seedream"})
	assertAttemptModels(t, plan.Attempts, []string{"gemini-3.1-flash-image-preview", "gpt-image-2", "doubao-seedream-5-0"})
}

func TestBusinessFallbackHealthBlocksLowSuccessRate(t *testing.T) {
	resetBusinessFallbackTestState(t)

	for i := 0; i < 8; i++ {
		RecordBusinessFallbackHealth(11, "gpt_image", false)
	}
	for i := 0; i < 2; i++ {
		RecordBusinessFallbackHealth(11, "gpt_image", true)
	}

	if !IsBusinessFallbackFamilyBlocked(11, "gpt_image") {
		t.Fatal("channel 11 gpt_image should be blocked at 20% success rate")
	}
	if IsBusinessFallbackFamilyBlocked(11, "gemini_image") {
		t.Fatal("block should not affect a different family on same channel")
	}
	if IsBusinessFallbackFamilyBlocked(12, "gpt_image") {
		t.Fatal("block should not affect same family on different channel")
	}
}

func TestBusinessFallbackHealthSampleFloorAndSeedream(t *testing.T) {
	resetBusinessFallbackTestState(t)

	for i := 0; i < 9; i++ {
		RecordBusinessFallbackHealth(21, "gemini_image", false)
	}
	if IsBusinessFallbackFamilyBlocked(21, "gemini_image") {
		t.Fatal("sample count below min_samples should not block")
	}

	for i := 0; i < 20; i++ {
		RecordBusinessFallbackHealth(22, "seedream", false)
	}
	if IsBusinessFallbackFamilyBlocked(22, "seedream") {
		t.Fatal("seedream should not participate in health blocking")
	}
}

func TestIsModelAllowedByTokenLimit(t *testing.T) {
	c := &gin.Context{}
	if !IsModelAllowedByTokenLimit(c, "gemini-3.1-flash-image-preview") {
		t.Fatal("model should be allowed when token model limit is disabled")
	}

	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{
		"gpt-image-2": true,
	})
	if !IsModelAllowedByTokenLimit(c, "gpt-image-2") {
		t.Fatal("allowed model rejected")
	}
	if IsModelAllowedByTokenLimit(c, "gemini-3.1-flash-image-preview") {
		t.Fatal("fallback target outside token limit should be rejected")
	}
}

func TestBusinessImageRequestFromGemini(t *testing.T) {
	imageConfig, err := common.Marshal(map[string]any{
		"aspectRatio": "16:9",
		"imageSize":   "2K",
	})
	if err != nil {
		t.Fatalf("marshal image config: %v", err)
	}
	candidateCount := 2
	req, err := NewBusinessImageRequest(&dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{
				Role: "user",
				Parts: []dto.GeminiPart{
					{Text: "draw a quiet control room"},
				},
			},
		},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			CandidateCount: &candidateCount,
			ImageConfig:    imageConfig,
		},
	})
	if err != nil {
		t.Fatalf("NewBusinessImageRequest returned error: %v", err)
	}

	geminiImage, err := req.ToImageRequest("gemini-3.1-flash-image-preview", "gemini_image")
	if err != nil {
		t.Fatalf("ToImageRequest gemini returned error: %v", err)
	}
	if geminiImage.Model != "gemini-3.1-flash-image-preview" || geminiImage.Prompt != "draw a quiet control room" {
		t.Fatalf("unexpected gemini image request: %#v", geminiImage)
	}
	if geminiImage.N == nil || *geminiImage.N != 2 {
		t.Fatalf("N = %v, want 2", geminiImage.N)
	}
	if geminiImage.Size != "16:9" || geminiImage.Quality != "high" {
		t.Fatalf("size/quality = %q/%q, want 16:9/high", geminiImage.Size, geminiImage.Quality)
	}
	if len(geminiImage.ExtraFields) == 0 {
		t.Fatal("gemini family should retain native gemini config in extra_fields")
	}

	gptImage, err := req.ToImageRequest("gpt-image-2", "gpt_image")
	if err != nil {
		t.Fatalf("ToImageRequest gpt returned error: %v", err)
	}
	if gptImage.Size != "1792x1024" {
		t.Fatalf("gpt fallback size = %q, want 1792x1024", gptImage.Size)
	}
	if len(gptImage.ExtraFields) != 0 {
		t.Fatal("non-gemini fallback should not carry gemini-only extra_fields")
	}
}

func TestShouldRecordBusinessFallbackFailure(t *testing.T) {
	if ShouldRecordBusinessFallbackFailure(types.NewErrorWithStatusCode(
		http.ErrHandlerTimeout,
		types.ErrorCodeDoRequestFailed,
		http.StatusInternalServerError,
	)) != true {
		t.Fatal("network/upstream failures should be recorded")
	}
	if ShouldRecordBusinessFallbackFailure(types.NewErrorWithStatusCode(
		http.ErrBodyNotAllowed,
		types.ErrorCodePromptBlocked,
		http.StatusBadRequest,
	)) {
		t.Fatal("prompt/content rejection should not be recorded as channel health failure")
	}
	if ShouldRecordBusinessFallbackFailure(types.NewError(
		http.ErrBodyNotAllowed,
		types.ErrorCodeInvalidRequest,
		types.ErrOptionWithSkipRetry(),
	)) {
		t.Fatal("skip-retry local/client errors should not be recorded")
	}
}

func assertAttemptFamilies(t *testing.T, attempts []BusinessFallbackAttempt, want []string) {
	t.Helper()
	if len(attempts) != len(want) {
		t.Fatalf("attempt count = %d, want %d", len(attempts), len(want))
	}
	for i, attempt := range attempts {
		if attempt.Family != want[i] {
			t.Fatalf("attempt[%d].Family = %q, want %q", i, attempt.Family, want[i])
		}
	}
}

func assertAttemptModels(t *testing.T, attempts []BusinessFallbackAttempt, want []string) {
	t.Helper()
	if len(attempts) != len(want) {
		t.Fatalf("attempt count = %d, want %d", len(attempts), len(want))
	}
	for i, attempt := range attempts {
		if attempt.SelectModel != want[i] {
			t.Fatalf("attempt[%d].SelectModel = %q, want %q", i, attempt.SelectModel, want[i])
		}
	}
}
