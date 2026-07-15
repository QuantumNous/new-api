package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// selectChannelKeyFromContext honors a pre-selected index recorded on the
// request context by service.SelectChannelWithLimits; otherwise it falls
// back to channel.GetNextEnabledKey(nil).

func newMultiKeyChannel() *model.Channel {
	return &model.Channel{
		Id:          9501,
		Key:         "key-a\nkey-b\nkey-c",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true},
	}
}

func newEmptyContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("__dummy", 0) // ensure Keys map is initialized
	return c
}

func TestSelectChannelKeyFromContext_PreSelectedIdxHonored(t *testing.T) {
	c := newEmptyContext(t)
	common.SetContextKey(c, constant.ContextKeyChannelPreSelectedKeyIdx, 1)
	ch := newMultiKeyChannel()

	key, idx, err := selectChannelKeyFromContext(c, ch)
	require.NoError(t, err)
	require.Equal(t, 1, idx)
	require.Equal(t, "key-b", key)
}

func TestSelectChannelKeyFromContext_OutOfRangeFallsBack(t *testing.T) {
	c := newEmptyContext(t)
	// An out-of-range pre-selected index must NOT panic or return empty; the
	// helper must fall back to GetNextEnabledKey(nil).
	common.SetContextKey(c, constant.ContextKeyChannelPreSelectedKeyIdx, 99)
	ch := newMultiKeyChannel()

	key, idx, err := selectChannelKeyFromContext(c, ch)
	require.NoError(t, err)
	require.GreaterOrEqual(t, idx, 0)
	require.Less(t, idx, len(ch.GetKeys()))
	require.Contains(t, []string{"key-a", "key-b", "key-c"}, key)
}

func TestSelectChannelKeyFromContext_NonMultiKeyIgnoresContext(t *testing.T) {
	c := newEmptyContext(t)
	// On a non-multi-key channel the pre-selection is meaningless; the helper
	// must still return channel.Key / 0.
	common.SetContextKey(c, constant.ContextKeyChannelPreSelectedKeyIdx, 5)
	ch := &model.Channel{Id: 9502, Key: "single-key"}

	key, idx, err := selectChannelKeyFromContext(c, ch)
	require.NoError(t, err)
	require.Equal(t, 0, idx)
	require.Equal(t, "single-key", key)
}

func TestSelectChannelKeyFromContext_NoContextFallsBack(t *testing.T) {
	c := newEmptyContext(t)
	ch := newMultiKeyChannel()

	key, idx, err := selectChannelKeyFromContext(c, ch)
	require.NoError(t, err)
	require.GreaterOrEqual(t, idx, 0)
	require.Less(t, idx, len(ch.GetKeys()))
	require.Contains(t, []string{"key-a", "key-b", "key-c"}, key)
}
