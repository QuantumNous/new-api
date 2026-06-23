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

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", "216", "", 0, "", 0)
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

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", `"216"`, "", 0, "", 0)
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

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", `"google_liu1124789567"`, "", 0, "", 0)
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

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", " google_liu1124789567 ", "", 0, "", 0)
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

	stat, err = SumUsedQuota(LogTypeConsume, 0, 0, "", "google_liu1124789567", "", 0, "", 0)
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

func TestGetAllLogsFuzzyUsernameMatch(t *testing.T) {
	resetUsageTables(t)
	resetLogFilterTestUser(t, 301)
	resetLogFilterTestUser(t, 302)

	// Current usernames live in the user table.
	mustCreateUsage(t, &User{Id: 301, Username: "google_alice", DisplayName: "Alice", AffCode: "log-filter-301"})
	mustCreateUsage(t, &User{Id: 302, Username: "github_bob", DisplayName: "Bob", AffCode: "log-filter-302"})

	// user 301 has one log under the current name and one under an older name;
	// resolving the keyword through the user table must catch both.
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

	// Partial keyword "google" should fuzzily match every log for user 301
	// (current + historical name, resolved via the user table), and nothing
	// belonging to user 302.
	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "google", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs fuzzy google: %v", err)
	}
	if total != 2 {
		t.Fatalf("fuzzy google total = %d, want 2", total)
	}
	for _, l := range logs {
		if l.UserId != 301 {
			t.Fatalf("fuzzy google matched unexpected user_id %d", l.UserId)
		}
	}

	// Partial keyword "bob" should match only user 302.
	logs, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "bob", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs fuzzy bob: %v", err)
	}
	if total != 1 {
		t.Fatalf("fuzzy bob total = %d, want 1", total)
	}
	if len(logs) != 1 || logs[0].UserId != 302 {
		t.Fatalf("fuzzy bob logs = %+v, want only user_id 302", logs)
	}

	// A keyword matching no username at all returns nothing.
	_, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "no_such_user", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs fuzzy miss: %v", err)
	}
	if total != 0 {
		t.Fatalf("fuzzy miss total = %d, want 0", total)
	}

	// Single-character keywords stay exact to avoid an over-broad leading-wildcard
	// scan: "g" must NOT fuzzily match "google_alice"/"github_bob".
	_, total, err = GetAllLogs(LogTypeConsume, 0, 0, "", "g", "", 0, 20, 0, "", "", "", 0)
	if err != nil {
		t.Fatalf("GetAllLogs single-char keyword: %v", err)
	}
	if total != 0 {
		t.Fatalf("single-char keyword total = %d, want 0 (exact match only)", total)
	}

	// A single-character username is still resolved through the user table, so a
	// log written under the user's previous name is matched via user_id even
	// though the keyword is too short for a fuzzy LIKE.
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
