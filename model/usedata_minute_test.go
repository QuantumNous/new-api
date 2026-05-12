package model

import "testing"

func TestLogMinuteQuotaDataAggregatesByMinute(t *testing.T) {
	CacheMinuteQuotaDataLock.Lock()
	CacheMinuteQuotaData = make(map[string]*MinuteQuotaData)
	CacheMinuteQuotaDataLock.Unlock()

	LogMinuteQuotaData(7, "alice", "gpt-test", 10, 1710000061, 12)
	LogMinuteQuotaData(7, "alice", "gpt-test", 15, 1710000079, 18)

	CacheMinuteQuotaDataLock.Lock()
	defer CacheMinuteQuotaDataLock.Unlock()

	if len(CacheMinuteQuotaData) != 1 {
		t.Fatalf("expected 1 minute bucket, got %d", len(CacheMinuteQuotaData))
	}

	item := CacheMinuteQuotaData["7-alice-gpt-test-1710000060"]
	if item == nil {
		t.Fatalf("expected bucket at minute timestamp 1710000060")
	}
	if item.EndAt != 1710000120 {
		t.Fatalf("expected end_at 1710000120, got %d", item.EndAt)
	}
	if item.Count != 2 {
		t.Fatalf("expected count 2, got %d", item.Count)
	}
	if item.Quota != 25 {
		t.Fatalf("expected quota 25, got %d", item.Quota)
	}
	if item.TokenUsed != 30 {
		t.Fatalf("expected token_used 30, got %d", item.TokenUsed)
	}
}
