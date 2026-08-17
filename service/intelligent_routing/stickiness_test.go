package intelligent_routing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStickinessStoreReturnsHealthyRouteForSameTaskUntilExpiry(t *testing.T) {
	var store StickinessStore
	now := time.Unix(1000, 0)
	store.RecordAt("session", TaskSummary, StickyRoute{Model: "cached", ChannelID: 7}, now)
	route, ok := store.GetAt("session", TaskSummary, now.Add(10*time.Minute))
	require.True(t, ok)
	assert.Equal(t, "cached", route.Model)
	_, changedTask := store.GetAt("session", TaskCode, now.Add(time.Minute))
	assert.False(t, changedTask)
	_, expired := store.GetAt("session", TaskSummary, now.Add(31*time.Minute))
	assert.False(t, expired)
}

func TestConversationKeyPrefersExplicitSessionAndOtherwiseStaysDeterministic(t *testing.T) {
	explicit := ConversationKey("account", "explicit-session", "ignored")
	assert.Equal(t, ConversationKey("account", "explicit-session", "different"), explicit)
	derived := ConversationKey("account", "", "first user message")
	assert.NotEmpty(t, derived)
	assert.Equal(t, derived, ConversationKey("account", "", "first user message"))
	assert.NotEqual(t, derived, ConversationKey("other-account", "", "first user message"))
}

func TestStickinessStoreInvalidatesAfterTwoConsecutiveValidationFailures(t *testing.T) {
	var store StickinessStore
	store.Record("session", TaskGeneral, StickyRoute{Model: "cached", ChannelID: 7})
	store.RecordValidationFailure("session")
	_, ok := store.Get("session", TaskGeneral)
	require.True(t, ok)
	store.RecordValidationFailure("session")
	_, ok = store.Get("session", TaskGeneral)
	assert.False(t, ok)
}
