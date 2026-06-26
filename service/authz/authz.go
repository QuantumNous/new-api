package authz

import (
	"fmt"
	"sort"
	"strconv"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/casbin/casbin/v2"
	casbinmodel "github.com/casbin/casbin/v2/model"
	"gorm.io/gorm"
)

type Permission struct {
	Resource string
	Action   string
}

type ActionDefinition struct {
	Action         string
	LabelKey       string
	DescriptionKey string
	DefaultAdmin   bool
}

type ResourceDefinition struct {
	Resource string
	LabelKey string
	Actions  []ActionDefinition
}

type PermissionsMap map[string]map[string]bool

const (
	ResourceChannel = "channel"

	ActionRead           = "read"
	ActionOperate        = "operate"
	ActionWrite          = "write"
	ActionSensitiveWrite = "sensitive_write"
	ActionSecretView     = "secret_view"

	EffectAllow = "allow"
	EffectDeny  = "deny"

	BuiltInRoleRoot  = "root"
	BuiltInRoleAdmin = "admin"
)

var (
	ChannelRead           = Permission{Resource: ResourceChannel, Action: ActionRead}
	ChannelOperate        = Permission{Resource: ResourceChannel, Action: ActionOperate}
	ChannelWrite          = Permission{Resource: ResourceChannel, Action: ActionWrite}
	ChannelSensitiveWrite = Permission{Resource: ResourceChannel, Action: ActionSensitiveWrite}
	ChannelSecretView     = Permission{Resource: ResourceChannel, Action: ActionSecretView}

	enforcerMu sync.RWMutex
	enforcer   *casbin.Enforcer

	catalog = []ResourceDefinition{
		{
			Resource: ResourceChannel,
			LabelKey: "Channel Management",
			Actions: []ActionDefinition{
				{
					Action:         ActionRead,
					LabelKey:       "Read channels",
					DescriptionKey: "View channel lists and details without secrets.",
					DefaultAdmin:   true,
				},
				{
					Action:         ActionOperate,
					LabelKey:       "Operate channels",
					DescriptionKey: "Test channels, update balances, and toggle availability.",
					DefaultAdmin:   true,
				},
				{
					Action:         ActionWrite,
					LabelKey:       "Edit channel routing",
					DescriptionKey: "Edit non-sensitive routing fields such as models and groups.",
					DefaultAdmin:   true,
				},
				{
					Action:         ActionSensitiveWrite,
					LabelKey:       "Edit sensitive channel settings",
					DescriptionKey: "Create channels or edit keys, base URLs, and overrides.",
				},
				{
					Action:         ActionSecretView,
					LabelKey:       "View channel secrets",
					DescriptionKey: "Reserved for viewing complete channel keys after secure verification.",
				},
			},
		},
	}
)

const modelText = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act, eft

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act && p.eft == "allow"
`

func Init(db *gorm.DB) error {
	if err := seedBuiltInRoles(db); err != nil {
		return err
	}
	if err := resetBuiltInRolePolicies(db); err != nil {
		return err
	}

	m, err := casbinmodel.NewModelFromString(modelText)
	if err != nil {
		return err
	}
	e, err := casbin.NewEnforcer(m, newGormAdapter(db))
	if err != nil {
		return err
	}
	e.EnableAutoSave(true)

	enforcerMu.Lock()
	enforcer = e
	enforcerMu.Unlock()

	return seedDefaultPolicies()
}

func Catalog() []ResourceDefinition {
	result := make([]ResourceDefinition, 0, len(catalog))
	for _, resource := range catalog {
		item := ResourceDefinition{
			Resource: resource.Resource,
			LabelKey: resource.LabelKey,
			Actions:  append([]ActionDefinition(nil), resource.Actions...),
		}
		result = append(result, item)
	}
	return result
}

func Can(userID int, systemRole int, permission Permission) bool {
	if systemRole >= common.RoleRootUser {
		return true
	}
	if systemRole < common.RoleAdminUser || !isKnownPermission(permission) {
		return false
	}

	e := currentEnforcer()
	if e == nil {
		return false
	}

	if effect, ok := explicitSubjectEffect(e, UserSubject(userID), permission); ok {
		return effect == EffectAllow
	}
	return roleBaselineAllows(e, permission)
}

func Capabilities(userID int, systemRole int) PermissionsMap {
	result := make(PermissionsMap, len(catalog))
	for _, resource := range catalog {
		actions := make(map[string]bool, len(resource.Actions))
		for _, action := range resource.Actions {
			actions[action.Action] = Can(userID, systemRole, Permission{
				Resource: resource.Resource,
				Action:   action.Action,
			})
		}
		result[resource.Resource] = actions
	}
	return result
}

func SetUserPermissions(userID int, permissions PermissionsMap) error {
	e := currentEnforcer()
	if e == nil {
		return fmt.Errorf("authz enforcer is not initialized")
	}

	for resource, actions := range permissions {
		if !isKnownResource(resource) {
			continue
		}
		if _, err := e.RemoveFilteredPolicy(0, UserSubject(userID), resource); err != nil {
			return err
		}
		for _, policy := range userOverridePolicies(e, resource, actions) {
			if _, err := e.AddPolicy(UserSubject(userID), policy.Resource, policy.Action, policy.Effect); err != nil {
				return err
			}
		}
	}
	return nil
}

func ClearUserPermissions(userID int) error {
	e := currentEnforcer()
	if e == nil {
		return fmt.Errorf("authz enforcer is not initialized")
	}

	for _, resource := range catalog {
		if _, err := e.RemoveFilteredPolicy(0, UserSubject(userID), resource.Resource); err != nil {
			return err
		}
	}
	return nil
}

func ClearUserAuthorization(userID int) error {
	return ClearUserPermissions(userID)
}

func ExplicitUserPermissions(userID int) PermissionsMap {
	return Capabilities(userID, common.RoleAdminUser)
}

func ExplicitUserOverrides(userID int) PermissionsMap {
	e := currentEnforcer()
	if e == nil {
		return PermissionsMap{}
	}

	result := PermissionsMap{}
	for _, resource := range catalog {
		policies, err := e.GetFilteredPolicy(0, UserSubject(userID), resource.Resource)
		if err != nil {
			return PermissionsMap{}
		}
		actions := make(map[string]bool, len(policies))
		for _, policy := range policies {
			if len(policy) >= 3 && isKnownPermission(Permission{Resource: policy[1], Action: policy[2]}) {
				effect := policyEffect(policy)
				if effect == EffectAllow || effect == EffectDeny {
					actions[policy[2]] = effect == EffectAllow
				}
			}
		}
		if len(actions) > 0 {
			result[resource.Resource] = actions
		}
	}
	return result
}

func AllPermissions() []Permission {
	permissions := make([]Permission, 0)
	for _, resource := range catalog {
		for _, action := range resource.Actions {
			permissions = append(permissions, Permission{
				Resource: resource.Resource,
				Action:   action.Action,
			})
		}
	}
	return permissions
}

func DefaultAdminPermissions() []Permission {
	permissions := make([]Permission, 0)
	for _, resource := range catalog {
		for _, action := range resource.Actions {
			if !action.DefaultAdmin {
				continue
			}
			permissions = append(permissions, Permission{
				Resource: resource.Resource,
				Action:   action.Action,
			})
		}
	}
	return permissions
}

func UserSubject(userID int) string {
	return "user:" + strconv.Itoa(userID)
}

func RoleSubject(roleKey string) string {
	return "role:" + roleKey
}

func seedBuiltInRoles(db *gorm.DB) error {
	roles := []model.AuthzRole{
		{
			Key:         BuiltInRoleRoot,
			Name:        "Root",
			Description: "Built-in root authorization role",
			BuiltIn:     true,
			Enabled:     true,
			Sort:        0,
		},
		{
			Key:         BuiltInRoleAdmin,
			Name:        "Admin",
			Description: "Built-in admin authorization role",
			BuiltIn:     true,
			Enabled:     true,
			Sort:        10,
		},
	}
	for _, role := range roles {
		var existing model.AuthzRole
		err := db.Where("key = ?", role.Key).First(&existing).Error
		if err == nil {
			existing.Name = role.Name
			existing.Description = role.Description
			existing.BuiltIn = role.BuiltIn
			existing.Enabled = role.Enabled
			existing.Sort = role.Sort
			if err := db.Save(&existing).Error; err != nil {
				return err
			}
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if err := db.Create(&role).Error; err != nil {
			return err
		}
	}
	return nil
}

func resetBuiltInRolePolicies(db *gorm.DB) error {
	subjects := []string{RoleSubject(BuiltInRoleRoot), RoleSubject(BuiltInRoleAdmin)}
	return db.Where("ptype = ? AND v0 IN ?", "p", subjects).Delete(&model.CasbinRule{}).Error
}

func seedDefaultPolicies() error {
	e := currentEnforcer()
	if e == nil {
		return fmt.Errorf("authz enforcer is not initialized")
	}

	for _, permission := range AllPermissions() {
		if _, err := e.AddPolicy(RoleSubject(BuiltInRoleRoot), permission.Resource, permission.Action, EffectAllow); err != nil {
			return err
		}
	}
	for _, permission := range DefaultAdminPermissions() {
		if _, err := e.AddPolicy(RoleSubject(BuiltInRoleAdmin), permission.Resource, permission.Action, EffectAllow); err != nil {
			return err
		}
	}
	return nil
}

func currentEnforcer() *casbin.Enforcer {
	enforcerMu.RLock()
	defer enforcerMu.RUnlock()
	return enforcer
}

func roleBaselineAllows(e *casbin.Enforcer, permission Permission) bool {
	effect, ok := explicitSubjectEffect(e, RoleSubject(BuiltInRoleAdmin), permission)
	return ok && effect == EffectAllow
}

func isKnownResource(resource string) bool {
	for _, known := range catalog {
		if known.Resource == resource {
			return true
		}
	}
	return false
}

type overridePolicy struct {
	Resource string
	Action   string
	Effect   string
}

func userOverridePolicies(e *casbin.Enforcer, resource string, actions map[string]bool) []overridePolicy {
	overrides := make([]overridePolicy, 0, len(actions))
	for _, action := range catalogActions(resource) {
		desired, ok := actions[action.Action]
		if !ok {
			continue
		}
		permission := Permission{Resource: resource, Action: action.Action}
		if desired == roleBaselineAllows(e, permission) {
			continue
		}
		effect := EffectDeny
		if desired {
			effect = EffectAllow
		}
		overrides = append(overrides, overridePolicy{
			Resource: resource,
			Action:   action.Action,
			Effect:   effect,
		})
	}
	sort.Slice(overrides, func(i, j int) bool {
		return overrides[i].Action < overrides[j].Action
	})
	return overrides
}

func explicitSubjectEffect(e *casbin.Enforcer, subject string, permission Permission) (string, bool) {
	policies, err := e.GetFilteredPolicy(0, subject, permission.Resource, permission.Action)
	if err != nil {
		return "", false
	}
	hasAllow := false
	for _, policy := range policies {
		switch policyEffect(policy) {
		case EffectDeny:
			return EffectDeny, true
		case EffectAllow:
			hasAllow = true
		}
	}
	if hasAllow {
		return EffectAllow, true
	}
	return "", false
}

func policyEffect(policy []string) string {
	if len(policy) < 4 || policy[3] == "" {
		return EffectAllow
	}
	return policy[3]
}

func catalogActions(resource string) []ActionDefinition {
	for _, known := range catalog {
		if known.Resource == resource {
			return known.Actions
		}
	}
	return nil
}

func isKnownPermission(permission Permission) bool {
	for _, resource := range catalog {
		if resource.Resource != permission.Resource {
			continue
		}
		for _, action := range resource.Actions {
			if action.Action == permission.Action {
				return true
			}
		}
	}
	return false
}
