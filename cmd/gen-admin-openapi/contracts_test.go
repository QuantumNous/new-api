package main

import (
	"strings"
	"testing"

	adminrouter "github.com/QuantumNous/new-api/router"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminRouteDiscoveryMatchesRegisteredRuntimeRoutes(t *testing.T) {
	routes = nil
	require.NoError(t, parseRoutes("../../router"))
	dedupeRoutes()
	discovered := map[string]bool{}
	for _, route := range routes {
		if strings.HasPrefix(route.Path, "/api/") {
			discovered[route.Method+" "+route.Path] = true
		}
	}
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	adminrouter.SetApiRouter(engine)
	registered := map[string]bool{}
	for _, route := range engine.Routes() {
		path := route.Path
		for _, segment := range strings.Split(path, "/") {
			if strings.HasPrefix(segment, ":") {
				path = strings.ReplaceAll(path, segment, "{"+segment[1:]+"}")
			}
		}
		registered[route.Method+" "+path] = true
	}
	assert.Equal(t, registered, discovered)
	assert.NotContains(t, discovered, "POST /api/option/pricing/adjust")
	assert.NotContains(t, discovered, "GET /api/option/pricing/models/{channel_type}")
	for _, operation := range []string{"GET /api/option/model_pricing", "PATCH /api/option/model_pricing", "POST /api/channel/fetch_models", "POST /api/user/group/batch"} {
		assert.Contains(t, discovered, operation)
	}
}

func TestTokenAutoGroupsSchemaMatchesJSONWireShape(t *testing.T) {
	t.Chdir("../..")
	require.NoError(t, bootstrap())
	for _, typeName := range []string{"tokenRequest", "tokenResponse"} {
		t.Run(typeName, func(t *testing.T) {
			require.Contains(t, modelTypes, typeName)
			properties := structToSchema(modelTypes[typeName])["properties"].(map[string]interface{})
			assert.Equal(t, map[string]interface{}{"type": "string"}, properties["name"])
			assert.Equal(t, map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "nullable": true}, properties["auto_groups"])
		})
	}
}

func TestGeneratedAdminContractsMatchResolvedHandlers(t *testing.T) {
	t.Chdir("../..")
	require.NoError(t, bootstrap())
	paths := map[string]interface{}{}
	applyManifest(paths)
	reconcileRoutes(paths)
	defaultUntypedResponses(paths)
	enrichFromHandlers(paths)
	applyManifestBodies(paths)
	defaultUntypedResponses(paths)
	enrichErrorResponses(paths)
	enrichExplicitContracts(paths)
	components := map[string]interface{}{}
	schemas := buildSchemas()
	enrichGetAPIInitializeSchemas(schemas)
	schemas["GetApiCreateCredentialResponse"] = wrapResponse(map[string]interface{}{"$ref": "#/components/schemas/GetAPICreateCredential"})
	schemas["GetApiCreateCredential"] = structToSchema(modelTypes["GetAPICreateCredential"])
	schemas["GetAPICreateCredential"].(map[string]interface{})["required"] = []string{"user_id", "access_token"}
	normalizeGetAPIErrorSchema(schemas)
	components["schemas"] = schemas
	enrichSecurityContracts(paths, components)
	operation := func(path, method string) map[string]interface{} {
		require.Contains(t, paths, path)
		return paths[path].(map[string]interface{})[method].(map[string]interface{})
	}

	for _, custom := range []struct {
		path, method, operationID string
		statuses                  []string
	}{
		{"/api/getapi/users", "post", "provisionGetApiUser", []string{"201", "400", "401", "403", "404", "409", "503"}},
		{"/api/getapi/users/{user_id}/pat", "post", "initializeGetApiPat", []string{"200", "201", "400", "401", "403", "404", "409", "503"}},
	} {
		op := operation(custom.path, custom.method)
		assert.Equal(t, custom.operationID, op["operationId"])
		assert.Equal(t, defaultSecurity(), op["security"])
		responses := op["responses"].(map[string]interface{})
		assert.Len(t, responses, len(custom.statuses))
		for _, status := range custom.statuses {
			require.Contains(t, responses, status)
			response := responses[status].(map[string]interface{})
			expected := "#/components/schemas/GetApiErrorResponse"
			if custom.path == "/api/getapi/users" && status == "201" {
				expected = "#/components/schemas/GetApiCreateCredentialResponse"
			} else if custom.path == "/api/getapi/users/{user_id}/pat" && (status == "200" || status == "201") {
				expected = "#/components/schemas/GetApiInitializePATResponse"
			}
			assert.Equal(t, expected, extractContentSchema(response)["$ref"])
		}
	}
	for _, path := range []string{"/api/token/"} {
		responses := operation(path, "post")["responses"].(map[string]interface{})
		assert.NotContains(t, responses, "200")
		require.Contains(t, responses, "201")
		schema := responses["201"].(map[string]interface{})["content"].(map[string]interface{})["application/json"].(map[string]interface{})["schema"].(map[string]interface{})
		assert.NotEqual(t, "#/components/schemas/ApiResponse", schema["$ref"])
	}
	createSchema := components["schemas"].(map[string]interface{})["GetAPICreateCredential"].(map[string]interface{})
	assert.Equal(t, []string{"user_id", "access_token"}, createSchema["required"])
	createProperties := createSchema["properties"].(map[string]interface{})
	assert.Contains(t, createProperties, "user_id")
	assert.Contains(t, createProperties, "access_token")
	assert.NotContains(t, createProperties["access_token"].(map[string]interface{}), "writeOnly")
	initSchema := components["schemas"].(map[string]interface{})["GetAPIInitializePATResult"].(map[string]interface{})
	assert.Equal(t, []string{"user_id", "state", "outcome", "access_token"}, initSchema["required"])
	assert.NotContains(t, initSchema["properties"].(map[string]interface{})["access_token"].(map[string]interface{}), "writeOnly")
	initRequest := components["schemas"].(map[string]interface{})["GetAPIInitializePATRequest"].(map[string]interface{})
	assert.Equal(t, []string{"expected_username"}, initRequest["required"])
	assert.Equal(t, map[string]interface{}{"type": "boolean", "default": false}, initRequest["properties"].(map[string]interface{})["apply"])
	assert.NotContains(t, initRequest["properties"], "UserID")
	errorSchema := components["schemas"].(map[string]interface{})["GetApiErrorResponse"].(map[string]interface{})
	errorCode := errorSchema["properties"].(map[string]interface{})["code"].(map[string]interface{})
	assert.Equal(t, getAPIErrorCodes, errorCode["enum"])
	userResponses := operation("/api/user/", "post")["responses"].(map[string]interface{})
	assert.NotContains(t, userResponses, "201")
	require.Contains(t, userResponses, "200")
	userSchema := extractContentSchema(userResponses["200"].(map[string]interface{}))
	userProperties := userSchema["properties"].(map[string]interface{})
	assert.Contains(t, userProperties, "success")
	assert.Contains(t, userProperties, "message")
	assert.NotContains(t, userProperties, "data")
	pricing := operation("/api/option/model_pricing", "patch")
	pricingResponse := pricing["responses"].(map[string]interface{})["200"].(map[string]interface{})
	pricingSchema := extractContentSchema(pricingResponse)
	envelope := pricingSchema["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"type": "boolean"}, envelope["success"])
	data := envelope["data"].(map[string]interface{})["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}}, data["updated_models"])
	effective := operation("/api/user/effective-pricing", "get")
	effectiveSchema := extractContentSchema(effective["responses"].(map[string]interface{})["200"].(map[string]interface{}))
	assert.Equal(t, "#/components/schemas/EffectivePricingResponse", effectiveSchema["$ref"])
	effectiveData := components["schemas"].(map[string]interface{})["EffectivePricingData"].(map[string]interface{})
	effectiveProps := effectiveData["properties"].(map[string]interface{})
	assert.Equal(t, []string{"v1"}, effectiveProps["schema_version"].(map[string]interface{})["enum"])
	assert.Equal(t, []string{"RUB"}, effectiveProps["currency"].(map[string]interface{})["enum"])
	assert.Equal(t, []string{"current_tariff"}, effectiveProps["price_kind"].(map[string]interface{})["enum"])
	groupPrice := components["schemas"].(map[string]interface{})["EffectiveGroupPricing"].(map[string]interface{})
	groupProps := groupPrice["properties"].(map[string]interface{})
	assert.Equal(t, []string{"unit_prices", "formula", "unavailable"}, groupProps["status"].(map[string]interface{})["enum"])
	assert.Equal(t, []string{"token", "task", "per_call"}, groupProps["billing_surface"].(map[string]interface{})["enum"])
	assert.Contains(t, groupPrice["required"], "is_free")
	assert.Contains(t, groupPrice["required"], "tiers")
	assert.Equal(t, "#/components/schemas/EffectivePricingTier", groupProps["tiers"].(map[string]interface{})["items"].(map[string]interface{})["$ref"])
	assert.Equal(t, map[string]interface{}{"type": "boolean"}, groupProps["is_free"])
	assert.Equal(t, []string{"user_group"}, effectiveProps["price_scope"].(map[string]interface{})["enum"])
	tier := components["schemas"].(map[string]interface{})["EffectivePricingTier"].(map[string]interface{})
	tierProps := tier["properties"].(map[string]interface{})
	assert.Contains(t, tier["required"], "unit_prices")
	assert.Equal(t, "#/components/schemas/EffectivePricingTierCondition", tierProps["condition"].(map[string]interface{})["$ref"])
	assert.Equal(t, "#/components/schemas/EffectiveUnitPrice", tierProps["unit_prices"].(map[string]interface{})["items"].(map[string]interface{})["$ref"])
	condition := components["schemas"].(map[string]interface{})["EffectivePricingTierCondition"].(map[string]interface{})
	assert.Equal(t, "#/components/schemas/EffectivePricingTimeWindow", condition["properties"].(map[string]interface{})["time_windows"].(map[string]interface{})["items"].(map[string]interface{})["$ref"])
	sync := operation("/api/models/sync_upstream", "post")
	body := sync["requestBody"].(map[string]interface{})
	assert.Equal(t, true, body["required"])
	schema := body["content"].(map[string]interface{})["application/json"].(map[string]interface{})["schema"].(map[string]interface{})
	assert.ElementsMatch(t, []string{"source_version", "selections"}, schema["required"])
	properties := schema["properties"].(map[string]interface{})
	assert.Equal(t, 1, properties["selections"].(map[string]interface{})["minItems"])
	assert.Equal(t, "#/components/schemas/MetadataSyncSelection", properties["selections"].(map[string]interface{})["items"].(map[string]interface{})["$ref"])
	key := operation("/api/channel/{id}/key", "post")
	assert.Equal(t, []interface{}{map[string]interface{}{"DashboardSession": []interface{}{}, "SecurityProof": []interface{}{}}}, key["security"])
	proof := key["x-security-proof"].(map[string]interface{})
	assert.Equal(t, []string{"channel.key.read"}, proof["scopes"])
	assert.Equal(t, true, proof["single_use"])
	assert.NotContains(t, operation("/api/token/{id}/key", "post"), "x-security-proof")
	selfLogs := operation("/api/log/self", "get")
	var tokenID map[string]interface{}
	for _, parameter := range selfLogs["parameters"].([]interface{}) {
		entry := parameter.(map[string]interface{})
		if entry["name"] == "token_id" && entry["in"] == "query" {
			tokenID = entry
			break
		}
	}
	require.NotNil(t, tokenID)
	assert.Equal(t, false, tokenID["required"])
	assert.Equal(t, map[string]interface{}{"type": "integer", "minimum": 1}, tokenID["schema"])
}

func TestAllGeneratedSecurityReferencesAndAnonymousExceptions(t *testing.T) {
	t.Chdir("../..")
	require.NoError(t, bootstrap())
	paths := map[string]interface{}{}
	reconcileRoutes(paths)
	components := map[string]interface{}{}
	enrichSecurityContracts(paths, components)
	spec := map[string]interface{}{"paths": paths, "components": components, "security": defaultSecurity()}
	require.NoError(t, validateSecurityRequirements(spec))
	for _, tc := range []struct {
		path, method, scheme string
		optional             bool
	}{
		{"/api/user/login", "post", "", false}, {"/api/user/register", "post", "", false}, {"/api/status", "get", "", false},
		{"/api/user/", "post", "AccessToken1", false}, {"/api/channel/", "get", "AccessToken1", false},
		{"/api/user/auth/refresh", "post", "RefreshCookieAuth", false}, {"/api/user/sessions", "get", "DashboardSession", false},
		{"/api/pricing", "get", "AccessToken1", true}, {"/api/oauth/state", "post", "AccessToken1", true},
		{"/api/usage/token/", "get", "RelayToken", false},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			require.Contains(t, paths, tc.path)
			op := paths[tc.path].(map[string]interface{})[tc.method].(map[string]interface{})
			requirements := op["security"].([]interface{})
			if tc.scheme == "" {
				assert.Empty(t, requirements)
				return
			}
			assert.Contains(t, requirements, map[string]interface{}{tc.scheme: []interface{}{}})
			if tc.optional {
				assert.Contains(t, requirements, map[string]interface{}{})
			} else {
				assert.NotContains(t, requirements, map[string]interface{}{})
			}
		})
	}
	spec["security"] = []interface{}{map[string]interface{}{"missing-scheme": []interface{}{}}}
	require.ErrorContains(t, validateSecurityRequirements(spec), "undefined security scheme")
}

func TestLoginAndMetadataSelectionWireContracts(t *testing.T) {
	t.Chdir("../..")
	require.NoError(t, bootstrap())
	schemas := buildSchemas()
	enrichLoginSchemas(schemas)
	// Selection may not have been referenced by a manifest-only bootstrap.
	schemas["MetadataSyncSelection"] = structToSchema(modelTypes["MetadataSyncSelection"])
	enrichMetadataSelectionSchema(schemas)
	session := schemas["LoginSessionData"].(map[string]interface{})
	assert.ElementsMatch(t, []string{"access_token", "token_type", "access_expires_at", "session", "user"}, session["required"])
	properties := session["properties"].(map[string]interface{})
	assert.Equal(t, map[string]interface{}{"type": "string"}, properties["access_token"])
	assert.NotContains(t, properties, "refresh_token")
	assert.NotContains(t, schemas["LoginUser"].(map[string]interface{})["properties"], "password")
	challenge := schemas["LoginChallenge"].(map[string]interface{})
	assert.ElementsMatch(t, []string{"require_verification", "flow_token", "expires_at", "methods"}, challenge["required"])
	assert.Equal(t, []bool{true}, challenge["properties"].(map[string]interface{})["require_verification"].(map[string]interface{})["enum"])
	response := schemas["LoginResponse"].(map[string]interface{})["properties"].(map[string]interface{})["data"].(map[string]interface{})
	assert.Equal(t, []interface{}{map[string]interface{}{"$ref": "#/components/schemas/LoginSessionData"}, map[string]interface{}{"$ref": "#/components/schemas/LoginChallenge"}}, response["oneOf"])
	selection := schemas["MetadataSyncSelection"].(map[string]interface{})
	assert.ElementsMatch(t, []string{"model_name", "record_version"}, selection["required"])
	selectionProperties := selection["properties"].(map[string]interface{})
	for _, name := range []string{"model_name", "record_version"} {
		assert.Equal(t, 1, selectionProperties[name].(map[string]interface{})["minLength"])
	}
	variants := selection["oneOf"].([]interface{})
	create := variants[0].(map[string]interface{})
	update := variants[1].(map[string]interface{})
	assert.Equal(t, []string{"create"}, create["required"])
	assert.Equal(t, []bool{true}, create["properties"].(map[string]interface{})["create"].(map[string]interface{})["enum"])
	assert.Equal(t, []string{"fields"}, update["required"])
	assert.Equal(t, 1, update["properties"].(map[string]interface{})["fields"].(map[string]interface{})["minItems"])
	assert.Equal(t, []bool{false}, update["properties"].(map[string]interface{})["create"].(map[string]interface{})["enum"])
}
