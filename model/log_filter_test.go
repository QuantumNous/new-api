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
