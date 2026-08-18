package groksubscription

import "testing"

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
