package model

import (
	"testing"
	"time"
)

func TestGetAllLogsFiltersNumericUsernameAsUserID(t *testing.T) {
	resetUsageTables(t)
	resetLogFilterTestUser(t, 216)
	mustCreateUsage(t, &Log{
		UserId:           216,
		Username:         "google_liu1124789567",
		Type:             LogTypeConsume,
		CreatedAt:        1000,
		ModelName:        "gpt-4o",
		Quota:            42,
		PromptTokens:     10,
		CompletionTokens: 5,
	})
	mustCreateUsage(t, &Log{
		UserId:    217,
		Username:  "google_other",
		Type:      LogTypeConsume,
		CreatedAt: 1001,
		ModelName: "gpt-4o",
		Quota:     100,
	})

	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "216", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs: %v", err)
	}
	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].UserId != 216 {
		t.Fatalf("logs = %+v, want only user_id 216", logs)
	}

	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", `"216"`, "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs with quoted username: %v", err)
	}
	if total != 1 {
		t.Fatalf("quoted total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].UserId != 216 {
		t.Fatalf("quoted logs = %+v, want only user_id 216", logs)
	}

	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", `"google_liu1124789567"`, "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs with quoted google username: %v", err)
	}
	if total != 1 {
		t.Fatalf("quoted google username total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].Username != "google_liu1124789567" {
		t.Fatalf("quoted google username logs = %+v, want google_liu1124789567", logs)
	}

	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", " google_liu1124789567 ", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs with padded google username: %v", err)
	}
	if total != 1 {
		t.Fatalf("padded google username total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].Username != "google_liu1124789567" {
		t.Fatalf("padded google username logs = %+v, want google_liu1124789567", logs)
	}

	mustCreateUsage(t, &User{Id: 216, Username: "google_liu1124789567", DisplayName: "刘星宇", AffCode: "log-filter-216"})
	mustCreateUsage(t, &Log{
		UserId:           216,
		Username:         "old_google_username",
		Type:             LogTypeConsume,
		CreatedAt:        1002,
		ModelName:        "gpt-4o",
		Quota:            7,
		PromptTokens:     1,
		CompletionTokens: 1,
	})

	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "google_liu1124789567", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs with current username: %v", err)
	}
	if total != 2 {
		t.Fatalf("current username total = %d, want 2", total)
	}
}

func TestSumUsedQuotaFiltersNumericUsernameAsUserID(t *testing.T) {
	resetUsageTables(t)
	resetLogFilterTestUser(t, 216)
	now := time.Now().Unix()
	mustCreateUsage(t, &Log{
		UserId:           216,
		Username:         "google_liu1124789567",
		Type:             LogTypeConsume,
		CreatedAt:        now,
		ModelName:        "gpt-4o",
		Quota:            42,
		PromptTokens:     10,
		CompletionTokens: 5,
	})
	mustCreateUsage(t, &Log{
		UserId:           217,
		Username:         "google_other",
		Type:             LogTypeConsume,
		CreatedAt:        now,
		ModelName:        "gpt-4o",
		Quota:            100,
		PromptTokens:     100,
		CompletionTokens: 50,
	})

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", "216", "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota: %v", err)
	}
	if stat.Quota != 42 {
		t.Fatalf("quota = %d, want 42", stat.Quota)
	}
	if stat.Rpm != 1 {
		t.Fatalf("rpm = %d, want 1", stat.Rpm)
	}
	if stat.Tpm != 15 {
		t.Fatalf("tpm = %d, want 15", stat.Tpm)
	}

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", `"216"`, "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota with quoted username: %v", err)
	}
	if stat.Quota != 42 {
		t.Fatalf("quoted quota = %d, want 42", stat.Quota)
	}
	if stat.Rpm != 1 {
		t.Fatalf("quoted rpm = %d, want 1", stat.Rpm)
	}
	if stat.Tpm != 15 {
		t.Fatalf("quoted tpm = %d, want 15", stat.Tpm)
	}

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", `"google_liu1124789567"`, "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota with quoted google username: %v", err)
	}
	if stat.Quota != 42 {
		t.Fatalf("quoted google username quota = %d, want 42", stat.Quota)
	}
	if stat.Rpm != 1 {
		t.Fatalf("quoted google username rpm = %d, want 1", stat.Rpm)
	}
	if stat.Tpm != 15 {
		t.Fatalf("quoted google username tpm = %d, want 15", stat.Tpm)
	}

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", " google_liu1124789567 ", "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota with padded google username: %v", err)
	}
	if stat.Quota != 42 {
		t.Fatalf("padded google username quota = %d, want 42", stat.Quota)
	}
	if stat.Rpm != 1 {
		t.Fatalf("padded google username rpm = %d, want 1", stat.Rpm)
	}
	if stat.Tpm != 15 {
		t.Fatalf("padded google username tpm = %d, want 15", stat.Tpm)
	}

	mustCreateUsage(t, &User{Id: 216, Username: "google_liu1124789567", DisplayName: "刘星宇", AffCode: "log-filter-216"})
	mustCreateUsage(t, &Log{
		UserId:           216,
		Username:         "old_google_username",
		Type:             LogTypeConsume,
		CreatedAt:        now,
		ModelName:        "gpt-4o",
		Quota:            7,
		PromptTokens:     1,
		CompletionTokens: 1,
	})

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", "google_liu1124789567", "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota with current username: %v", err)
	}
	if stat.Quota != 49 {
		t.Fatalf("current username quota = %d, want 49", stat.Quota)
	}
	if stat.Rpm != 2 {
		t.Fatalf("current username rpm = %d, want 2", stat.Rpm)
	}
	if stat.Tpm != 17 {
		t.Fatalf("current username tpm = %d, want 17", stat.Tpm)
	}
}

// TestSumUsedQuotaSelfStatIsExactByUserID 锁住越权回归：self stat 用 selfUserId
// 精确约束身份，username 自动模糊化后绝不能把同前缀用户（alice2/malice）的用量
// 统计算进 alice 自己的统计里。
func TestSumUsedQuotaSelfStatIsExactByUserID(t *testing.T) {
	resetUsageTables(t)
	now := time.Now().Unix()
	// 三个用户名互为子串：alice / alice2 / malice。
	mustCreateUsage(t, &Log{
		UserId: 401, Username: "alice", Type: LogTypeConsume, CreatedAt: now,
		ModelName: "gpt-4o", Quota: 10, PromptTokens: 3, CompletionTokens: 2,
	})
	mustCreateUsage(t, &Log{
		UserId: 402, Username: "alice2", Type: LogTypeConsume, CreatedAt: now,
		ModelName: "gpt-4o", Quota: 100, PromptTokens: 30, CompletionTokens: 20,
	})
	mustCreateUsage(t, &Log{
		UserId: 403, Username: "malice", Type: LogTypeConsume, CreatedAt: now,
		ModelName: "gpt-4o", Quota: 1000, PromptTokens: 300, CompletionTokens: 200,
	})

	// self stat：selfUserId=401，username 传空 —— 只能统计到 401 自己的 quota=10。
	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", "", "", 0, "", 0, 401)
	if err != nil {
		t.Fatalf("SumUsedQuota self stat: %v", err)
	}
	if stat.Quota != 10 {
		t.Fatalf("self stat quota = %d, want 10 (must NOT include alice2/malice)", stat.Quota)
	}
	if stat.Rpm != 1 {
		t.Fatalf("self stat rpm = %d, want 1", stat.Rpm)
	}
	if stat.Tpm != 5 {
		t.Fatalf("self stat tpm = %d, want 5", stat.Tpm)
	}

	// 对照：管理员搜索完整用户名 "alice"（selfUserId=0）现在默认精确匹配，
	// 只命中 alice 自己（quota=10），不再把 alice2/malice 带进来。要模糊需显式
	// 输入 %alice% —— 见 TestGetAllLogsExplicitWildcard。
	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", "alice", "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota admin exact: %v", err)
	}
	if stat.Quota != 10 {
		t.Fatalf("admin exact quota = %d, want 10 (exact match, not 1110)", stat.Quota)
	}

	// 显式模糊 %alice% 仍可命中三者：10+100+1000 = 1110。
	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", "%alice%", "", 0, "", 0, 0)
	if err != nil {
		t.Fatalf("SumUsedQuota admin explicit fuzzy: %v", err)
	}
	if stat.Quota != 1110 {
		t.Fatalf("admin explicit fuzzy quota = %d, want 1110 (10+100+1000)", stat.Quota)
	}
}

func TestGetAllLogsExactUsernameMatch(t *testing.T) {
	resetUsageTables(t)
	resetLogFilterTestUser(t, 301)
	resetLogFilterTestUser(t, 302)

	// Current usernames live in the user table.
	mustCreateUsage(t, &User{Id: 301, Username: "google_alice", DisplayName: "Alice", AffCode: "log-filter-301"})
	mustCreateUsage(t, &User{Id: 302, Username: "github_bob", DisplayName: "Bob", AffCode: "log-filter-302"})

	// user 301 has one log under the current name and one under an older name;
	// resolving the EXACT current username through the user table must still
	// catch the renamed-historical log via user_id.
	mustCreateUsage(t, &Log{
		UserId:    301,
		Username:  "google_alice",
		Type:      LogTypeConsume,
		CreatedAt: 2000,
		ModelName: "gpt-4o",
		Quota:     1,
	})
	mustCreateUsage(t, &Log{
		UserId:    301,
		Username:  "old_google_alice",
		Type:      LogTypeConsume,
		CreatedAt: 2001,
		ModelName: "gpt-4o",
		Quota:     1,
	})
	mustCreateUsage(t, &Log{
		UserId:    302,
		Username:  "github_bob",
		Type:      LogTypeConsume,
		CreatedAt: 2002,
		ModelName: "gpt-4o",
		Quota:     1,
	})

	// Exact full username "google_alice" matches BOTH of user 301's logs
	// (current snapshot + renamed-historical via user_id), and nothing of 302.
	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "google_alice", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs exact google_alice: %v", err)
	}
	if total != 2 {
		t.Fatalf("exact google_alice total = %d, want 2", total)
	}
	for _, l := range logs {
		if l.UserId != 301 {
			t.Fatalf("exact google_alice matched unexpected user_id %d", l.UserId)
		}
	}

	// Partial keyword "google" must NOT match anymore — default is exact, no
	// auto substring fuzzy. This is the core #222 regression guard.
	_, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "google", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs partial google: %v", err)
	}
	if total != 0 {
		t.Fatalf("partial google total = %d, want 0 (exact match only)", total)
	}

	// Exact "github_bob" matches only user 302.
	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "github_bob", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs exact github_bob: %v", err)
	}
	if total != 1 {
		t.Fatalf("exact github_bob total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].UserId != 302 {
		t.Fatalf("exact github_bob logs = %+v, want only user_id 302", logs)
	}

	// A username matching nobody returns nothing.
	_, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "no_such_user", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs exact miss: %v", err)
	}
	if total != 0 {
		t.Fatalf("exact miss total = %d, want 0", total)
	}

	// A single-character username is still resolved through the user table, so a
	// log written under the user's previous name is matched via user_id.
	resetLogFilterTestUser(t, 303)
	mustCreateUsage(t, &User{Id: 303, Username: "x", DisplayName: "X", AffCode: "log-filter-303"})
	mustCreateUsage(t, &Log{
		UserId:    303,
		Username:  "old_name_x",
		Type:      LogTypeConsume,
		CreatedAt: 2003,
		ModelName: "gpt-4o",
		Quota:     1,
	})
	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "x", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs single-char exact username: %v", err)
	}
	if total != 1 || len(logs) != 1 || logs[0].UserId != 303 {
		t.Fatalf("single-char exact username logs = %+v / total %d, want 1 log for user 303", logs, total)
	}
}

func TestGetAllLogsExplicitWildcard(t *testing.T) {
	resetUsageTables(t)
	resetLogFilterTestUser(t, 311)
	resetLogFilterTestUser(t, 312)

	mustCreateUsage(t, &User{Id: 311, Username: "google_alice", DisplayName: "Alice", AffCode: "log-filter-311"})
	mustCreateUsage(t, &User{Id: 312, Username: "mygoogle", DisplayName: "My", AffCode: "log-filter-312"})
	mustCreateUsage(t, &Log{
		UserId: 311, Username: "google_alice", Type: LogTypeConsume,
		CreatedAt: 3000, ModelName: "gpt-4o", Quota: 1,
	})
	mustCreateUsage(t, &Log{
		UserId: 312, Username: "mygoogle", Type: LogTypeConsume,
		CreatedAt: 3001, ModelName: "gpt-4o", Quota: 1,
	})

	// Explicit "google%" is a prefix fuzzy: matches "google_alice" (starts with
	// google) but NOT "mygoogle" (no leading wildcard was added by the system).
	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "google%", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs explicit google%%: %v", err)
	}
	if total != 1 || len(logs) != 1 || logs[0].UserId != 311 {
		t.Fatalf("explicit google%% logs = %+v / total %d, want only user 311", logs, total)
	}

	// Explicit leading wildcard "%google" matches the suffix — "mygoogle" only.
	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "%google", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs explicit %%google: %v", err)
	}
	if total != 1 || len(logs) != 1 || logs[0].UserId != 312 {
		t.Fatalf("explicit %%google logs = %+v / total %d, want only user 312", logs, total)
	}
}

func TestGetAllLogsExplicitWildcardOverLimitDegradation(t *testing.T) {
	resetUsageTables(t)
	// Over-limit degradation: when more than fuzzyUsernameUserIDLimit users match
	// the EXPLICIT wildcard keyword in the user table, the user-table resolution
	// returns an empty id set and the query degrades to a pure logs.username LIKE
	// — it must NOT match a renamed user's historical log via user_id.
	origLimit := fuzzyUsernameUserIDLimit
	fuzzyUsernameUserIDLimit = 2
	defer func() { fuzzyUsernameUserIDLimit = origLimit }()
	resetLogFilterTestUser(t, 501)
	resetLogFilterTestUser(t, 502)
	resetLogFilterTestUser(t, 503)
	// 3 users (> limit 2) all match "over_limit_kw" in the user table.
	mustCreateUsage(t, &User{Id: 501, Username: "over_limit_kw_1", DisplayName: "O1", AffCode: "log-filter-501"})
	mustCreateUsage(t, &User{Id: 502, Username: "over_limit_kw_2", DisplayName: "O2", AffCode: "log-filter-502"})
	mustCreateUsage(t, &User{Id: 503, Username: "over_limit_kw_3", DisplayName: "O3", AffCode: "log-filter-503"})
	// user 501 has a log under a renamed (no-keyword) username — only reachable via
	// the user_id补齐 path, which is disabled once the id set is discarded.
	mustCreateUsage(t, &Log{
		UserId: 501, Username: "renamed_no_kw", Type: LogTypeConsume,
		CreatedAt: 5000, ModelName: "gpt-4o", Quota: 1,
	})
	// user 502 has a log whose username snapshot still contains the keyword — this
	// one IS reachable via the degraded pure-LIKE path.
	mustCreateUsage(t, &Log{
		UserId: 502, Username: "over_limit_kw_2", Type: LogTypeConsume,
		CreatedAt: 5001, ModelName: "gpt-4o", Quota: 1,
	})
	// Explicit trailing wildcard triggers the fuzzy path (default text no longer does).
	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "over_limit_kw%", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs over-limit explicit wildcard: %v", err)
	}
	if total != 1 || len(logs) != 1 || logs[0].UserId != 502 {
		t.Fatalf("over-limit explicit wildcard logs = %+v / total %d, want only the LIKE-matched log of user 502", logs, total)
	}
}

func resetLogFilterTestUser(t *testing.T, userID int) {
	t.Helper()
	cleanup := func() {
		if err := DB.Unscoped().Where("id = ?", userID).Delete(&User{}).Error; err != nil {
			t.Fatalf("clean test user %d: %v", userID, err)
		}
	}
	cleanup()
	t.Cleanup(cleanup)
}
