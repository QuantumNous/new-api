package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUsdPerMillionConvertsListPriceWithFloatDivision(t *testing.T) {
	assert.InDelta(t, 0.5, usdPerMillion(1), 1e-12)
	assert.InDelta(t, 0.1, usdPerMillion(0.2), 1e-12)
	assert.InDelta(t, 0, usdPerMillion(0), 1e-12)
}

func TestUsdPerMillionDoesNotCollapseWholeDollarsToZero(t *testing.T) {
	// A whole-dollar list price written as integer `price / 1000 * USD`
	// truncates to 0. Billing treats modelRatio == 0 as a free model, so
	// $1 / 1M tokens must not take that path.
	listPrice := 1
	perMillionScale := 1000
	integerDivision := float64(listPrice / perMillionScale * USD)
	assert.Equal(t, 0.0, integerDivision)
	assert.Greater(t, usdPerMillion(1), 0.0)
	assert.NotEqual(t, integerDivision, usdPerMillion(1))
}

func TestRmbPerMillionConvertsListPriceWithFloatDivision(t *testing.T) {
	assert.InDelta(t, 1.0/1000*RMB, rmbPerMillion(1), 1e-12)
	assert.InDelta(t, 20.0/1000*RMB, rmbPerMillion(20), 1e-12)
}

func TestDefaultPerplexitySonarRatiosUseMillionTokenListPrice(t *testing.T) {
	assert.InDelta(t, usdPerMillion(0.2), defaultModelRatio["llama-3-sonar-small-32k-chat"], 1e-12)
	assert.InDelta(t, usdPerMillion(0.2), defaultModelRatio["llama-3-sonar-small-32k-online"], 1e-12)
	assert.InDelta(t, usdPerMillion(1), defaultModelRatio["llama-3-sonar-large-32k-chat"], 1e-12)
	assert.InDelta(t, usdPerMillion(1), defaultModelRatio["llama-3-sonar-large-32k-online"], 1e-12)
}

func TestDefaultPerplexitySonarLargeRatiosAreNotFree(t *testing.T) {
	require.Contains(t, defaultModelRatio, "llama-3-sonar-large-32k-chat")
	require.Contains(t, defaultModelRatio, "llama-3-sonar-large-32k-online")
	assert.Greater(t, defaultModelRatio["llama-3-sonar-large-32k-chat"], 0.0)
	assert.Greater(t, defaultModelRatio["llama-3-sonar-large-32k-online"], 0.0)
}

func TestDefaultYiRatiosUseMillionTokenListPrice(t *testing.T) {
	assert.InDelta(t, rmbPerMillion(20), defaultModelRatio["yi-large"], 1e-12)
	assert.InDelta(t, rmbPerMillion(1), defaultModelRatio["yi-spark"], 1e-12)
}
