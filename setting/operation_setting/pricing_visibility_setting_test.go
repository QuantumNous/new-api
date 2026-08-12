package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func withHiddenModels(t *testing.T, value string) {
	t.Helper()
	previous := pricingVisibilitySetting.HiddenModels
	t.Cleanup(func() { pricingVisibilitySetting.HiddenModels = previous })
	pricingVisibilitySetting.HiddenModels = value
}

func TestIsPricingHiddenModelExactMatch(t *testing.T) {
	withHiddenModels(t, "gpt-4o,claude-opus-4-8")

	require.True(t, IsPricingHiddenModel("gpt-4o"))
	require.True(t, IsPricingHiddenModel("claude-opus-4-8"))
	require.False(t, IsPricingHiddenModel("gpt-4o-mini"))
	require.False(t, IsPricingHiddenModel("gpt-4"))
}

func TestIsPricingHiddenModelIgnoresBlanksAndCase(t *testing.T) {
	withHiddenModels(t, "  GPT-4O ,, \n claude-opus-4-8  ")

	require.True(t, IsPricingHiddenModel("gpt-4o"))
	require.True(t, IsPricingHiddenModel("GPT-4o"))
	require.True(t, IsPricingHiddenModel("claude-opus-4-8"))
	require.False(t, IsPricingHiddenModel(""))
}

func TestIsPricingHiddenModelWildcard(t *testing.T) {
	withHiddenModels(t, "gpt-4o*,*-internal,*test*")

	require.True(t, IsPricingHiddenModel("gpt-4o"))
	require.True(t, IsPricingHiddenModel("gpt-4o-mini"))
	require.True(t, IsPricingHiddenModel("foo-internal"))
	require.True(t, IsPricingHiddenModel("my-test-model"))
	require.False(t, IsPricingHiddenModel("gpt-4"))
	require.False(t, IsPricingHiddenModel("internal-foo"))
}

func TestIsPricingHiddenModelMatchAllWildcard(t *testing.T) {
	withHiddenModels(t, "*")

	require.True(t, IsPricingHiddenModel("anything"))
}

func TestIsPricingHiddenModelEmptyConfigHidesNothing(t *testing.T) {
	withHiddenModels(t, "")

	require.False(t, IsPricingHiddenModel("gpt-4o"))

	withHiddenModels(t, "   ,  , ")
	require.False(t, IsPricingHiddenModel("gpt-4o"))
}
