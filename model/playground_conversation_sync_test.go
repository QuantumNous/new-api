package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPlaygroundConversationTestDB(t *testing.T) {
	t.Helper()
	old := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PlaygroundConversation{}, &PlaygroundMessage{}))
	DB = db
	t.Cleanup(func() { DB = old })
}

func TestAppendPlaygroundMessagesIdempotentByClientKey(t *testing.T) {
	setupPlaygroundConversationTestDB(t)
	conv := &PlaygroundConversation{UserId: 7, Title: "New chat"}
	require.NoError(t, CreatePlaygroundConversation(conv))

	batch := []PlaygroundMessage{
		{Role: "user", Content: "hello", ClientKey: "k1", Source: "web"},
		{Role: "assistant", Content: "hi there", ClientKey: "k2", Source: "web"},
	}
	inserted, err := AppendPlaygroundMessages(conv.Id, 7, batch)
	require.NoError(t, err)
	require.Len(t, inserted, 2)
	assert.Equal(t, 0, inserted[0].Seq)
	assert.Equal(t, 1, inserted[1].Seq)

	// Retrying the same batch must be a no-op.
	again, err := AppendPlaygroundMessages(conv.Id, 7, batch)
	require.NoError(t, err)
	assert.Empty(t, again)

	// A partially-duplicate batch inserts only the new turn after the tail.
	mixed, err := AppendPlaygroundMessages(conv.Id, 7, []PlaygroundMessage{
		{Role: "assistant", Content: "hi there", ClientKey: "k2"},
		{Role: "user", Content: "next", ClientKey: "k3"},
	})
	require.NoError(t, err)
	require.Len(t, mixed, 1)
	assert.Equal(t, "k3", mixed[0].ClientKey)
	assert.Equal(t, 2, mixed[0].Seq)

	all, err := ListPlaygroundMessages(conv.Id, 7)
	require.NoError(t, err)
	require.Len(t, all, 3)
	assert.Equal(t, []string{"hello", "hi there", "next"}, []string{all[0].Content, all[1].Content, all[2].Content})
}

func TestAppendPlaygroundMessagesRejectsForeignConversation(t *testing.T) {
	setupPlaygroundConversationTestDB(t)
	conv := &PlaygroundConversation{UserId: 7}
	require.NoError(t, CreatePlaygroundConversation(conv))

	_, err := AppendPlaygroundMessages(conv.Id, 8, []PlaygroundMessage{{Role: "user", Content: "steal"}})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestAppendAfterReplaceContinuesSequence(t *testing.T) {
	setupPlaygroundConversationTestDB(t)
	conv := &PlaygroundConversation{UserId: 7}
	require.NoError(t, CreatePlaygroundConversation(conv))
	require.NoError(t, ReplacePlaygroundMessages(conv.Id, 7, []PlaygroundMessage{
		{Role: "user", Content: "a", ClientKey: "a"},
		{Role: "assistant", Content: "b", ClientKey: "b"},
	}))

	inserted, err := AppendPlaygroundMessages(conv.Id, 7, []PlaygroundMessage{{Role: "user", Content: "c", ClientKey: "c"}})
	require.NoError(t, err)
	require.Len(t, inserted, 1)
	assert.Equal(t, 2, inserted[0].Seq)
}

func TestListPlaygroundMessagesPageCursor(t *testing.T) {
	setupPlaygroundConversationTestDB(t)
	conv := &PlaygroundConversation{UserId: 7}
	require.NoError(t, CreatePlaygroundConversation(conv))
	for i := 0; i < 5; i++ {
		_, err := AppendPlaygroundMessages(conv.Id, 7, []PlaygroundMessage{
			{Role: "user", Content: string(rune('a' + i))},
		})
		require.NoError(t, err)
	}

	first, err := ListPlaygroundMessagesPage(conv.Id, 7, 0, 3)
	require.NoError(t, err)
	require.Len(t, first, 3)

	rest, err := ListPlaygroundMessagesPage(conv.Id, 7, first[2].Id, 3)
	require.NoError(t, err)
	require.Len(t, rest, 2)
	assert.Equal(t, "d", rest[0].Content)
	assert.Equal(t, "e", rest[1].Content)

	// Other users see nothing through the cursor either.
	foreign, err := ListPlaygroundMessagesPage(conv.Id, 8, 0, 10)
	require.NoError(t, err)
	assert.Empty(t, foreign)
}

func TestListPlaygroundConversationsSinceAndPinnedOrder(t *testing.T) {
	setupPlaygroundConversationTestDB(t)
	older := &PlaygroundConversation{UserId: 7, Title: "older"}
	require.NoError(t, CreatePlaygroundConversation(older))
	newer := &PlaygroundConversation{UserId: 7, Title: "newer"}
	require.NoError(t, CreatePlaygroundConversation(newer))
	require.NoError(t, DB.Model(older).Update("updated_at", time.Now().Unix()-100).Error)

	changed, err := ListPlaygroundConversationsSince(7, time.Now().Unix()-50, 200)
	require.NoError(t, err)
	require.Len(t, changed, 1)
	assert.Equal(t, "newer", changed[0].Title)

	// Pinning an older thread lifts it above newer unpinned ones.
	older.Pinned = true
	require.NoError(t, UpdatePlaygroundConversation(older))
	require.NoError(t, DB.Model(older).Update("updated_at", time.Now().Unix()-100).Error)
	items, _, err := ListPlaygroundConversations(7, 0, 10)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "older", items[0].Title)
	assert.True(t, items[0].Pinned)
}
