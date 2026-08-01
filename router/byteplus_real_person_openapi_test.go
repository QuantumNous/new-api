package router

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestBytePlusRealPersonOpenAPIContract(t *testing.T) {
	relay := readOpenAPIDocument(t, "../docs/openapi/relay.json")
	admin := readOpenAPIDocument(t, "../docs/openapi/api.json")

	require.Equal(t, "3.0.1", relay["openapi"])
	require.Equal(t, "3.0.1", admin["openapi"])

	servers := relay["servers"].([]any)
	require.NotEmpty(t, servers)
	require.Equal(t, "https://router.flatkey.ai", openAPIObject(t, servers[0])["url"])

	adminPaths := openAPIObject(t, admin["paths"])
	requiredPaths := map[string][]string{
		"/v1/real-persons":                                        {"post", "get"},
		"/v1/real-persons/{person_id}":                            {"get"},
		"/v1/real-persons/{person_id}/verification-sessions":      {"post"},
		"/v1/real-persons/{person_id}/assets":                     {"post", "get"},
		"/v1/assets/{asset_id}":                                   {"get", "delete"},
		"/v1/real-person-verifications/callback/{callback_token}": {"get", "post"},
	}
	for path, methods := range requiredPaths {
		require.NotContains(t, adminPaths, path, "admin OpenAPI must not expose relay-only path %s", path)
		for _, method := range methods {
			requireOpenAPIOperation(t, relay, path, method)
		}
	}

	createProfile := requireOpenAPIOperation(t, relay, "/v1/real-persons", "post")
	requireBearerSecurity(t, createProfile)
	requireRequiredHeader(t, createProfile, "Idempotency-Key")
	requireRequestContentType(t, createProfile, "application/json")

	listProfiles := requireOpenAPIOperation(t, relay, "/v1/real-persons", "get")
	requireBearerSecurity(t, listProfiles)

	getProfile := requireOpenAPIOperation(t, relay, "/v1/real-persons/{person_id}", "get")
	requireBearerSecurity(t, getProfile)

	reverify := requireOpenAPIOperation(t, relay, "/v1/real-persons/{person_id}/verification-sessions", "post")
	requireBearerSecurity(t, reverify)
	requireRequiredHeader(t, reverify, "Idempotency-Key")

	createAsset := requireOpenAPIOperation(t, relay, "/v1/real-persons/{person_id}/assets", "post")
	requireBearerSecurity(t, createAsset)
	requireRequiredHeader(t, createAsset, "Idempotency-Key")
	requireRequestContentType(t, createAsset, "application/json")
	multipart := requireRequestContentType(t, createAsset, "multipart/form-data")
	multipartSchema := openAPIObject(t, multipart["schema"])
	require.ElementsMatch(t, []any{"file", "asset_type"}, multipartSchema["required"])
	multipartProperties := openAPIObject(t, multipartSchema["properties"])
	require.Contains(t, multipartProperties, "name")
	fileProperty := openAPIObject(t, multipartProperties["file"])
	require.Equal(t, "string", fileProperty["type"])
	require.Equal(t, "binary", fileProperty["format"])

	listAssets := requireOpenAPIOperation(t, relay, "/v1/real-persons/{person_id}/assets", "get")
	requireBearerSecurity(t, listAssets)

	getAsset := requireOpenAPIOperation(t, relay, "/v1/assets/{asset_id}", "get")
	requireBearerSecurity(t, getAsset)

	deleteAsset := requireOpenAPIOperation(t, relay, "/v1/assets/{asset_id}", "delete")
	requireBearerSecurity(t, deleteAsset)
	requireResponseStatus(t, deleteAsset, "204")

	for _, method := range []string{"get", "post"} {
		callback := requireOpenAPIOperation(t, relay, "/v1/real-person-verifications/callback/{callback_token}", method)
		requireExplicitNoSecurity(t, callback)
		requireResponseStatus(t, callback, "204")
	}

	schemas := openAPIObject(t, openAPIObject(t, relay["components"])["schemas"])
	for _, schemaName := range []string{
		"BytePlusRealPersonCreateRequest",
		"BytePlusRealPerson",
		"BytePlusRealPersonList",
		"BytePlusRealPersonAssetCreateRequest",
		"BytePlusRealPersonAssetList",
		"BytePlusAsset",
	} {
		require.Contains(t, schemas, schemaName)
	}

	bytePlusAsset := openAPIObject(t, schemas["BytePlusAsset"])
	bytePlusAssetProperties := openAPIObject(t, bytePlusAsset["properties"])
	for _, propertyName := range []string{"id", "object", "asset_type", "status", "name", "asset_uri", "failure_code", "created_at"} {
		require.Contains(t, bytePlusAssetProperties, propertyName)
	}
	require.NotContains(t, bytePlusAsset["required"], "moderation")

	forbiddenPublicProperties := map[string]bool{
		"upstream_group_id": true,
		"group_id":          true,
		"channel_id":        true,
		"upstream_asset_id": true,
		"byted_token":       true,
		"h5_link":           true,
		"callback_token":    true,
		"tos_url":           true,
		"object_key":        true,
		"source_url":        true,
		"signed_url":        true,
		"project_name":      true,
		"access_key_id":     true,
		"secret_access_key": true,
	}
	for _, propertyName := range collectOpenAPIPropertyNames(schemas) {
		require.False(t, forbiddenPublicProperties[propertyName], "public schema leaks internal property %q", propertyName)
	}
}

func readOpenAPIDocument(t *testing.T, path string) map[string]any {
	t.Helper()

	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	var document map[string]any
	require.NoError(t, common.Unmarshal(raw, &document))
	return document
}

func openAPIObject(t *testing.T, value any) map[string]any {
	t.Helper()

	object, ok := value.(map[string]any)
	require.True(t, ok, "expected OpenAPI object, got %T", value)
	return object
}

func requireOpenAPIOperation(t *testing.T, document map[string]any, path string, method string) map[string]any {
	t.Helper()

	paths := openAPIObject(t, document["paths"])
	pathObject, ok := paths[path]
	require.True(t, ok, "missing path %s", path)
	operation, ok := openAPIObject(t, pathObject)[method]
	require.True(t, ok, "missing %s %s", method, path)
	return openAPIObject(t, operation)
}

func requireBearerSecurity(t *testing.T, operation map[string]any) {
	t.Helper()

	security, ok := operation["security"].([]any)
	require.True(t, ok, "operation must explicitly define BearerAuth security")
	require.Len(t, security, 1)
	scheme := openAPIObject(t, security[0])
	require.Contains(t, scheme, "BearerAuth")
	require.Empty(t, scheme["BearerAuth"])
}

func requireExplicitNoSecurity(t *testing.T, operation map[string]any) {
	t.Helper()

	security, ok := operation["security"].([]any)
	require.True(t, ok, "operation must explicitly disable inherited security")
	require.Empty(t, security)
}

func requireRequiredHeader(t *testing.T, operation map[string]any, name string) {
	t.Helper()

	parameters, ok := operation["parameters"].([]any)
	require.True(t, ok, "operation must define parameters")
	for _, parameter := range parameters {
		parameterObject := openAPIObject(t, parameter)
		if parameterObject["in"] == "header" && parameterObject["name"] == name {
			require.Equal(t, true, parameterObject["required"])
			schema := openAPIObject(t, parameterObject["schema"])
			require.Equal(t, float64(1), schema["minLength"])
			require.Equal(t, float64(255), schema["maxLength"])
			return
		}
	}
	require.Failf(t, "missing required header", "missing required header %s", name)
}

func requireRequestContentType(t *testing.T, operation map[string]any, contentType string) map[string]any {
	t.Helper()

	requestBody := openAPIObject(t, operation["requestBody"])
	content := openAPIObject(t, requestBody["content"])
	mediaType, ok := content[contentType]
	require.True(t, ok, "missing request content type %s", contentType)
	return openAPIObject(t, mediaType)
}

func requireResponseStatus(t *testing.T, operation map[string]any, status string) map[string]any {
	t.Helper()

	responses := openAPIObject(t, operation["responses"])
	response, ok := responses[status]
	require.True(t, ok, "missing response status %s", status)
	return openAPIObject(t, response)
}

func collectOpenAPIPropertyNames(value any) []string {
	var names []string
	var walk func(any)
	walk = func(current any) {
		switch typed := current.(type) {
		case map[string]any:
			if properties, ok := typed["properties"].(map[string]any); ok {
				for name := range properties {
					names = append(names, name)
				}
			}
			for _, child := range typed {
				walk(child)
			}
		case []any:
			for _, child := range typed {
				walk(child)
			}
		}
	}
	walk(value)
	return names
}
