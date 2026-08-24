package groksubscription

import (
	"strings"
	"testing"
)

func TestClassifyForbidden(t *testing.T) {
	cases := []struct {
		name string
		body string
		want ForbiddenCategory
	}{
		{"content policy structured", `{"error":{"code":"content_policy_violation"}}`, ForbiddenContentPolicy},
		{"subscription required", `{"code":"subscription_required","error":"subscription required"}`, ForbiddenAccount},
		{"cli access denied", `{"error":"Access denied"}`, ForbiddenCLICompat},
		{"cli permission_denied fixed prefix", `{"code":"permission_denied","error":"` + cliCompatErrorPrefix + ` for this account"}`, ForbiddenCLICompat},
		{"conflict access-denied vs subscription", `{"error":"Access denied: subscription required for this model"}`, ForbiddenAccount},
		{"unknown fail closed", `{"code":"forbidden","error":"unclassified"}`, ForbiddenUnknown},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyForbidden([]byte(tc.body))
			if got != tc.want {
				t.Fatalf("ClassifyForbidden(%s) = %v, want %v", tc.body, got, tc.want)
			}
		})
	}
}

func TestClassifyForbiddenContentPolicyBeatsAccount(t *testing.T) {
	body := `{"error":{"code":"content_policy_violation","message":"subscription required"}}`
	if got := ClassifyForbidden([]byte(body)); got != ForbiddenContentPolicy {
		t.Fatalf("content policy must outrank account, got %v", got)
	}
}

func TestClassifyForbiddenBarePermissionDeniedNotCLICompat(t *testing.T) {
	body := `{"code":"permission_denied","error":"denied"}`
	if got := ClassifyForbidden([]byte(body)); got == ForbiddenCLICompat {
		t.Fatalf("bare permission_denied must NOT classify as CLI compat")
	}
}

func TestClassifyForbiddenPrefixCaseInsensitive(t *testing.T) {
	// 设计 §8.4：前缀匹配大小写不敏感。上游改大小写时仍须识别为 CLI 兼容性 403。
	body := `{"code":"permission_denied","error":"aCCESS TO THE CHAT ENDPOINT IS DENIED. please ensure you're using the correct credentials. if you believe this is a mistake, please retry"}`
	if got := ClassifyForbidden([]byte(body)); got != ForbiddenCLICompat {
		t.Fatalf("case-mixed fixed prefix must classify as CLI compat, got %v", got)
	}
}

func TestDecideActionEnforcesOnceLimits(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(401, ForbiddenUnknown, st, true); a != ActionRefreshRetryOnce {
		t.Fatalf("401 first = %v, want ActionRefreshRetryOnce", a)
	}
	st.RefreshUsed = true
	if a := DecideAction(401, ForbiddenUnknown, st, true); a != ActionNeedsReauth {
		t.Fatalf("401 after refresh = %v, want ActionNeedsReauth", a)
	}
}

func TestDecideAction429SingleAlt(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(429, ForbiddenUnknown, st, true); a != ActionFailoverAlt {
		t.Fatalf("429 first = %v, want ActionFailoverAlt", a)
	}
	st.AltChannelUsed = true
	if a := DecideAction(429, ForbiddenUnknown, st, true); a != ActionStop {
		t.Fatalf("429 second = %v, want ActionStop", a)
	}
}

func TestDecideAction403Categories(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(403, ForbiddenContentPolicy, st, true); a != ActionReturnPolicyError {
		t.Fatalf("content policy = %v, want ActionReturnPolicyError", a)
	}
	if a := DecideAction(403, ForbiddenCLICompat, st, true); a != ActionOfficialFallbackOnce {
		t.Fatalf("cli compat = %v, want ActionOfficialFallbackOnce", a)
	}
	st.OfficialFallbackUsed = true
	if a := DecideAction(403, ForbiddenCLICompat, st, true); a != ActionStop {
		t.Fatalf("cli compat second = %v, want ActionStop", a)
	}
	if a := DecideAction(403, ForbiddenUnknown, &AttemptState{}, true); a != ActionReturnStable {
		t.Fatalf("unknown 403 = %v, want ActionReturnStable", a)
	}
}

func TestDecideActionNotReplayableNoRetry(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(401, ForbiddenUnknown, st, false); a != ActionStop {
		t.Fatalf("401 not replayable = %v, want ActionStop", a)
	}
}

// TestDecideActionSelfSetContract 锁定副作用不对称的接线契约：
// 429 与 403-Account 分支由 DecideAction 自设 AltChannelUsed（调用方不手动设）；
// 401 与 403-CLICompat 分支不自设（由调用方经 gin context 设置）。
// 删掉任一自设或把不对称"统一"掉，本测试必 FAIL。
func TestDecideActionSelfSetContract(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(429, ForbiddenUnknown, st, true); a != ActionFailoverAlt || !st.AltChannelUsed {
		t.Fatalf("429 failover must self-set AltChannelUsed, got action=%v flag=%v", a, st.AltChannelUsed)
	}
	st2 := &AttemptState{}
	if a := DecideAction(403, ForbiddenAccount, st2, true); a != ActionFailoverAlt || !st2.AltChannelUsed {
		t.Fatalf("403 account failover must self-set AltChannelUsed, got action=%v flag=%v", a, st2.AltChannelUsed)
	}
	st3 := &AttemptState{}
	_ = DecideAction(401, ForbiddenUnknown, st3, true)
	if st3.RefreshUsed {
		t.Fatalf("401 must NOT self-set RefreshUsed (caller sets it via context)")
	}
	st4 := &AttemptState{}
	_ = DecideAction(403, ForbiddenCLICompat, st4, true)
	if st4.OfficialFallbackUsed {
		t.Fatalf("403 cli-compat must NOT self-set OfficialFallbackUsed (caller sets it)")
	}
}

func TestClassifyForbiddenNonJSONFallback(t *testing.T) {
	// HTML 错误页：JSON 解析失败 → 整体 lower 后作为单一 message，短语兜底仍可命中
	html := `<html><body>403 Forbidden: subscription required for this plan</body></html>`
	if got := ClassifyForbidden([]byte(html)); got != ForbiddenAccount {
		t.Fatalf("non-JSON body must still match via fallback message, got %v", got)
	}
	// 无短语命中的非 JSON body 必须 fail-closed 到 Unknown
	if got := ClassifyForbidden([]byte(`<html>gateway error</html>`)); got != ForbiddenUnknown {
		t.Fatalf("unmatched non-JSON body must fail closed, got %v", got)
	}
}

func TestClassifyForbiddenMaxParseBoundary(t *testing.T) {
	// 夹具长度自引用 maxParse，只能锁"边界关系"；64 KiB 绝对值是设计 §8.4 的
	// 防御上限，单列断言防误改（缩到 1<<15 之类测试仍绿但 DoS 面变大）。
	if maxParse != 1<<16 {
		t.Fatalf("maxParse must stay 64 KiB per design §8.4, got %d", maxParse)
	}
	head := `{"error":"`
	tail := `","code":"subscription_required"}`
	pad := strings.Repeat("x", maxParse-len(head)-len(tail))
	exact := head + pad + tail
	if len(exact) != maxParse {
		t.Fatalf("fixture len = %d, want %d", len(exact), maxParse)
	}
	if got := ClassifyForbidden([]byte(exact)); got != ForbiddenAccount {
		t.Fatalf("body of exactly maxParse must be parsed in full, got %v", got)
	}
	// 超限一字节：截断丢掉 tail 末字节 } → JSON 非法 → 整体兜底 message，
	// 只含下划线版 subscription_required（不匹配空格短语）→ fail-closed Unknown。
	over := head + strings.Repeat("x", maxParse-len(head)-len(tail)+1) + tail
	if len(over) != maxParse+1 {
		t.Fatalf("overflow fixture len = %d, want %d", len(over), maxParse+1)
	}
	if got := ClassifyForbidden([]byte(over)); got != ForbiddenUnknown {
		t.Fatalf("content beyond maxParse must be ignored (truncated body fails closed), got %v", got)
	}
}
