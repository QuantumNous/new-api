package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCustomDomainSettingsNormalizesTheTrustedDomainPolicy(t *testing.T) {
	settings, err := ParseCustomDomainSettings(
		"true",
		" YESCHOY.IO. ",
		"https://yeschoy.com/",
		"7",
		"Sales, partner",
	)
	require.NoError(t, err)
	assert.True(t, settings.Enabled)
	assert.Equal(t, "yeschoy.io", settings.Suffix)
	assert.Equal(t, "https://yeschoy.com", settings.MainOrigin)
	assert.Equal(t, 7, settings.CacheTTLSeconds)
	assert.Contains(t, settings.ReservedLabels, "sales")
	assert.Contains(t, settings.ReservedLabels, "partner")
	assert.Contains(t, settings.ReservedLabels, "www")
}
