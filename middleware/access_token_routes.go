package middleware

import (
	"fmt"
	"maps"
	"slices"
	"sync"

	"github.com/QuantumNous/new-api/service/authz"
)

type accessTokenRuleKind int

const (
	// accessTokenRuleScope requires the token to carry scope.
	accessTokenRuleScope accessTokenRuleKind = iota + 1
	// accessTokenRuleAny accepts every valid scoped token; the handler applies
	// its own checks.
	accessTokenRuleAny
	// accessTokenRuleSession rejects every access token, legacy ones included.
	accessTokenRuleSession
)

type accessTokenRouteRule struct {
	kind  accessTokenRuleKind
	scope string
}

var (
	accessTokenAnyRule     = accessTokenRouteRule{kind: accessTokenRuleAny}
	accessTokenSessionRule = accessTokenRouteRule{kind: accessTokenRuleSession}
)

func accessTokenScopeRule(scope string) accessTokenRouteRule {
	return accessTokenRouteRule{kind: accessTokenRuleScope, scope: scope}
}

// accessTokenRouteRules declares the token rule of every dashboard route that
// is not guarded by RequirePermission, keyed by method and gin full path.
// Casbin-guarded routes declare themselves through
// DeclareAccessTokenPermissionRoute when they are registered.
var accessTokenRouteRules = map[string]accessTokenRouteRule{
	"GET /api/status/test": accessTokenScopeRule("ops:read"),

	"POST /api/oauth/state":             accessTokenSessionRule,
	"POST /api/oauth/email/bind/start":  accessTokenScopeRule("account_security:write"),
	"POST /api/oauth/email/bind/resend": accessTokenScopeRule("account_security:write"),
	"POST /api/oauth/email/bind":        accessTokenScopeRule("account_security:write"),
	"POST /api/oauth/wechat/bind":       accessTokenScopeRule("account_security:write"),
	"POST /api/oauth/telegram/bind/start": accessTokenSessionRule,
	"GET /api/oauth/:provider":            accessTokenSessionRule,
	"GET /api/verify/methods":             accessTokenAnyRule,
	"POST /api/verify":                    accessTokenAnyRule,

	"GET /api/user/sessions":                accessTokenSessionRule,
	"DELETE /api/user/sessions/:sid":        accessTokenSessionRule,
	"POST /api/user/sessions/revoke-others": accessTokenSessionRule,
	"GET /api/user/self":                    accessTokenScopeRule("profile:read"),
	"PUT /api/user/self":                    accessTokenScopeRule("profile:write"),
	"DELETE /api/user/self":                 accessTokenScopeRule("account_security:write"),
	"GET /api/user/access_tokens":           accessTokenSessionRule,
	"GET /api/user/access_tokens/catalog":   accessTokenSessionRule,
	"GET /api/user/access_tokens/scopes":    accessTokenSessionRule,
	"POST /api/user/access_tokens":          accessTokenSessionRule,
	"PATCH /api/user/access_tokens/:id":     accessTokenSessionRule,
	"DELETE /api/user/access_tokens/:id":    accessTokenSessionRule,
	"DELETE /api/user/access_tokens/legacy": accessTokenSessionRule,
	"GET /api/user/passkey":                 accessTokenScopeRule("account_security:read"),
	"POST /api/user/passkey/register/begin": accessTokenScopeRule("account_security:write"),
	"POST /api/user/passkey/register/finish": accessTokenScopeRule("account_security:write"),
	"POST /api/user/passkey/verify/begin":    accessTokenAnyRule,
	"POST /api/user/passkey/verify/finish":   accessTokenAnyRule,
	"DELETE /api/user/passkey":               accessTokenScopeRule("account_security:write"),
	"GET /api/user/2fa/status":               accessTokenScopeRule("account_security:read"),
	"POST /api/user/2fa/setup":               accessTokenScopeRule("account_security:write"),
	"POST /api/user/2fa/enable":              accessTokenScopeRule("account_security:write"),
	"POST /api/user/2fa/disable":             accessTokenScopeRule("account_security:write"),
	"POST /api/user/2fa/backup_codes":        accessTokenScopeRule("account_security:write"),
	"GET /api/user/oauth/bindings":           accessTokenScopeRule("account_security:read"),
	"DELETE /api/user/oauth/bindings/:provider_id": accessTokenScopeRule("account_security:write"),

	"GET /api/user/":                       accessTokenScopeRule("user:read"),
	"GET /api/user/search":                 accessTokenScopeRule("user:read"),
	"GET /api/user/:id/oauth/bindings":     accessTokenScopeRule("user:read"),
	"DELETE /api/user/:id/oauth/bindings/:provider_id": accessTokenScopeRule("user:write"),
	"DELETE /api/user/:id/bindings/:binding_type":      accessTokenScopeRule("user:write"),
	"GET /api/user/:id":                    accessTokenScopeRule("user:read"),
	"POST /api/user/":                      accessTokenScopeRule("user:write"),
	"POST /api/user/manage":                accessTokenScopeRule("user:write"),
	"PUT /api/user/":                       accessTokenScopeRule("user:write"),
	"DELETE /api/user/:id":                 accessTokenScopeRule("user:write"),
	"DELETE /api/user/:id/reset_passkey":   accessTokenScopeRule("user:write"),
	"GET /api/user/2fa/stats":              accessTokenScopeRule("user:read"),
	"DELETE /api/user/:id/2fa":             accessTokenScopeRule("user:write"),

	"GET /api/option/":                  accessTokenScopeRule("option:read"),
	"PUT /api/option/":                  accessTokenScopeRule("option:write"),
	"PUT /api/option/passkey/domains":   accessTokenScopeRule("option:write"),
	"POST /api/custom-oauth-provider/discovery": accessTokenScopeRule("option:write"),
	"GET /api/custom-oauth-provider/":           accessTokenScopeRule("option:read"),
	"GET /api/custom-oauth-provider/:id":        accessTokenScopeRule("option:read"),
	"POST /api/custom-oauth-provider/":          accessTokenScopeRule("option:write"),
	"PUT /api/custom-oauth-provider/:id":        accessTokenScopeRule("option:write"),
	"DELETE /api/custom-oauth-provider/:id":     accessTokenScopeRule("option:write"),

	"GET /api/performance/stats":              accessTokenScopeRule("ops:read"),
	"DELETE /api/performance/disk_cache":      accessTokenScopeRule("ops:write"),
	"POST /api/performance/reset_stats":       accessTokenScopeRule("ops:write"),
	"POST /api/performance/gc":                accessTokenScopeRule("ops:write"),
	"GET /api/performance/logs":               accessTokenScopeRule("ops:read"),
	"DELETE /api/performance/logs":            accessTokenScopeRule("ops:write"),
	"POST /api/system-task/log-cleanup":       accessTokenScopeRule("ops:write"),
	"GET /api/system-task/list":               accessTokenScopeRule("ops:read"),
	"DELETE /api/system-task/history":         accessTokenScopeRule("ops:write"),
	"GET /api/system-task/current":            accessTokenScopeRule("ops:read"),
	"GET /api/system-task/:task_id":           accessTokenScopeRule("ops:read"),
	"GET /api/system-info/instances":          accessTokenScopeRule("ops:read"),
	"GET /api/system-info/sync":               accessTokenScopeRule("ops:read"),
	"DELETE /api/system-info/stale-instances": accessTokenScopeRule("ops:write"),
	"DELETE /api/system-info/instances/:node_name": accessTokenScopeRule("ops:write"),

	"GET /api/authz/catalog": accessTokenScopeRule("user:read"),
}

var (
	permissionRouteRulesMu sync.RWMutex
	permissionRouteRules   = map[string]accessTokenRouteRule{}
)

// DeclareAccessTokenPermissionRoute records that the Casbin permission guarding
// a route is also the token scope it requires. It runs while routes are
// registered and panics on conflicting declarations.
func DeclareAccessTokenPermissionRoute(method, fullPath string, permission authz.Permission) {
	key := method + " " + fullPath
	rule := accessTokenScopeRule(service.AccessTokenScopeOf(permission))
	if _, ok := accessTokenRouteRules[key]; ok {
		panic(fmt.Sprintf("access token route %s is declared twice", key))
	}
	permissionRouteRulesMu.Lock()
	defer permissionRouteRulesMu.Unlock()
	if existing, ok := permissionRouteRules[key]; ok && existing != rule {
		panic(fmt.Sprintf("access token route %s is declared with %s and %s", key, existing.scope, rule.scope))
	}
	permissionRouteRules[key] = rule
}

// AccessTokenRouteRule returns the rule for "METHOD /full/path".
func AccessTokenRouteRule(key string) (accessTokenRouteRule, bool) {
	if rule, ok := accessTokenRouteRules[key]; ok {
		return rule, true
	}
	permissionRouteRulesMu.RLock()
	defer permissionRouteRulesMu.RUnlock()
	rule, ok := permissionRouteRules[key]
	return rule, ok
}

// AccessTokenRouteRuleKeys lists every declared route key, sorted.
func AccessTokenRouteRuleKeys() []string {
	permissionRouteRulesMu.RLock()
	keys := slices.Collect(maps.Keys(permissionRouteRules))
	permissionRouteRulesMu.RUnlock()
	keys = slices.AppendSeq(keys, maps.Keys(accessTokenRouteRules))
	slices.Sort(keys)
	return keys
}

// Scope returns the token scope the rule requires, or "" for any/session rules.
func (rule accessTokenRouteRule) Scope() string {
	return rule.scope
}

// Kind names the rule category: "scope", "any" or "session".
func (rule accessTokenRouteRule) Kind() string {
	switch rule.kind {
	case accessTokenRuleScope:
		return "scope"
	case accessTokenRuleAny:
		return "any"
	case accessTokenRuleSession:
		return "session"
	}
	return ""
}
