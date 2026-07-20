package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsFreeTrialGroup(t *testing.T) {
	require.True(t, IsFreeTrialGroup("Subscription"))
	// Keep historical logs and any in-flight key migration on the trial path.
	require.True(t, IsFreeTrialGroup("Free Trial"))
	require.False(t, IsFreeTrialGroup("default"))
}

func TestIsFreeTrialEligibleModel(t *testing.T) {
	require.True(t, IsFreeTrialEligibleModel("gpt-5"))
	require.True(t, IsFreeTrialEligibleModel("chatgpt-4o-latest"))
	require.True(t, IsFreeTrialEligibleModel("gpt-4.1-mini"))

	require.False(t, IsFreeTrialEligibleModel(""))
	require.False(t, IsFreeTrialEligibleModel("claude-sonnet-4"))
	require.False(t, IsFreeTrialEligibleModel("text-embedding-3-large"))
	require.False(t, IsFreeTrialEligibleModel("gpt-image-2"))
}

func TestFilterFreeTrialModels(t *testing.T) {
	models := []string{
		"gpt-5",
		"claude-sonnet-4",
		"chatgpt-4o-latest",
		"gpt-image-2",
		"gpt-5",
	}

	filtered := FilterFreeTrialModels(models)
	require.Equal(t, []string{"gpt-5", "chatgpt-4o-latest"}, filtered)
}
