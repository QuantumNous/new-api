package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelSettingsSchemaIncludesRelaykitDiscoveryConfiguration(t *testing.T) {
	require.NoError(t, parseModels("../../relaykit/dto"))
	require.Contains(t, modelTypes, "ChannelSettings")
	schema := structToSchema(modelTypes["ChannelSettings"])
	properties := schema["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"type": "string"}, properties["proxy"])
	assert.Equal(t, map[string]interface{}{"type": "string"}, properties["task_plugin_key"])
	require.Contains(t, modelTypes, "ChannelOtherSettings")
	other := structToSchema(modelTypes["ChannelOtherSettings"])["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"$ref": "#/components/schemas/AdvancedCustomConfig"}, other["advanced_custom"])
}

func TestEmbeddedTokenSchemaPreservesFieldsAndAutoGroupOverride(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "token.go"), []byte("package fixture\ntype EmbeddedToken struct { Name string `json:\"name\"`; AutoGroups string `json:\"auto_groups\"` }\ntype TokenEnvelope struct { *EmbeddedToken; AutoGroups []string `json:\"auto_groups\"` }\n"), 0600))
	require.NoError(t, parseModels(dir))
	schema := structToSchema(modelTypes["TokenEnvelope"])
	properties := schema["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"type": "string"}, properties["name"])
	assert.Equal(t, map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}}, properties["auto_groups"])
}
