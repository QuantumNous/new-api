package service

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func TestResolveSensitiveWordsLegacyFallback(t *testing.T) {
	withSensitiveTestSettings(t, "global_block", "")

	match := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"default"},
		ModelCandidates: []string{"gpt-4o"},
	})
	if !match.ShouldCheck || !match.Legacy {
		t.Fatalf("match = %#v, want legacy sensitive check", match)
	}
	if got := strings.Join(match.Words, ","); got != "global_block" {
		t.Fatalf("Words = %q, want global_block", got)
	}
}

func TestResolveSensitiveWordsMatchesGroupAndModelIntersection(t *testing.T) {
	withSensitiveTestSettings(t, "global_block", `{
		"version": 1,
		"rules": [
			{"id":"r-default-gpt","name":"Default GPT","enabled":true,"groups":["default"],"models":["gpt-4o"],"include_global_words":true,"words":["custom_block"]},
			{"id":"r-vip-all","name":"VIP All","enabled":true,"groups":["vip"],"include_global_words":false,"words":["vip_block"]},
			{"id":"r-claude","name":"Claude Regex","enabled":true,"model_regex":["^claude-"],"include_global_words":false,"words":["claude_block"]}
		]
	}`)

	match := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"default"},
		ModelCandidates: []string{"gpt-4o"},
	})
	if !match.ShouldCheck {
		t.Fatalf("match = %#v, want default/gpt rule to apply", match)
	}
	if got := strings.Join(match.Words, ","); got != "global_block,custom_block" {
		t.Fatalf("Words = %q, want global_block,custom_block", got)
	}
	if got := strings.Join(match.RuleIDs, ","); got != "r-default-gpt" {
		t.Fatalf("RuleIDs = %q, want r-default-gpt", got)
	}

	noModelMatch := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"default"},
		ModelCandidates: []string{"llama-3"},
	})
	if noModelMatch.ShouldCheck {
		t.Fatalf("default/llama match = %#v, want no check", noModelMatch)
	}

	noGroupMatch := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"free"},
		ModelCandidates: []string{"gpt-4o"},
	})
	if noGroupMatch.ShouldCheck {
		t.Fatalf("free/gpt match = %#v, want no check", noGroupMatch)
	}

	regexMatch := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"free"},
		ModelCandidates: []string{"claude-3-5-sonnet"},
	})
	if !regexMatch.ShouldCheck || strings.Join(regexMatch.Words, ",") != "claude_block" {
		t.Fatalf("regex match = %#v, want claude_block", regexMatch)
	}
}

func TestResolveSensitiveWordsSupportsWildcardScopeAndCompactBaseModel(t *testing.T) {
	withSensitiveTestSettings(t, "global_block", `{
		"version": 1,
		"rules": [
			{"id":"r-all","name":"All","enabled":true,"include_global_words":false,"words":["all_block"]},
			{"id":"r-compact","name":"Compact Base","enabled":true,"groups":["vip"],"models":["gpt-4o"],"include_global_words":false,"words":["compact_block"]}
		]
	}`)

	scope := ResolveSensitiveCheckScope(nil, &relaycommon.RelayInfo{
		OriginModelName: ratio_setting.WithCompactModelSuffix("gpt-4o"),
		UsingGroup:      "vip",
		TokenGroup:      "vip",
		UserGroup:       "default",
	})
	match := ResolveSensitiveWords(scope)
	if !match.ShouldCheck {
		t.Fatalf("match = %#v, want wildcard and compact-base rules to apply", match)
	}
	if got := strings.Join(match.RuleIDs, ","); got != "r-all,r-compact" {
		t.Fatalf("RuleIDs = %q, want r-all,r-compact", got)
	}
	if got := strings.Join(match.Words, ","); got != "all_block,compact_block" {
		t.Fatalf("Words = %q, want all_block,compact_block", got)
	}
}

func TestResolveSensitiveCheckScopePrefersActualAutoGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyAutoGroup, "vip")

	scope := ResolveSensitiveCheckScope(c, &relaycommon.RelayInfo{
		OriginModelName: ratio_setting.WithCompactModelSuffix("gpt-4o"),
		UsingGroup:      "auto",
		TokenGroup:      "auto",
		UserGroup:       "default",
	})
	if got := strings.Join(scope.EffectiveGroups, ","); got != "vip" {
		t.Fatalf("EffectiveGroups = %q, want vip", got)
	}
	if !containsString(scope.ModelCandidates, "gpt-4o") || !containsString(scope.ModelCandidates, ratio_setting.WithCompactModelSuffix("gpt-4o")) {
		t.Fatalf("ModelCandidates = %#v, want compact and base model candidates", scope.ModelCandidates)
	}
}

func TestResolveSensitiveWordsRespectsGlobalSwitch(t *testing.T) {
	withSensitiveTestSettings(t, "global_block", `{"version":1,"rules":[{"id":"r1","enabled":true,"include_global_words":true}]}`)
	setting.CheckSensitiveEnabled = false

	match := ResolveSensitiveWords(SensitiveCheckScope{
		EffectiveGroups: []string{"default"},
		ModelCandidates: []string{"gpt-4o"},
	})
	if match.ShouldCheck {
		t.Fatalf("match = %#v, want no check when global sensitive switch is disabled", match)
	}
}

func withSensitiveTestSettings(t *testing.T, words string, rules string) {
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
