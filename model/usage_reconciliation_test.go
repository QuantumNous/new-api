package model

import (
	"testing"
)

func resetUsageTables(t *testing.T) {
	t.Helper()
	if err := LOG_DB.Exec("DELETE FROM logs").Error; err != nil {
		t.Fatalf("clean logs: %v", err)
	}
	if err := DB.Exec("DELETE FROM channels").Error; err != nil {
		t.Fatalf("clean channels: %v", err)
	}
	if err := DB.Exec("DELETE FROM abilities").Error; err != nil {
		t.Fatalf("clean abilities: %v", err)
	}
}

func mustCreateUsage(t *testing.T, v interface{}) {
	t.Helper()
	db := DB
	if _, ok := v.(*Log); ok {
		db = LOG_DB
	}
	if err := db.Create(v).Error; err != nil {
		t.Fatalf("create %T: %v", v, err)
	}
}

func TestBlockRunChannelTypes(t *testing.T) {
	types := BlockRunChannelTypes()
	set := map[int]bool{}
	for _, ty := range types {
		set[ty] = true
	}
	for _, want := range []int{100, 101, 102} {
		if !set[want] {
			t.Fatalf("expected blockrun type %d in %v", want, types)
		}
	}
	if set[1] { // type 1 is OpenAI, not blockrun
		t.Fatalf("type 1 should not be a blockrun type: %v", types)
	}
}

func TestGetBlockRunChannels(t *testing.T) {
	resetUsageTables(t)
	mustCreateUsage(t, &Channel{Id: 34, Type: 100, Name: "blockRun-claude-0603", Key: "k1"})
	mustCreateUsage(t, &Channel{Id: 35, Type: 100, Name: "blockRun-openai-0603", Key: "k2"})
	mustCreateUsage(t, &Channel{Id: 99, Type: 1, Name: "plain-openai", Key: "k3"})

	got, err := GetBlockRunChannels()
	if err != nil {
		t.Fatalf("GetBlockRunChannels: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 blockrun channels, got %d (%v)", len(got), got)
	}
	if got[34].Name != "blockRun-claude-0603" || got[34].Type != 100 {
		t.Fatalf("unexpected channel 34: %+v", got[34])
	}
	if _, ok := got[99]; ok {
		t.Fatalf("non-blockrun channel 99 must be excluded")
	}
}

func TestQueryAndCountBlockRunUsageLogs(t *testing.T) {
	resetUsageTables(t)
	mustCreateUsage(t, &Channel{Id: 34, Type: 100, Name: "blockRun-claude-0603", Key: "k1"})
	mustCreateUsage(t, &Channel{Id: 99, Type: 1, Name: "plain-openai", Key: "k3"})

	// in-window consume logs on blockrun channel
	mustCreateUsage(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 1000, ModelName: "m1", PromptTokens: 1})
	mustCreateUsage(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 1500, ModelName: "m2", PromptTokens: 2})
	// excluded: out of window
	mustCreateUsage(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 5000, ModelName: "m3"})
	// excluded: wrong type
	mustCreateUsage(t, &Log{Type: LogTypeError, ChannelId: 34, CreatedAt: 1200, ModelName: "m4"})
	// excluded: non-blockrun channel
	mustCreateUsage(t, &Log{Type: LogTypeConsume, ChannelId: 99, CreatedAt: 1200, ModelName: "m5"})

	ids := []int{34}
	count, err := CountBlockRunUsageLogs(ids, 1000, 2000)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 2 {
		t.Fatalf("count = %d, want 2", count)
	}

	var streamed []string
	if err := StreamBlockRunUsageLogs(ids, 1000, 2000, func(l *Log) error {
		streamed = append(streamed, l.ModelName)
		return nil
	}); err != nil {
		t.Fatalf("stream: %v", err)
	}
	if len(streamed) != 2 || streamed[0] != "m1" || streamed[1] != "m2" {
		t.Fatalf("streamed = %v, want [m1 m2]", streamed)
	}

	paged, err := QueryBlockRunUsageLogsPaged(ids, 1000, 2000, 1, 0)
	if err != nil {
		t.Fatalf("paged: %v", err)
	}
	if len(paged) != 1 || paged[0].ModelName != "m1" {
		t.Fatalf("paged page1 = %v", paged)
	}

	after, err := QueryBlockRunUsageLogsAfterCursor(ids, 1000, 2000, 10, paged[0].CreatedAt, paged[0].Id)
	if err != nil {
		t.Fatalf("cursor page: %v", err)
	}
	if len(after) != 1 || after[0].ModelName != "m2" {
		t.Fatalf("cursor page = %v, want [m2]", after)
	}
}

func TestGetBlockRunEnabledModelChannels(t *testing.T) {
	resetUsageTables(t)
	mustCreateUsage(t, &Channel{Id: 34, Type: 100, Name: "blockRun-llm", Key: "k1"})
	mustCreateUsage(t, &Channel{Id: 35, Type: 102, Name: "blockRun-seedance", Key: "k2"})
	mustCreateUsage(t, &Channel{Id: 99, Type: 1, Name: "plain-openai", Key: "k3"})

	mustCreateUsage(t, &Ability{Group: "default", Model: "anthropic/claude-haiku-4.5", ChannelId: 34, Enabled: true})
	mustCreateUsage(t, &Ability{Group: "vip", Model: "anthropic/claude-haiku-4.5", ChannelId: 34, Enabled: true})
	mustCreateUsage(t, &Ability{Group: "default", Model: "seedance-2.0", ChannelId: 35, Enabled: true})
	mustCreateUsage(t, &Ability{Group: "default", Model: "disabled-blockrun", ChannelId: 34, Enabled: false})
	mustCreateUsage(t, &Ability{Group: "default", Model: "gpt-4o", ChannelId: 99, Enabled: true})

	got, err := GetBlockRunEnabledModelChannels()
	if err != nil {
		t.Fatalf("GetBlockRunEnabledModelChannels: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 blockrun models, got %d: %#v", len(got), got)
	}
	if len(got["anthropic/claude-haiku-4.5"]) != 1 || got["anthropic/claude-haiku-4.5"][0].Id != 34 {
		t.Fatalf("claude channels = %#v", got["anthropic/claude-haiku-4.5"])
	}
	if len(got["seedance-2.0"]) != 1 || got["seedance-2.0"][0].Type != 102 {
		t.Fatalf("seedance channels = %#v", got["seedance-2.0"])
	}
	if _, ok := got["gpt-4o"]; ok {
		t.Fatalf("non-blockrun channel model must be excluded: %#v", got)
	}
	if _, ok := got["disabled-blockrun"]; ok {
		t.Fatalf("disabled blockrun ability must be excluded: %#v", got)
	}
}
