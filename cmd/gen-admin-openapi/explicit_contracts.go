package main

import (
	"strconv"
	"strings"
)

var getAPIErrorCodes = []string{
	"GETAPI_INVALID_REQUEST",
	"AUTH_UNAUTHORIZED",
	"GETAPI_CAPABILITY_DENIED",
	"GETAPI_ACCOUNT_NOT_FOUND",
	"GETAPI_CREATE_CONFLICT",
	"GETAPI_USERNAME_MISMATCH",
	"GETAPI_TARGET_ROLE_DENIED",
	"GETAPI_CREDENTIAL_UNAVAILABLE",
}

func normalizeGetAPIErrorSchema(schemas map[string]interface{}) {
	schema, ok := schemas["GetApiErrorResponse"].(map[string]interface{})
	if !ok {
		schema = map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"success": map[string]interface{}{"type": "boolean", "enum": []bool{false}},
				"code":    map[string]interface{}{"type": "string"},
				"message": map[string]interface{}{"type": "string"},
			},
			"required": []string{"success", "code", "message"},
		}
		schemas["GetApiErrorResponse"] = schema
	}
	properties, _ := schema["properties"].(map[string]interface{})
	if properties == nil {
		properties = map[string]interface{}{}
		schema["properties"] = properties
	}
	code, ok := properties["code"].(map[string]interface{})
	if !ok {
		code = map[string]interface{}{"type": "string"}
		properties["code"] = code
	}
	code["enum"] = append([]string(nil), getAPIErrorCodes...)
}

// AST discovery cannot infer validation expressed in ordinary control flow.
// Keep the native sync preconditions explicit rather than documenting a legacy
// no-body apply operation that the server deliberately rejects.
func enrichExplicitContracts(paths map[string]interface{}) {
	for _, route := range routes {
		path, _ := paths[route.Path].(map[string]interface{})
		op, _ := path[strings.ToLower(route.Method)].(map[string]interface{})
		h := handlers[route.HandlerName]
		if op == nil || h == nil {
			continue
		}
		if h.RespStatus > 200 && h.RespStatus < 300 {
			responses := op["responses"].(map[string]interface{})
			responses[strconv.Itoa(h.RespStatus)] = responses["200"]
			delete(responses, "200")
		}
		if route.HandlerName == "ProvisionGetAPIUser" {
			enrichGetAPIContract(op, true)
		}
		if route.HandlerName == "InitializeGetAPIPAT" {
			enrichGetAPIInitializeContract(op)
		}
		if route.HandlerName == "GetUserLogs" {
			parameters, _ := op["parameters"].([]interface{})
			found := false
			for _, parameter := range parameters {
				entry, _ := parameter.(map[string]interface{})
				if entry["name"] != "token_id" || entry["in"] != "query" {
					continue
				}
				entry["schema"] = map[string]interface{}{"type": "integer", "minimum": 1}
				found = true
			}
			if !found {
				parameters = append(parameters, map[string]interface{}{"name": "token_id", "in": "query", "required": false, "description": "", "schema": map[string]interface{}{"type": "integer", "minimum": 1}})
			}
			op["parameters"] = parameters
		}
		if route.HandlerName == "VerifyLogin" || route.HandlerName == "LoginPasskeyFinish" {
			op["responses"].(map[string]interface{})["200"] = buildResponse(respSpec{Custom: "LoginSessionResponse"})["200"]
		}
		if route.HandlerName == "SyncUpstreamModels" {
			body := op["requestBody"].(map[string]interface{})
			body["required"] = true
			content := body["content"].(map[string]interface{})["application/json"].(map[string]interface{})
			schema := content["schema"].(map[string]interface{})
			schema["required"] = []string{"source_version", "selections"}
			properties := schema["properties"].(map[string]interface{})
			properties["source_version"].(map[string]interface{})["minLength"] = 1
			properties["selections"].(map[string]interface{})["minItems"] = 1
		}
	}
}

func enrichGetAPIInitializeContract(op map[string]interface{}) {
	responses := map[string]interface{}{}
	for _, status := range []string{"200", "201", "400", "401", "403", "404", "409", "503"} {
		schema := "GetApiErrorResponse"
		if status == "200" || status == "201" {
			schema = "GetApiInitializePATResponse"
		}
		response := buildResponse(respSpec{Custom: schema})["200"].(map[string]interface{})
		response["headers"] = map[string]interface{}{"Cache-Control": map[string]interface{}{"schema": map[string]interface{}{"type": "string", "enum": []string{"no-store"}}}}
		responses[status] = response
	}
	op["responses"] = responses
	op["operationId"] = "initializeGetApiPat"
	op["parameters"] = []interface{}{map[string]interface{}{"name": "user_id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "integer", "minimum": 1}}}
	op["requestBody"] = map[string]interface{}{"required": true, "content": map[string]interface{}{"application/json": map[string]interface{}{"schema": map[string]interface{}{"$ref": "#/components/schemas/GetAPIInitializePATRequest"}}}}
}

func enrichGetAPIInitializeSchemas(schemas map[string]interface{}) {
	if request, ok := schemas["GetAPIInitializePATRequest"].(map[string]interface{}); ok {
		request["additionalProperties"] = false
		request["required"] = []string{"expected_username"}
		props := request["properties"].(map[string]interface{})
		request["properties"] = map[string]interface{}{"expected_username": props["expected_username"], "apply": map[string]interface{}{"type": "boolean", "default": false}}
	}
	data := structToSchema(modelTypes["GetAPIInitializePATResult"])
	props := data["properties"].(map[string]interface{})
	props["state"] = map[string]interface{}{"type": "string", "enum": []string{"active", "blocked"}}
	props["outcome"] = map[string]interface{}{"type": "string", "enum": []string{"would_issue", "would_reuse", "issued", "reused", "blocked_no_pat"}}
	props["access_token"] = map[string]interface{}{"type": "string", "nullable": true}
	data["required"] = []string{"user_id", "state", "outcome", "access_token"}
	schemas["GetApiInitializePATResponse"] = wrapResponse(map[string]interface{}{"$ref": "#/components/schemas/GetAPIInitializePATResult"})
	schemas["GetApiInitializePATResponse"].(map[string]interface{})["required"] = []string{"success", "data"}
	schemas["GetAPIInitializePATResult"] = data
	if create, ok := schemas["GetApiCreateUserRequest"].(map[string]interface{}); ok {
		if props, ok := create["properties"].(map[string]interface{}); ok {
			delete(props, "external_account_id")
		}
		create["required"] = []string{"username", "password", "display_name"}
	}
	if cred, ok := schemas["GetApiCredential"].(map[string]interface{}); ok {
		if props, ok := cred["properties"].(map[string]interface{}); ok {
			delete(props, "external_account_id")
		}
		cred["required"] = []string{"user_id", "state", "access_token"}
	}
}

// Login delegates session issuance and challenge creation to non-handler
// functions, so its response cannot be inferred from Login's direct AST calls.
func enrichLoginSchemas(schemas map[string]interface{}) {
	userProperties := map[string]interface{}{}
	for _, name := range []string{"id", "role", "status", "quota", "used_quota", "request_count", "aff_count", "aff_quota", "aff_history_quota", "inviter_id"} {
		userProperties[name] = map[string]interface{}{"type": "integer"}
	}
	for _, name := range []string{"username", "display_name", "email", "github_id", "discord_id", "oidc_id", "wechat_id", "telegram_id", "group", "aff_code", "linux_do_id", "setting", "stripe_customer", "sidebar_modules"} {
		userProperties[name] = map[string]interface{}{"type": "string"}
	}
	userProperties["has_password"] = map[string]interface{}{"type": "boolean"}
	userProperties["permissions"] = map[string]interface{}{"type": "object", "additionalProperties": true}
	schemas["LoginUser"] = map[string]interface{}{"type": "object", "properties": userProperties, "required": []string{"id", "username", "role", "status"}}
	session := structToSchema(modelTypes["AuthBundle"])
	props := session["properties"].(map[string]interface{})
	props["user"] = map[string]interface{}{"$ref": "#/components/schemas/LoginUser"}
	session["required"] = []string{"access_token", "token_type", "access_expires_at", "session", "user"}
	schemas["LoginSessionData"] = session
	challenge := structToSchema(modelTypes["LoginChallenge"])
	challenge["required"] = []string{"require_verification", "flow_token", "expires_at", "methods"}
	challenge["properties"].(map[string]interface{})["require_verification"].(map[string]interface{})["enum"] = []bool{true}
	schemas["LoginChallenge"] = challenge
	schemas["LoginSessionView"] = structToSchema(modelTypes["LoginSessionView"])
	schemas["VerificationMethodOption"] = structToSchema(modelTypes["VerificationMethodOption"])
	schemas["LoginResponse"] = wrapResponse(map[string]interface{}{"oneOf": []interface{}{
		map[string]interface{}{"$ref": "#/components/schemas/LoginSessionData"},
		map[string]interface{}{"$ref": "#/components/schemas/LoginChallenge"},
	}})
	schemas["LoginSessionResponse"] = wrapResponse(map[string]interface{}{"$ref": "#/components/schemas/LoginSessionData"})
}

func enrichMetadataSelectionSchema(schemas map[string]interface{}) {
	selection := schemas["MetadataSyncSelection"].(map[string]interface{})
	selection["required"] = []string{"model_name", "record_version"}
	properties := selection["properties"].(map[string]interface{})
	properties["model_name"].(map[string]interface{})["minLength"] = 1
	properties["model_name"].(map[string]interface{})["pattern"] = `\S`
	properties["record_version"].(map[string]interface{})["minLength"] = 1
	fields := properties["fields"].(map[string]interface{})
	fields["items"].(map[string]interface{})["enum"] = []string{"description", "icon", "tags", "vendor", "endpoints", "name_rule", "status"}
	fields["nullable"] = true // creating a model does not require a field selection
	selection["oneOf"] = []interface{}{
		map[string]interface{}{"required": []string{"create"}, "properties": map[string]interface{}{"create": map[string]interface{}{"type": "boolean", "enum": []bool{true}}}},
		map[string]interface{}{"required": []string{"fields"}, "properties": map[string]interface{}{
			"create": map[string]interface{}{"type": "boolean", "enum": []bool{false}, "default": false},
			"fields": map[string]interface{}{"type": "array", "minItems": 1, "items": map[string]interface{}{"type": "string"}},
		}},
	}
}

func enrichGetAPIContract(op map[string]interface{}, provision bool) {
	statuses := []string{"400", "401", "403", "404", "409", "503"}
	if provision {
		statuses = append([]string{"201"}, statuses...)
	} else {
		statuses = append([]string{"200"}, statuses...)
	}
	responses := map[string]interface{}{}
	for _, status := range statuses {
		schema := "GetApiErrorResponse"
		if status == "200" || status == "201" {
			schema = "GetApiCreateCredentialResponse"
		}
		response := buildResponse(respSpec{Custom: schema})["200"].(map[string]interface{})
		response["description"] = "Request rejected; no credential material"
		if status == "200" || status == "201" {
			response["description"] = "Current credential snapshot"
		}
		response["headers"] = map[string]interface{}{"Cache-Control": map[string]interface{}{"schema": map[string]interface{}{"type": "string", "enum": []string{"no-store"}}}}
		responses[status] = response
	}
	op["responses"] = responses
	if provision {
		op["operationId"] = "provisionGetApiUser"
		op["parameters"] = []interface{}{}
		op["requestBody"] = map[string]interface{}{"required": true, "content": map[string]interface{}{"application/json": map[string]interface{}{"schema": map[string]interface{}{"$ref": "#/components/schemas/GetApiCreateUserRequest"}}}}
	}
}
