package model

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func setupPlaygroundRecordTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	previous := DB
	db, err := gorm.Open(
		sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"),
		&gorm.Config{},
	)
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		DB = previous
	})
	return db
}

func TestPlaygroundRecordMigration(t *testing.T) {
	db := setupPlaygroundRecordTestDB(t)
	require.NoError(t, db.AutoMigrate(&User{}, &PlaygroundRecord{}))
	require.True(t, db.Migrator().HasTable(&PlaygroundRecord{}))
	require.True(t, db.Migrator().HasIndex(&PlaygroundRecord{}, "idx_playground_user_record"))
}

func TestPlaygroundLargeTextDBType(t *testing.T) {
	db := setupPlaygroundRecordTestDB(t)
	require.Equal(t, "TEXT", PlaygroundLargeText("").GormDBDataType(db, &schema.Field{}))
}

func setupPlaygroundRecordTestDBWithUsers(t *testing.T, userIDs ...int) *gorm.DB {
	t.Helper()

	db := setupPlaygroundRecordTestDB(t)
	require.NoError(t, db.AutoMigrate(&User{}, &PlaygroundRecord{}))
	for _, userID := range userIDs {
		require.NoError(t, db.Create(&User{
			Id:       userID,
			Username: fmt.Sprintf("playground-user-%d", userID),
			AffCode:  fmt.Sprintf("playground-aff-%d", userID),
		}).Error)
	}
	return db
}

func samplePlaygroundTurn(userID int, recordID, conversationID string, completedAt int64) *PlaygroundRecord {
	return &PlaygroundRecord{
		UserID:            userID,
		RecordID:          recordID,
		RecordType:        PlaygroundRecordTypeTurn,
		ConversationID:    conversationID,
		UserMessage:       `{"from":"user","versions":[{"content":"hello"}]}`,
		RequestMessages:   `[{"role":"user","content":"hello"}]`,
		AssistantMessage:  `{"from":"assistant","versions":[{"content":"world"}]}`,
		ReasoningContent:  "thinking",
		InputText:         "hello",
		OutputText:        PlaygroundLargeText("world-" + recordID),
		ModelName:         "gpt-test",
		GroupName:         "plg",
		Parameters:        `{"temperature":0.7}`,
		Status:            PlaygroundStatusComplete,
		MessagesSnapshot:  `[{"key":"user"},{"key":"assistant"}]`,
		ClientCompletedAt: completedAt,
	}
}

func TestSavePlaygroundRecordIsIdempotent(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 101)
	record := samplePlaygroundTurn(101, "record-a", "conversation-a", 1000)
	require.NoError(t, SavePlaygroundRecord(record))

	retry := samplePlaygroundTurn(101, "record-a", "conversation-a", 1000)
	retry.OutputText = "updated output"
	require.NoError(t, SavePlaygroundRecord(retry))

	var records []PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ?", 101).Find(&records).Error)
	require.Len(t, records, 1)
	require.Equal(t, "updated output", string(records[0].OutputText))
	require.True(t, records[0].IsLatest)
	require.True(t, records[0].IsCurrent)
}

func TestOlderRetryCannotReplaceLatestSnapshot(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 102)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(102, "new", "conversation-a", 2000)))
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(102, "old", "conversation-a", 1000)))

	current, err := GetCurrentPlaygroundRecord(102)
	require.NoError(t, err)
	require.NotNil(t, current)
	require.Equal(t, "new", current.RecordID)

	var old PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ? AND record_id = ?", 102, "old").First(&old).Error)
	require.False(t, old.IsLatest)
	require.False(t, old.IsCurrent)
	require.Empty(t, old.MessagesSnapshot)
}

func TestNewerTurnReplacesLatestSnapshot(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 103)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(103, "first", "conversation-a", 1000)))
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(103, "second", "conversation-a", 2000)))

	current, err := GetCurrentPlaygroundRecord(103)
	require.NoError(t, err)
	require.Equal(t, "second", current.RecordID)

	var first PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ? AND record_id = ?", 103, "first").First(&first).Error)
	require.False(t, first.IsLatest)
	require.False(t, first.IsCurrent)
	require.Empty(t, first.MessagesSnapshot)
}

func TestNewConversationBecomesCurrentWithoutDiscardingOldLatest(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 104)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(104, "record-a", "conversation-a", 1000)))
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(104, "record-b", "conversation-b", 1000)))

	current, err := GetCurrentPlaygroundRecord(104)
	require.NoError(t, err)
	require.Equal(t, "record-b", current.RecordID)

	var oldConversation PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ? AND record_id = ?", 104, "record-a").First(&oldConversation).Error)
	require.True(t, oldConversation.IsLatest)
	require.False(t, oldConversation.IsCurrent)
	require.NotEmpty(t, oldConversation.MessagesSnapshot)
}

func TestClearKeepsHistoryButRemovesCurrentConversation(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 105)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(105, "turn", "conversation-a", 1000)))
	require.NoError(t, ClearPlaygroundConversation(105, "clear", "conversation-a", 2000))
	require.NoError(t, ClearPlaygroundConversation(105, "clear", "conversation-a", 2000))

	current, err := GetCurrentPlaygroundRecord(105)
	require.NoError(t, err)
	require.Nil(t, current)

	var turn PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ? AND record_id = ?", 105, "turn").First(&turn).Error)
	require.NotEmpty(t, turn.OutputText)
	require.NotEmpty(t, turn.MessagesSnapshot)

	var count int64
	require.NoError(t, DB.Model(&PlaygroundRecord{}).Where("user_id = ?", 105).Count(&count).Error)
	require.EqualValues(t, 2, count)
}

func TestDelayedTurnAfterClearCannotRestoreConversation(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 106)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(106, "turn", "conversation-a", 1000)))
	require.NoError(t, ClearPlaygroundConversation(106, "clear", "conversation-a", 2000))
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(106, "late", "conversation-a", 3000)))

	current, err := GetCurrentPlaygroundRecord(106)
	require.NoError(t, err)
	require.Nil(t, current)

	var delayed PlaygroundRecord
	require.NoError(t, DB.Where("user_id = ? AND record_id = ?", 106, "late").First(&delayed).Error)
	require.False(t, delayed.IsLatest)
	require.False(t, delayed.IsCurrent)
	require.Empty(t, delayed.MessagesSnapshot)
}

func TestPlaygroundRecordUserIsolation(t *testing.T) {
	setupPlaygroundRecordTestDBWithUsers(t, 107, 108)
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(107, "shared", "conversation-a", 1000)))
	require.NoError(t, SavePlaygroundRecord(samplePlaygroundTurn(108, "shared", "conversation-b", 1000)))

	first, err := GetCurrentPlaygroundRecord(107)
	require.NoError(t, err)
	require.Equal(t, "conversation-a", first.ConversationID)

	second, err := GetCurrentPlaygroundRecord(108)
	require.NoError(t, err)
	require.Equal(t, "conversation-b", second.ConversationID)

	var count int64
	require.NoError(t, DB.Model(&PlaygroundRecord{}).Where("record_id = ?", "shared").Count(&count).Error)
	require.EqualValues(t, 2, count)
}
