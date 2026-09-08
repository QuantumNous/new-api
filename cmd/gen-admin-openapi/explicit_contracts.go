package main

import (
	"strconv"
	"strings"
)

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
		if route.HandlerName == "ProvisionGetAPIUser" || route.HandlerName == "GetGetAPIUserCredential" {
			enrichGetAPIContract(op, route.HandlerName == "ProvisionGetAPIUser")
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
	statuses := []string{"200", "400", "401", "403", "404", "409", "503"}
	if provision {
		statuses = append(statuses, "201")
	}
	responses := map[string]interface{}{}
	for _, status := range statuses {
		schema := "GetApiErrorResponse"
		if status == "200" || status == "201" {
			schema = "GetApiCredentialResponse"
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
		op["parameters"] = []interface{}{map[string]interface{}{"name": "Idempotency-Key", "in": "header", "required": true, "description": "Must equal external_account_id. Matching replay returns current state, never mints or enables.", "schema": map[string]interface{}{"type": "string"}}}
		op["requestBody"] = map[string]interface{}{"required": true, "content": map[string]interface{}{"application/json": map[string]interface{}{"schema": map[string]interface{}{"$ref": "#/components/schemas/GetApiCreateUserRequest"}}}}
	} else {
		op["operationId"] = "getGetApiUserCredential"
		op["parameters"] = []interface{}{map[string]interface{}{"name": "external_account_id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]+$"}}}
		delete(op, "requestBody")
	}
}
