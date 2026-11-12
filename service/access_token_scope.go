package service

import (
	"errors"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
)

const (
	AccessTokenGroupPersonal = "personal"
	AccessTokenGroupAdmin    = "admin"
	AccessTokenGroupSystem   = "system"

	AccessTokenMaxPerUser        = 20
	AccessTokenDefaultExpiryDays = 30
	accessTokenActionReveal      = "reveal"
	accessTokenScopeSeparator    = ":"
)

var (
	ErrAccessTokenScopeInvalid   = errors.New("access token scope is invalid")
	ErrAccessTokenScopeForbidden = errors.New("access token scope cannot be granted")
)

// AccessTokenResource mirrors authz.ResourceDefinition so both catalogs share
// one JSON shape and one frontend matrix component.
type AccessTokenResource struct {
	Resource string                   `json:"resource"`
	LabelKey string                   `json:"label_key"`
	Actions  []authz.ActionDefinition `json:"actions"`
	group    string
	minRole  int
}

type AccessTokenCatalogGroup struct {
	Group     string                `json:"group"`
	Resources []AccessTokenResource `json:"resources"`
}

func accessTokenView(description string) authz.ActionDefinition {
	return authz.ActionDefinition{Action: authz.ActionRead, LabelKey: "View", DescriptionKey: description}
}

func accessTokenEdit(description string) authz.ActionDefinition {
	return authz.ActionDefinition{Action: authz.ActionWrite, LabelKey: "Edit", DescriptionKey: description}
}

// accessTokenStaticResources covers dashboard routes that are not guarded by a
// Casbin permission. Casbin resources come from authz.Catalog() at runtime and
// must never be duplicated here.
var accessTokenStaticResources = []AccessTokenResource{
	{Resource: "profile", LabelKey: "Profile", group: AccessTokenGroupPersonal, minRole: common.RoleCommonUser, Actions: []authz.ActionDefinition{
		accessTokenView("View your profile, groups, and available models."),
		accessTokenEdit("Change your display name and personal settings."),
	}},
	{Resource: "api_key", LabelKey: "API keys", group: AccessTokenGroupPersonal, minRole: common.RoleCommonUser, Actions: []authz.ActionDefinition{
		accessTokenView("View API keys and their settings without the full key."),
		accessTokenEdit("Create, edit, and delete API keys."),
		{Action: accessTokenActionReveal, LabelKey: "Reveal full keys", DescriptionKey: "View complete API keys."},
	}},
	{Resource: "usage", LabelKey: "Usage", group: AccessTokenGroupPersonal, minRole: common.RoleCommonUser, Actions: []authz.ActionDefinition{
		accessTokenView("View your usage logs, statistics, tasks, and audit logs."),
	}},
	{Resource: "wallet", LabelKey: "Wallet", group: AccessTokenGroupPersonal, minRole: common.RoleCommonUser, Actions: []authz.ActionDefinition{
		accessTokenView("View balance, top-up records, subscriptions, and referral information."),
		accessTokenEdit("Top up, pay for subscriptions, check in, and transfer referral rewards."),
	}},
	{Resource: "account_security", LabelKey: "Account security", group: AccessTokenGroupPersonal, minRole: common.RoleCommonUser, Actions: []authz.ActionDefinition{
		accessTokenView("View Passkey, two-factor, and sign-in binding status."),
		accessTokenEdit("Includes changes that require security verification, such as password, two-factor settings, and account deletion."),
	}},
	{Resource: "user", LabelKey: "Users", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View users, their sign-in bindings, and permission settings."),
		accessTokenEdit("Create, edit, disable, and delete users, and reset their security settings."),
	}},
	{Resource: "billing", LabelKey: "Billing management", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View all top-up records, subscription plans, and user subscriptions."),
		accessTokenEdit("Complete top-up orders and manage subscription plans and user subscriptions."),
	}},
	{Resource: "model", LabelKey: "Models", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View models and vendors, and preview upstream sync."),
		accessTokenEdit("Edit models and vendors, and sync them from upstream."),
	}},
	{Resource: "deployment", LabelKey: "Deployments", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View deployments and price estimates."),
		accessTokenEdit("Create, edit, and delete deployments, and test connections."),
	}},
	{Resource: "log", LabelKey: "Logs", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View all users' usage logs, statistics, and tasks."),
	}},
	{Resource: "redemption", LabelKey: "Redemption codes", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View redemption codes."),
		accessTokenEdit("Create, edit, and delete redemption codes."),
	}},
	{Resource: "group", LabelKey: "Groups", group: AccessTokenGroupAdmin, minRole: common.RoleAdminUser, Actions: []authz.ActionDefinition{
		accessTokenView("View groups and prefill groups."),
		accessTokenEdit("Create, edit, and delete prefill groups."),
	}},
	{Resource: "option", LabelKey: "System settings", group: AccessTokenGroupSystem, minRole: common.RoleRootUser, Actions: []authz.ActionDefinition{
		accessTokenView("View system settings, custom OAuth providers, and price sync sources."),
		accessTokenEdit("Change system settings and custom OAuth providers, and sync prices."),
	}},
	{Resource: "plugin", LabelKey: "Task plugins", group: AccessTokenGroupSystem, minRole: common.RoleRootUser, Actions: []authz.ActionDefinition{
		accessTokenView("View installed task plugins and their settings."),
		accessTokenEdit("Install, configure, test, and remove task plugins."),
	}},
	{Resource: "ops", LabelKey: "Operations", group: AccessTokenGroupSystem, minRole: common.RoleRootUser, Actions: []authz.ActionDefinition{
		accessTokenView("View performance, system tasks, and system information."),
		accessTokenEdit("Run and manage maintenance tasks and performance settings."),
	}},
}

// AccessTokenScopeOf is the token scope key for a Casbin permission.
func AccessTokenScopeOf(permission authz.Permission) string {
	return permission.Resource + accessTokenScopeSeparator + permission.Action
}

// AccessTokenCatalog lists the scopes this user may grant right now, grouped
// for display. Resources without a grantable action and empty groups are
// omitted.
func AccessTokenCatalog(userID, role int) []AccessTokenCatalogGroup {
	resources := map[string][]AccessTokenResource{}
	for _, resource := range accessTokenStaticResources {
		if role < resource.minRole {
			continue
		}
		resource.Actions = slices.Clone(resource.Actions)
		resources[resource.group] = append(resources[resource.group], resource)
	}
	if role >= common.RoleAdminUser {
		for _, definition := range authz.Catalog() {
			resource := AccessTokenResource{Resource: definition.Resource, LabelKey: definition.LabelKey}
			for _, action := range definition.Actions {
				if authz.Can(userID, role, authz.Permission{Resource: definition.Resource, Action: action.Action}) {
					resource.Actions = append(resource.Actions, action)
				}
			}
			if len(resource.Actions) > 0 {
				resources[AccessTokenGroupAdmin] = append(resources[AccessTokenGroupAdmin], resource)
			}
		}
	}
	groups := make([]AccessTokenCatalogGroup, 0, 3)
	for _, group := range []string{AccessTokenGroupPersonal, AccessTokenGroupAdmin, AccessTokenGroupSystem} {
		if len(resources[group]) > 0 {
			groups = append(groups, AccessTokenCatalogGroup{Group: group, Resources: resources[group]})
		}
	}
	return groups
}

// AccessTokenScopeDictionary lists every resource a token scope can name,
// whatever the viewer may grant, so stored grants keep their labels after the
// granting user loses a permission or when another user reads them.
func AccessTokenScopeDictionary() []AccessTokenResource {
	definitions := authz.Catalog()
	resources := make([]AccessTokenResource, 0, len(accessTokenStaticResources)+len(definitions))
	for _, resource := range accessTokenStaticResources {
		resource.Actions = slices.Clone(resource.Actions)
		resources = append(resources, resource)
	}
	for _, definition := range definitions {
		resources = append(resources, AccessTokenResource{Resource: definition.Resource, LabelKey: definition.LabelKey, Actions: definition.Actions})
	}
	return resources
}

// NormalizeAccessTokenScopes validates a requested grant against the catalog
// the user sees and returns it trimmed, de-duplicated and sorted.
func NormalizeAccessTokenScopes(userID, role int, scopes []string) ([]string, error) {
	normalized, ok := NormalizeAccessTokenScopeList(scopes)
	if !ok {
		return nil, ErrAccessTokenScopeInvalid
	}
	grantable := make(map[string]bool)
	for _, group := range AccessTokenCatalog(userID, role) {
		for _, resource := range group.Resources {
			for _, action := range resource.Actions {
				grantable[resource.Resource+accessTokenScopeSeparator+action.Action] = true
			}
		}
	}
	for _, scope := range normalized {
		if grantable[scope] {
			continue
		}
		if !knownAccessTokenScope(scope) {
			return nil, ErrAccessTokenScopeInvalid
		}
		return nil, ErrAccessTokenScopeForbidden
	}
	return normalized, nil
}

func knownAccessTokenScope(scope string) bool {
	resourceName, action, ok := strings.Cut(scope, accessTokenScopeSeparator)
	if !ok {
		return false
	}
	for _, resource := range accessTokenStaticResources {
		if resource.Resource == resourceName && slices.ContainsFunc(resource.Actions, func(definition authz.ActionDefinition) bool { return definition.Action == action }) {
			return true
		}
	}
	return slices.Contains(authz.AllPermissions(), authz.Permission{Resource: resourceName, Action: action})
}

func AccessTokenScopeGranted(scopes []string, scope string) bool {
	return scope != "" && slices.Contains(scopes, scope)
}

// accessTokenVerificationScopes maps every verification scope to the token
// scope a PAT needs to obtain its proof. An empty value means PATs can never
// obtain it; scopes missing from this table are denied too.
var accessTokenVerificationScopes = map[string]string{
	VerificationScopeChannelKeyRead:        AccessTokenScopeOf(authz.ChannelSecretView),
	VerificationScopeAdminUserCreate:       "user:write",
	VerificationScopeAdminUserUpdate:       "user:write",
	VerificationScopeAdminUserDelete:       "user:write",
	VerificationScopeAdminUserManage:       "user:write",
	VerificationScopeAdminUserPasskeyReset: "user:write",
	VerificationScopeAdminUserTwoFADisable: "user:write",
	VerificationScopeAdminUserBindingClear: "user:write",
	VerificationScopePasskeyRegister:       "account_security:write",
	VerificationScopePasskeyDelete:         "account_security:write",
	VerificationScopeTwoFASetup:            "account_security:write",
	VerificationScopeTwoFADisable:          "account_security:write",
	VerificationScopeTwoFABackupCodes:      "account_security:write",
	VerificationScopePasswordSet:           "account_security:write",
	VerificationScopePasswordChange:        "account_security:write",
	VerificationScopeAccountBind:           "account_security:write",
	VerificationScopeAccountUnbind:         "account_security:write",
	VerificationScopeAccountDelete:         "account_security:write",
	VerificationScopeAccessTokenGenerate:   "",
	VerificationScopeAccessTokenUpdate:     "",
	VerificationScopeAccessTokenRevoke:     "",
	VerificationScopeLogin:                 "",
}

// AccessTokenVerificationScope returns the token scope a PAT needs for a
// verification scope and whether the scope is listed at all.
func AccessTokenVerificationScope(verificationScope string) (scope string, listed bool) {
	scope, listed = accessTokenVerificationScopes[verificationScope]
	return scope, listed
}

// requireAccessTokenVerificationScope rejects a step-up request from a PAT
// whose grant does not cover the operation. Browser sessions pass through.
func requireAccessTokenVerificationScope(identity AuthIdentity, verificationScope string) error {
	tokenID, ok := model.ParseAccessTokenSessionID(identity.SessionID)
	if !ok {
		return nil
	}
	required, _ := AccessTokenVerificationScope(verificationScope)
	if required == "" {
		return ErrVerificationForbidden
	}
	token, err := model.GetUserAccessToken(identity.UserID, tokenID)
	if errors.Is(err, model.ErrAccessTokenNotFound) {
		return ErrAuthTokenInvalid
	}
	if err != nil {
		return err
	}
	if !AccessTokenScopeGranted(token.GetScopes(), required) {
		return ErrVerificationForbidden
	}
	return nil
}
