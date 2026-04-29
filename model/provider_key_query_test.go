package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestGetPagedProviderKeysIncludesUsageAndChannels(t *testing.T) {
	setupProviderKeyTestDB(t)

	channelAlpha := &Channel{
		Name:   "alpha",
		Key:    "shared-upstream-key",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	if err := DB.Create(channelAlpha).Error; err != nil {
		t.Fatalf("failed to create alpha channel: %v", err)
	}
	channelBeta := &Channel{
		Name:   "beta",
		Key:    "shared-upstream-key\nsecondary-key",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	if err := DB.Create(channelBeta).Error; err != nil {
		t.Fatalf("failed to create beta channel: %v", err)
	}

	ctx := newProviderKeyLogContextWithCostRatio("shared-upstream-key", "req-provider-key-1", 0.8)
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ChannelId:        channelAlpha.Id,
		ModelName:        "grok-test",
		TokenName:        "unit-test",
		Content:          "provider key request",
		Group:            "default",
		Quota:            100,
		PromptTokens:     10,
		CompletionTokens: 20,
		Other:            map[string]interface{}{},
	})

	providerKey, err := GetOrCreateProviderKey("shared-upstream-key")
	if err != nil {
		t.Fatalf("failed to lookup provider key: %v", err)
	}
	if err := LOG_DB.Create(&Log{
		UserId:        1,
		Username:      "admin",
		CreatedAt:     2,
		Type:          LogTypeError,
		Content:       "error request",
		ModelName:     "grok-test",
		Group:         "default",
		RequestId:     "req-provider-key-2",
		ProviderKeyId: providerKey.Id,
	}).Error; err != nil {
		t.Fatalf("failed to create error log: %v", err)
	}

	items, total, err := GetPagedProviderKeys("", 0, 10)
	if err != nil {
		t.Fatalf("failed to list provider keys: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total=2, got %d", total)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}

	var item *ProviderKeyListItem
	for _, currentItem := range items {
		if currentItem.Id == providerKey.Id {
			item = currentItem
			break
		}
	}
	if item == nil {
		t.Fatalf("failed to find provider key id %d in result set", providerKey.Id)
	}
	if item.Id != providerKey.Id {
		t.Fatalf("expected provider key id %d, got %d", providerKey.Id, item.Id)
	}
	if item.CurrentKey != "shared-upstream-key" {
		t.Fatalf("expected current key to be shared-upstream-key, got %q", item.CurrentKey)
	}
	if item.ChannelCount != 2 {
		t.Fatalf("expected channel count 2, got %d", item.ChannelCount)
	}
	if len(item.Channels) != 2 {
		t.Fatalf("expected 2 linked channels, got %d", len(item.Channels))
	}
	if item.RequestCount != 2 {
		t.Fatalf("expected request count 2, got %d", item.RequestCount)
	}
	if item.SuccessCount != 1 {
		t.Fatalf("expected success count 1, got %d", item.SuccessCount)
	}
	if item.ErrorCount != 1 {
		t.Fatalf("expected error count 1, got %d", item.ErrorCount)
	}
	if item.TotalQuota != 100 {
		t.Fatalf("expected total quota 100, got %d", item.TotalQuota)
	}
	if item.TotalCostQuota != 80 {
		t.Fatalf("expected total cost quota 80, got %d", item.TotalCostQuota)
	}
}

func TestGetPagedProviderKeysIncludesCurrentChannelKeysWithoutLogs(t *testing.T) {
	setupProviderKeyTestDB(t)

	channel := &Channel{
		Name:   "channel-only",
		Key:    "channel-only-key",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	if err := DB.Create(channel).Error; err != nil {
		t.Fatalf("failed to create channel: %v", err)
	}

	items, total, err := GetPagedProviderKeys("", 0, 10)
	if err != nil {
		t.Fatalf("failed to list provider keys: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total=1, got %d", total)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].CurrentKey != "channel-only-key" {
		t.Fatalf("expected current key channel-only-key, got %q", items[0].CurrentKey)
	}
	if items[0].ChannelCount != 1 {
		t.Fatalf("expected channel count 1, got %d", items[0].ChannelCount)
	}
	if items[0].RequestCount != 0 {
		t.Fatalf("expected request count 0, got %d", items[0].RequestCount)
	}
}
