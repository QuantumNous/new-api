package identity

import (
	"errors"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/identity/policy"
)

// Scope catalog for personal access tokens, mirroring the upstream security
// domain: resources grouped into personal / admin / system tiers, each with
// read/write actions. A token's grant is a list of "resource:action" strings.

const (
	AccessTokenGroupPersonal = "personal"
	AccessTokenGroupAdmin    = "admin"
	AccessTokenGroupSystem   = "system"

	AccessTokenScopeSeparator = ":"

	ActionRead  = "read"
	ActionWrite = "write"

	SecurityProofScopeAccessTokenGenerate = "access_token.generate"
	SecurityProofScopeAccessTokenUpdate   = "access_token.update"
	SecurityProofScopeAccessTokenRevoke   = "access_token.revoke"
)

var (
	ErrAccessTokenScopeInvalid   = errors.New("access token scope is invalid")
	ErrAccessTokenScopeForbidden = errors.New("access token scope cannot be granted")
)

// AccessTokenAction mirrors the label shape the frontend matrix renders.
type AccessTokenAction struct {
	Action       string `json:"action"`
	LabelKey     string `json:"label_key"`
	Description  string `json:"description"`
}

// AccessTokenResource is one grantable resource with its actions and the
// minimum role that may hold them.
type AccessTokenResource struct {
	Resource string             `json:"resource"`
	LabelKey string             `json:"label_key"`
	Group    string             `json:"group"`
	MinRole  int                `json:"-"`
	Actions  []AccessTokenAction `json:"actions"`
}

func accessTokenView(description string) AccessTokenAction {
	return AccessTokenAction{Action: ActionRead, LabelKey: "View", Description: description}
}

func accessTokenEdit(description string) AccessTokenAction {
	return AccessTokenAction{Action: ActionWrite, LabelKey: "Edit", Description: description}
}

var accessTokenResources = []AccessTokenResource{
	{Resource: "profile", LabelKey: "Profile", Group: AccessTokenGroupPersonal, MinRole: common.RoleCommonUser, Actions: []AccessTokenAction{
		accessTokenView("View your profile, groups, and available models."),
		accessTokenEdit("Change your display name and personal settings."),
	}},
	{Resource: "api_key", LabelKey: "API keys", Group: AccessTokenGroupPersonal, MinRole: common.RoleCommonUser, Actions: []AccessTokenAction{
		accessTokenView("View API keys and their settings without the full key."),
		accessTokenEdit("Create, edit, and delete API keys."),
	}},
	{Resource: "usage", LabelKey: "Usage", Group: AccessTokenGroupPersonal, MinRole: common.RoleCommonUser, Actions: []AccessTokenAction{
		accessTokenView("View your usage logs, statistics, and tasks."),
	}},
	{Resource: "wallet", LabelKey: "Wallet", Group: AccessTokenGroupPersonal, MinRole: common.RoleCommonUser, Actions: []AccessTokenAction{
		accessTokenView("View balance, top-up records, subscriptions, and referral information."),
		accessTokenEdit("Top up, pay for subscriptions, check in, and transfer referral rewards."),
	}},
	{Resource: "account_security", LabelKey: "Account security", Group: AccessTokenGroupPersonal, MinRole: common.RoleCommonUser, Actions: []AccessTokenAction{
		accessTokenView("View two-factor and sign-in binding status."),
		accessTokenEdit("Includes changes that require security verification, such as passwords and account deletion."),
	}},
	{Resource: "user", LabelKey: "Users", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View users and their permission settings."),
		accessTokenEdit("Create, edit, disable, and delete users."),
	}},
	{Resource: "billing", LabelKey: "Billing management", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View all top-up records and subscription plans."),
		accessTokenEdit("Complete top-up orders and manage subscription plans."),
	}},
	{Resource: "model", LabelKey: "Models", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View models and vendors."),
		accessTokenEdit("Edit models and vendors, and sync them from upstream."),
	}},
	{Resource: "log", LabelKey: "Logs", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View all users' usage logs and statistics."),
	}},
	{Resource: "redemption", LabelKey: "Redemption codes", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View redemption codes."),
		accessTokenEdit("Create, edit, and delete redemption codes."),
	}},
	{Resource: "group", LabelKey: "Groups", Group: AccessTokenGroupAdmin, MinRole: common.RoleAdminUser, Actions: []AccessTokenAction{
		accessTokenView("View groups and prefill groups."),
		accessTokenEdit("Create, edit, and delete prefill groups."),
	}},
	{Resource: "ops", LabelKey: "Operations", Group: AccessTokenGroupSystem, MinRole: common.RoleRootUser, Actions: []AccessTokenAction{
		accessTokenView("View performance, system tasks, and system information."),
		accessTokenEdit("Run and manage maintenance tasks and performance settings."),
	}},
}

// AccessTokenScopeCatalog groups the resources for the create/edit dialogs.
func AccessTokenScopeCatalog() []map[string]any {
	groups := []map[string]any{}
	for _, group := range []string{AccessTokenGroupPersonal, AccessTokenGroupAdmin, AccessTokenGroupSystem} {
		resources := make([]AccessTokenResource, 0)
		for _, resource := range accessTokenResources {
			if resource.Group == group {
				resources = append(resources, resource)
			}
		}
		groups = append(groups, map[string]any{"group": group, "resources": resources})
	}
	return groups
}

// AccessTokenScopeDictionary lists every known scope string.
func AccessTokenScopeDictionary() []string {
	scopes := make([]string, 0, len(accessTokenResources)*2)
	for _, resource := range accessTokenResources {
		for _, action := range resource.Actions {
			scopes = append(scopes, resource.Resource+AccessTokenScopeSeparator+action.Action)
		}
	}
	return scopes
}

func accessTokenResource(name string) *AccessTokenResource {
	for i := range accessTokenResources {
		if accessTokenResources[i].Resource == name {
			return &accessTokenResources[i]
		}
	}
	return nil
}

// NormalizeAccessTokenScopes validates the requested grant against the catalog:
// every entry must exist and the holder's role must be allowed to grant it.
func NormalizeAccessTokenScopes(role int, requested []string) ([]string, error) {
	if len(requested) == 0 {
		return nil, ErrAccessTokenScopeInvalid
	}
	normalized := make([]string, 0, len(requested))
	for _, scope := range requested {
		resource, action, found := strings.Cut(scope, AccessTokenScopeSeparator)
		if !found {
			return nil, ErrAccessTokenScopeInvalid
		}
		definition := accessTokenResource(strings.TrimSpace(resource))
		if definition == nil {
			return nil, ErrAccessTokenScopeInvalid
		}
		if !slices.ContainsFunc(definition.Actions, func(a AccessTokenAction) bool { return a.Action == action }) {
			return nil, ErrAccessTokenScopeInvalid
		}
		if role < definition.MinRole {
			return nil, ErrAccessTokenScopeForbidden
		}
		full := definition.Resource + AccessTokenScopeSeparator + action
		if !slices.Contains(normalized, full) {
			normalized = append(normalized, full)
		}
	}
	if len(normalized) == 0 {
		return nil, ErrAccessTokenScopeInvalid
	}
	return normalized, nil
}

// AccessTokenAllows reports whether a grant list covers the requested scope.
func AccessTokenAllows(scopes []string, scope string) bool {
	return slices.Contains(scopes, scope)
}

// Resources guarded by RequirePermission (channel:* and system:settings) come
// straight from the policy registry so the scope keys a token stores are
// exactly the keys RequirePermission checks — the two can never drift.
// Group/minRole mapping: channel is an admin grant, system settings is root.
func init() {
	for _, definition := range policy.Catalog() {
		var group string
		var minRole int
		switch definition.Resource {
		case policy.ResourceSystem:
			group = AccessTokenGroupSystem
			minRole = common.RoleRootUser
		default:
			group = AccessTokenGroupAdmin
			minRole = common.RoleAdminUser
		}
		actions := make([]AccessTokenAction, 0, len(definition.Actions))
		for _, action := range definition.Actions {
			actions = append(actions, AccessTokenAction{Action: action.Action, LabelKey: action.LabelKey, Description: action.DescriptionKey})
		}
		accessTokenResources = append(accessTokenResources, AccessTokenResource{
			Resource: definition.Resource,
			LabelKey: definition.LabelKey,
			Group:    group,
			MinRole:  minRole,
			Actions:  actions,
		})
	}
}
