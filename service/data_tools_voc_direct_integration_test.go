package service

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVOCOpenAPITenantCatalogInspectRunIntegration(t *testing.T) {
	if os.Getenv("VOC_OPENAPI_INTEGRATION") != "1" {
		t.Skip("set VOC_OPENAPI_INTEGRATION=1 with the dedicated tenant key to run")
	}
	require.NotEmpty(t, os.Getenv("VOC_DATA_MCP_SERVICE_KEY"))
	t.Setenv("VOC_DATA_MCP_URL", "https://open.voc.ai/mcp-server")
	t.Setenv("VOC_DATA_MCP_MODE", "direct")
	t.Setenv("VOC_DATA_MCP_AUTH_HEADER", "X-API-Key")
	t.Setenv("VOC_DATA_MCP_CATALOG_TTL_SECONDS", "300")
	t.Setenv("VOC_DATA_MCP_TIMEOUT_SECONDS", "180")
	t.Setenv("FLATKEY_DATA_TOOL_VARIABLE_BASE_MICRO_USD", "12500")
	resetDirectDataToolCatalogCacheForTest()
	t.Cleanup(resetDirectDataToolCatalogCacheForTest)

	catalog, err := ListDataTools(t.Context(), "", "", 1, 24, "")
	require.NoError(t, err)
	require.Equal(t, 1154, catalog.Total)
	require.Equal(t, 1154, catalog.Matched)
	require.Equal(t, 72, len(catalog.Platforms))

	fullCatalog, err := loadDirectDataToolCatalog(t.Context())
	require.NoError(t, err)
	require.Len(t, fullCatalog, catalog.Total)

	checked := assert.New(t)
	seenIDs := make(map[string]struct{}, len(fullCatalog))
	supportedFieldTypes := map[string]struct{}{
		"string":  {},
		"number":  {},
		"integer": {},
		"boolean": {},
		"array":   {},
		"object":  {},
	}
	fieldTypeCounts := make(map[string]int)
	maxFields := 0
	for _, tool := range fullCatalog {
		checked.NotEmpty(tool.Name, "catalog entries must have an id")
		if _, exists := seenIDs[tool.Name]; exists {
			checked.Fail("duplicate tool id", tool.Name)
		}
		seenIDs[tool.Name] = struct{}{}

		inspection, inspectErr := InspectDataTool(t.Context(), tool.Name)
		if !checked.NoError(inspectErr, "inspect %s", tool.Name) {
			continue
		}
		if !checked.NotNil(inspection, "inspect %s", tool.Name) {
			continue
		}
		checked.Equal(tool.Name, inspection.ID)
		checked.Equal("object", inspection.Input.Type)
		checked.Equal("provider_tokens", inspection.Pricing.Model)
		checked.Greater(inspection.FlatkeyPriceUSD, 0.0)
		if len(inspection.Input.Properties) > maxFields {
			maxFields = len(inspection.Input.Properties)
		}
		for fieldName, field := range inspection.Input.Properties {
			_, supported := supportedFieldTypes[field.Type]
			checked.True(
				supported,
				"%s.%s uses unsupported UI field type %q",
				tool.Name,
				fieldName,
				field.Type,
			)
			fieldTypeCounts[field.Type]++
		}
		for _, requiredField := range inspection.Input.Required {
			_, exists := inspection.Input.Properties[requiredField]
			checked.True(
				exists,
				"%s requires missing field %q",
				tool.Name,
				requiredField,
			)
		}
	}
	checked.Len(seenIDs, catalog.Total)
	t.Logf(
		"validated %d unique Open VOC tools; field types=%v; max fields=%d",
		len(seenIDs),
		fieldTypeCounts,
		maxFields,
	)

	inspection, err := InspectDataTool(t.Context(), "blockrun_audio_voices")
	require.NoError(t, err)
	require.Equal(t, "provider_tokens", inspection.Pricing.Model)
	require.Empty(t, inspection.Input.Required)

	result, err := runVOCDataTool(
		t.Context(),
		"blockrun_audio_voices",
		map[string]any{},
		"flatkey-open-voc-integration-readonly",
	)
	require.NoError(t, err)
	require.Equal(t, "blockrun_audio_voices", result.Tool)
	require.Greater(t, result.ResultCount, 0)
	require.NotEmpty(t, result.Output)
	require.Nil(t, result.MeteredUSD)
}
