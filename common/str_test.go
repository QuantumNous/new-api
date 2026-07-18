package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskSensitiveInfoMasksJSONAndBearerCredentials(t *testing.T) {
	input := `provider failed: {"api_key":"json-secret","access_token":"access-secret"}; Authorization: Bearer bearer-secret`

	masked := MaskSensitiveInfo(input)

	assert.NotContains(t, masked, "json-secret")
	assert.NotContains(t, masked, "access-secret")
	assert.NotContains(t, masked, "bearer-secret")
	assert.Contains(t, masked, "***")
}
