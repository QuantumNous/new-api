package main

import (
	"fmt"
	"strings"
)

// These scopes mirror RequireSecurityProof calls in the resolved controllers
// and channel-key middleware. Flow completion handlers consume the flow token,
// not a new proof, and must not be included here.
func enrichSecurityContracts(paths, components map[string]interface{}) {
	scopes := map[string][]string{
		"GetChannelKey":         {"channel.key.read"},
		"PasskeyRegisterBegin":  {"passkey.register"},
		"PasskeyDelete":         {"passkey.delete"},
		"Setup2FA":              {"2fa.setup"},
		"Disable2FA":            {"2fa.disable"},
		"RegenerateBackupCodes": {"2fa.backup_codes.regenerate"},
		"GenerateAccessToken":   {"access_token.generate"},
		"RevokeAccessToken":     {"access_token.revoke"},
		"EmailBindStart":        {"account.binding.bind"},
		"WeChatBind":            {"account.binding.bind"},
		"UnbindCustomOAuth":     {"account.binding.unbind"},
		"DeleteSelf":            {"account.delete"},
		"UpdateSelf":            {"account.password.set", "account.password.change"},
		"GenerateOAuthCode":     {"account.binding.bind"},
	}
	schemes := map[string]interface{}{
		"AccessToken1":      map[string]interface{}{"type": "http", "scheme": "bearer", "bearerFormat": "JWT or PAT", "description": "Dashboard access JWT or personal access token; relay tokens are not accepted."},
		"RelayToken":        map[string]interface{}{"type": "http", "scheme": "bearer", "description": "Relay API token (not a dashboard access JWT or PAT)."},
		"RefreshCookieAuth": map[string]interface{}{"type": "apiKey", "in": "cookie", "name": "new_api_refresh", "description": "HttpOnly session refresh cookie; subject to the session-cookie origin guard."},
	}
	components["securitySchemes"] = schemes
	schemes["DashboardSession"] = map[string]interface{}{"type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "Access JWT identifying an active dashboard login session; a personal access token is not sufficient."}
	schemes["SecurityProof"] = map[string]interface{}{"type": "apiKey", "in": "header", "name": "X-Security-Proof", "description": "Single-use verification proof bound to the dashboard session, operation scope and operation context."}
	for _, route := range routes {
		path, _ := paths[route.Path].(map[string]interface{})
		op, _ := path[strings.ToLower(route.Method)].(map[string]interface{})
		if op == nil {
			continue
		}
		switch route.AuthMode {
		case "dashboard":
			op["security"] = defaultSecurity()
		case "relay":
			op["security"] = []interface{}{map[string]interface{}{"RelayToken": []interface{}{}}}
		case "optional":
			op["security"] = append(defaultSecurity(), map[string]interface{}{})
		default:
			op["security"] = []interface{}{}
		}
		if route.HandlerName == "RefreshAuth" {
			op["security"] = []interface{}{map[string]interface{}{"RefreshCookieAuth": []interface{}{}}}
		}
		switch route.HandlerName {
		case "GetLoginSessions", "DeleteLoginSession", "RevokeOtherLoginSessions":
			op["security"] = []interface{}{map[string]interface{}{"DashboardSession": []interface{}{}}}
		}
		allowed, ok := scopes[route.HandlerName]
		if !ok {
			continue
		}
		condition := ""
		if route.HandlerName == "UpdateSelf" {
			condition = "Required only when setting or changing the account password."
		}
		if route.HandlerName == "GenerateOAuthCode" {
			condition = "Required only for an account-binding flow."
		}
		required := condition == ""
		parameters, _ := op["parameters"].([]interface{})
		filtered := []interface{}{}
		for _, parameter := range parameters {
			entry, _ := parameter.(map[string]interface{})
			if entry["name"] == "X-Security-Proof" && entry["in"] == "header" {
				continue
			}
			filtered = append(filtered, parameter)
		}
		op["parameters"] = append(filtered, map[string]interface{}{"name": "X-Security-Proof", "in": "header", "required": required, "schema": map[string]interface{}{"type": "string"}, "description": "Verification proof for " + strings.Join(allowed, " or ") + ". " + condition})
		metadata := map[string]interface{}{"scopes": allowed, "single_use": true, "dashboard_session_required": true}
		if condition != "" {
			metadata["condition"] = condition
		}
		if route.HandlerName == "GetChannelKey" {
			metadata["context"] = map[string]interface{}{"channel_id": "path.id"}
		}
		op["x-security-proof"] = metadata
		if required {
			op["security"] = []interface{}{map[string]interface{}{"DashboardSession": []interface{}{}, "SecurityProof": []interface{}{}}}
		}
		responses, _ := op["responses"].(map[string]interface{})
		if forbidden, ok := responses["403"].(map[string]interface{}); ok {
			forbidden["x-error-codes"] = []string{"SECURITY_PROOF_REQUIRED", "SECURITY_PROOF_INVALID", "SECURITY_PROOF_EXPIRED", "SECURITY_PROOF_SCOPE_MISMATCH", "SECURITY_PROOF_CONTEXT_MISMATCH", "SECURITY_PROOF_METHOD_MISMATCH", "SECURITY_PROOF_CONSUMED", "SECURITY_METHOD_UNAVAILABLE", "SECURITY_ACTION_FORBIDDEN"}
		}
	}
}

func validateSecurityRequirements(spec map[string]interface{}) error {
	components, _ := spec["components"].(map[string]interface{})
	schemes, _ := components["securitySchemes"].(map[string]interface{})
	requirements := []interface{}{spec["security"]}
	paths, _ := spec["paths"].(map[string]interface{})
	for _, path := range paths {
		for method, operation := range path.(map[string]interface{}) {
			if !isHTTPMethod(method) {
				continue
			}
			requirements = append(requirements, operation.(map[string]interface{})["security"])
		}
	}
	for _, requirement := range requirements {
		alternatives, _ := requirement.([]interface{})
		for _, alternative := range alternatives {
			for name := range alternative.(map[string]interface{}) {
				scheme, ok := schemes[name].(map[string]interface{})
				if !ok {
					return fmt.Errorf("undefined security scheme: %s", name)
				}
				switch scheme["type"] {
				case "http", "apiKey", "oauth2", "openIdConnect":
				default:
					return fmt.Errorf("unsupported security scheme type for %s: %v", name, scheme["type"])
				}
			}
		}
	}
	return nil
}
