package perfmetrics

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ChannelMetricFixture seals exact known counts for deterministic channel
// success rate testing. It seeds channels and logs in a pristine transaction,
// ensuring tests can depend on stable totals (e.g., channel 5: 14 requests / 13
// successes; channel 6: 2 requests / 1 success).
type ChannelMetricFixture struct {
	DB       *gorm.DB
	channels map[int]*model.Channel // id -> Channel
	cleanup  func()                 // called by Close to delete seeded records
}

// SeedFixture creates channels and logs for deterministic testing. It returns
// a fixture that owns the seeded records and must be closed after the test.
//
// Seeding strategy:
//   - Channel 5 (gpt-4): 10 requests, 9 successes
//   - Channel 5 (claude-3): 4 requests, 4 successes
//   - Channel 6 (gpt-4): 2 requests, 1 success
//   - Total for ch5: 14 requests, 13 successes
//   - Total for ch6: 2 requests, 1 success
//
// All logs are timestamped at test time; channels have fixed IDs.
func SeedFixture(t *testing.T, db *gorm.DB) *ChannelMetricFixture {
	now := time.Now().Unix()
	fixture := &ChannelMetricFixture{
		DB:       db,
		channels: make(map[int]*model.Channel),
	}

	// Seed channels in a transaction.
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	// Create channel 5 (two model configs).
	ch5 := &model.Channel{
		Id:          5,
		Name:        "gpt-4-channel",
		Type:        1,
		Status:      common.ChannelStatusEnabled,
		Key:         "test-key-5",
		Models:      "gpt-4,claude-3-5-sonnet",
		Group:       "default",
		CreatedTime: now,
		TestTime:    now,
	}
	require.NoError(t, tx.Create(ch5).Error)
	fixture.channels[5] = ch5

	// Create channel 6 (single model).
	ch6 := &model.Channel{
		Id:          6,
		Name:        "gpt-4-channel-fallback",
		Type:        1,
		Status:      common.ChannelStatusEnabled,
		Key:         "test-key-6",
		Models:      "gpt-4",
		Group:       "default",
		CreatedTime: now,
		TestTime:    now,
	}
	require.NoError(t, tx.Create(ch6).Error)
	fixture.channels[6] = ch6

	// Seed logs for channel 5, gpt-4: 10 requests, 9 success (1 failure).
	for i := 0; i < 10; i++ {
		status := 200
		if i == 9 {
			status = 500 // failure
		}
		log := &model.Log{
			UserId:       1,
			CreatedAt:    now,
			Type:         model.LogTypeConsume,
			ModelName:    "gpt-4",
			ChannelId:    5,
			ChannelName:  "gpt-4-channel",
			Quota:        100,
			PromptTokens: 50,
			Other:        `{"status":` + string(rune(48+status/100)) + `}`, // rough status marker
		}
		require.NoError(t, tx.Create(log).Error)
	}

	// Seed logs for channel 5, claude-3: 4 requests, 4 success.
	for i := 0; i < 4; i++ {
		log := &model.Log{
			UserId:       1,
			CreatedAt:    now,
			Type:         model.LogTypeConsume,
			ModelName:    "claude-3-5-sonnet",
			ChannelId:    5,
			ChannelName:  "gpt-4-channel",
			Quota:        100,
			PromptTokens: 50,
			Other:        `{"status":2}`, // success marker
		}
		require.NoError(t, tx.Create(log).Error)
	}

	// Seed logs for channel 6, gpt-4: 2 requests, 1 success, 1 failure.
	for i := 0; i < 2; i++ {
		status := 200
		if i == 1 {
			status = 503 // failure
		}
		log := &model.Log{
			UserId:       1,
			CreatedAt:    now,
			Type:         model.LogTypeConsume,
			ModelName:    "gpt-4",
			ChannelId:    6,
			ChannelName:  "gpt-4-channel-fallback",
			Quota:        100,
			PromptTokens: 50,
			Other:        `{"status":` + string(rune(48+status/100)) + `}`,
		}
		require.NoError(t, tx.Create(log).Error)
	}

	require.NoError(t, tx.Commit().Error)

	// Register cleanup to delete seeded records.
	fixture.cleanup = func() {
		db.Where("id IN ?", []int{5, 6}).Delete(&model.Channel{})
		db.Where("channel_id IN ?", []int{5, 6}).Delete(&model.Log{})
	}

	return fixture
}

// Close deletes all seeded records and is idempotent.
func (f *ChannelMetricFixture) Close() {
	if f.cleanup != nil {
		f.cleanup()
	}
}

// AssertChannelTotals verifies exact request and success counts for a channel.
// It is used to lock in expected deterministic behavior after fixture seeding.
func AssertChannelTotals(t *testing.T, db *gorm.DB, channelID int, wantRequests, wantSuccesses int) {
	var count int64
	require.NoError(t, db.Model(&model.Log{}).
		Where("channel_id = ?", channelID).
		Count(&count).Error)
	require.Equal(t, int64(wantRequests), count, "channel %d request count mismatch", channelID)

	// Success is approximated here as non-failure; adjust based on actual
	// log schema success markers (e.g. status code in Other JSON, or a
	// dedicated success flag).
	var successCount int64
	require.NoError(t, db.Model(&model.Log{}).
		Where("channel_id = ? AND other NOT LIKE ?", channelID, `%"status":5%`).
		Count(&successCount).Error)
	require.Equal(t, int64(wantSuccesses), successCount, "channel %d success count mismatch", channelID)
}

// TestChannelMetricFixtureSeedsCorrectTotals verifies the fixture produces
// deterministic counts as specified in the requirements.
func TestChannelMetricFixtureSeedsCorrectTotals(t *testing.T) {
	// This test uses a live database connection if configured; otherwise it
	// must be run with manual setup. Adjust as needed for your test harness.
	db := model.DB
	if db == nil {
		t.Skip("database not initialized for fixture test")
	}

	fixture := SeedFixture(t, db)
	defer fixture.Close()

	// Channel 5: 14 total, 13 successful
	AssertChannelTotals(t, db, 5, 14, 13)

	// Channel 6: 2 total, 1 successful
	AssertChannelTotals(t, db, 6, 2, 1)
}
