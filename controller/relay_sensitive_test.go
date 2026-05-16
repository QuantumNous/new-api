package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestCheckPromptSensitiveForRelayRechecksChangedAutoGroup(t *testing.T) {
	withControllerSensitiveSettings(t, "global_block", `{
		"version": 1,
		"rules": [
			{"id":"r-vip","name":"VIP","enabled":true,"groups":["vip"],"include_global_words":false,"words":["vip_block"]}
		]
	}`)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		UsingGroup:      "default",
		TokenGroup:      "auto",
		UserGroup:       "default",
	}
	meta := &types.TokenCountMeta{CombineText: "please include vip_block"}
	checkedScopes := make(map[string]struct{})

	if err := checkPromptSensitiveForRelay(c, info, meta, checkedScopes); err != nil {
		t.Fatalf("default group sensitive check returned %v, want nil", err)
	}

	common.SetContextKey(c, constant.ContextKeyAutoGroup, "vip")
	err := checkPromptSensitiveForRelay(c, info, meta, checkedScopes)
	if err == nil {
		t.Fatal("vip retry sensitive check returned nil, want sensitive error")
	}
	if err.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", err.StatusCode, http.StatusBadRequest)
	}
	if err.GetErrorCode() != types.ErrorCodeSensitiveWordsDetected {
		t.Fatalf("ErrorCode = %s, want %s", err.GetErrorCode(), types.ErrorCodeSensitiveWordsDetected)
	}
	if !types.IsSkipRetryError(err) {
		t.Fatal("sensitive error should skip retry")
	}
	if err := checkPromptSensitiveForRelay(c, info, meta, checkedScopes); err != nil {
		t.Fatalf("same checked scope returned %v, want nil", err)
	}
}

func withControllerSensitiveSettings(t *testing.T, words string, rules string) {
	t.Helper()

	originalRules := setting.GetSensitiveCheckRulesCopy()
	originalWords := setting.GetSensitiveWordsCopy()
	originalCheckEnabled := setting.CheckSensitiveEnabled
	originalPromptEnabled := setting.CheckSensitiveOnPromptEnabled
	t.Cleanup(func() {
		setting.SensitiveWordsFromString(strings.Join(originalWords, "\n"))
		jsonRules, err := common.Marshal(originalRules)
		if err != nil {
			t.Errorf("marshal original sensitive rules: %v", err)
		} else if err := setting.SensitiveCheckRulesFromString(string(jsonRules)); err != nil {
			t.Errorf("restore sensitive rules: %v", err)
		}
		setting.CheckSensitiveEnabled = originalCheckEnabled
		setting.CheckSensitiveOnPromptEnabled = originalPromptEnabled
	})

	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWordsFromString(words)
	if err := setting.SensitiveCheckRulesFromString(rules); err != nil {
		t.Fatalf("SensitiveCheckRulesFromString returned error: %v", err)
	}
}
