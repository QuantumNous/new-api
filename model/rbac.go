package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	PlatformRoleSuperAdmin    = "super_admin"
	PlatformRoleOperator      = "operator"
	PlatformRoleFinance       = "finance"
	PlatformRoleModelProvider = "model_provider"
	PlatformRoleUser          = "user"
)

const (
	PermissionRBACManage               = "rbac.manage"
	PermissionProviderManage           = "provider.manage"
	PermissionProviderSelfManage       = "provider.self.manage"
	PermissionMarketplaceManage        = "marketplace.manage"
	PermissionMarketplaceSelfManage    = "marketplace.self.manage"
	PermissionMarketplaceView          = "marketplace.view"
	PermissionMarketplaceKeyManage     = "marketplace.key.manage"
	PermissionMarketplaceSelfKeyManage = "marketplace.self.key.manage"
	PermissionFinanceManage            = "finance.manage"
	PermissionFinanceView              = "finance.view"
	PermissionAuditView                = "audit.view"
)

type Role struct {
	Id          int            `json:"id"`
	Code        string         `json:"code" gorm:"size:64;not null;uniqueIndex"`
	Name        string         `json:"name" gorm:"size:128;not null"`
	Description string         `json:"description,omitempty" gorm:"type:text"`
	Builtin     bool           `json:"builtin"`
	CreatedAt   int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type Permission struct {
	Id          int    `json:"id"`
	Code        string `json:"code" gorm:"size:96;not null;uniqueIndex"`
	Name        string `json:"name" gorm:"size:128;not null"`
	Description string `json:"description,omitempty" gorm:"type:text"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

type UserRole struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"not null;index;uniqueIndex:uk_user_role,priority:1"`
	RoleCode  string `json:"role_code" gorm:"size:64;not null;index;uniqueIndex:uk_user_role,priority:2"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

type RolePermission struct {
	Id             int    `json:"id"`
	RoleCode       string `json:"role_code" gorm:"size:64;not null;index;uniqueIndex:uk_role_permission,priority:1"`
	PermissionCode string `json:"permission_code" gorm:"size:96;not null;index;uniqueIndex:uk_role_permission,priority:2"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
}

type RoleWithPermissions struct {
	Role
	Permissions []string `json:"permissions" gorm:"-"`
}

var builtinRoles = []Role{
	{Code: PlatformRoleSuperAdmin, Name: "Super Admin", Description: "Full platform access", Builtin: true},
	{Code: PlatformRoleOperator, Name: "Operator", Description: "Model operations and user usage management", Builtin: true},
	{Code: PlatformRoleFinance, Name: "Finance", Description: "Financial records, earnings, and settlement management", Builtin: true},
	{Code: PlatformRoleModelProvider, Name: "Model Provider", Description: "Provider-owned models, keys, pricing, and wallet", Builtin: true},
	{Code: PlatformRoleUser, Name: "User", Description: "Marketplace access and own account resources", Builtin: true},
}

var builtinPermissions = []Permission{
	{Code: PermissionRBACManage, Name: "Manage roles and permissions"},
	{Code: PermissionProviderManage, Name: "Manage all provider profiles"},
	{Code: PermissionProviderSelfManage, Name: "Manage own provider profile"},
	{Code: PermissionMarketplaceManage, Name: "Manage all marketplace models"},
	{Code: PermissionMarketplaceSelfManage, Name: "Manage own marketplace models"},
	{Code: PermissionMarketplaceView, Name: "View model marketplace"},
	{Code: PermissionMarketplaceKeyManage, Name: "Manage all model keys"},
	{Code: PermissionMarketplaceSelfKeyManage, Name: "Manage own model keys"},
	{Code: PermissionFinanceManage, Name: "Manage financial settlement data"},
	{Code: PermissionFinanceView, Name: "View financial settlement data"},
	{Code: PermissionAuditView, Name: "View audit logs"},
}

var builtinRolePermissions = map[string][]string{
	PlatformRoleSuperAdmin: {
		PermissionRBACManage,
		PermissionProviderManage,
		PermissionProviderSelfManage,
		PermissionMarketplaceManage,
		PermissionMarketplaceSelfManage,
		PermissionMarketplaceView,
		PermissionMarketplaceKeyManage,
		PermissionMarketplaceSelfKeyManage,
		PermissionFinanceManage,
		PermissionFinanceView,
		PermissionAuditView,
	},
	PlatformRoleOperator: {
		PermissionProviderManage,
		PermissionMarketplaceManage,
		PermissionMarketplaceView,
		PermissionMarketplaceKeyManage,
		PermissionAuditView,
	},
	PlatformRoleFinance: {
		PermissionProviderManage,
		PermissionMarketplaceView,
		PermissionFinanceManage,
		PermissionFinanceView,
		PermissionAuditView,
	},
	PlatformRoleModelProvider: {
		PermissionProviderSelfManage,
		PermissionMarketplaceSelfManage,
		PermissionMarketplaceView,
		PermissionMarketplaceSelfKeyManage,
		PermissionFinanceView,
	},
	PlatformRoleUser: {
		PermissionMarketplaceView,
	},
}

func EnsureBuiltinRBAC() error {
	now := common.GetTimestamp()
	for _, role := range builtinRoles {
		role.CreatedAt = now
		role.UpdatedAt = now
		if err := DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "code"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "description", "builtin", "updated_at"}),
		}).Create(&role).Error; err != nil {
			return err
		}
	}
	for _, permission := range builtinPermissions {
		permission.CreatedAt = now
		permission.UpdatedAt = now
		if err := DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "code"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "description", "updated_at"}),
		}).Create(&permission).Error; err != nil {
			return err
		}
	}
	for roleCode, permissions := range builtinRolePermissions {
		for _, permissionCode := range permissions {
			rp := RolePermission{RoleCode: roleCode, PermissionCode: permissionCode, CreatedAt: now}
			if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&rp).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func BuiltinRoleForLegacyRole(role int) string {
	switch {
	case role >= common.RoleRootUser:
		return PlatformRoleSuperAdmin
	case role >= common.RoleAdminUser:
		return PlatformRoleOperator
	default:
		return PlatformRoleUser
	}
}

func GetUserRoleCodes(userId int, legacyRole int) ([]string, error) {
	roleSet := map[string]struct{}{
		BuiltinRoleForLegacyRole(legacyRole): {},
	}
	var rows []UserRole
	if err := DB.Where("user_id = ?", userId).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row.RoleCode != "" {
			roleSet[row.RoleCode] = struct{}{}
		}
	}
	roles := make([]string, 0, len(roleSet))
	for roleCode := range roleSet {
		roles = append(roles, roleCode)
	}
	return roles, nil
}

func GetUserPermissionCodes(userId int, legacyRole int) ([]string, error) {
	if legacyRole >= common.RoleRootUser {
		permissions := make([]string, 0, len(builtinPermissions))
		for _, permission := range builtinPermissions {
			permissions = append(permissions, permission.Code)
		}
		return permissions, nil
	}
	roleCodes, err := GetUserRoleCodes(userId, legacyRole)
	if err != nil {
		return nil, err
	}
	var rows []RolePermission
	if err := DB.Where("role_code IN ?", roleCodes).Find(&rows).Error; err != nil {
		return nil, err
	}
	permissionSet := map[string]struct{}{}
	for _, row := range rows {
		permissionSet[row.PermissionCode] = struct{}{}
	}
	permissions := make([]string, 0, len(permissionSet))
	for permissionCode := range permissionSet {
		permissions = append(permissions, permissionCode)
	}
	return permissions, nil
}

func UserHasPermission(userId int, legacyRole int, permissionCode string) (bool, error) {
	if legacyRole >= common.RoleRootUser {
		return true, nil
	}
	permissions, err := GetUserPermissionCodes(userId, legacyRole)
	if err != nil {
		return false, err
	}
	for _, permission := range permissions {
		if permission == permissionCode {
			return true, nil
		}
	}
	return false, nil
}

func UserHasAnyPermission(userId int, legacyRole int, permissions ...string) (bool, error) {
	if len(permissions) == 0 {
		return true, nil
	}
	for _, permission := range permissions {
		ok, err := UserHasPermission(userId, legacyRole, permission)
		if err != nil || ok {
			return ok, err
		}
	}
	return false, nil
}

func ListRolesWithPermissions() ([]RoleWithPermissions, error) {
	var roles []Role
	if err := DB.Order("id asc").Find(&roles).Error; err != nil {
		return nil, err
	}
	var rolePermissions []RolePermission
	if err := DB.Order("role_code asc, permission_code asc").Find(&rolePermissions).Error; err != nil {
		return nil, err
	}
	permissionMap := map[string][]string{}
	for _, rp := range rolePermissions {
		permissionMap[rp.RoleCode] = append(permissionMap[rp.RoleCode], rp.PermissionCode)
	}
	result := make([]RoleWithPermissions, 0, len(roles))
	for _, role := range roles {
		result = append(result, RoleWithPermissions{
			Role:        role,
			Permissions: permissionMap[role.Code],
		})
	}
	return result, nil
}

func ListPermissions() ([]Permission, error) {
	var permissions []Permission
	err := DB.Order("code asc").Find(&permissions).Error
	return permissions, err
}

func ListUserRoles(userId int) ([]UserRole, error) {
	var roles []UserRole
	err := DB.Where("user_id = ?", userId).Order("role_code asc").Find(&roles).Error
	return roles, err
}

func ReplaceUserRoles(userId int, roleCodes []string) error {
	now := common.GetTimestamp()
	normalized := make([]string, 0, len(roleCodes))
	seen := map[string]struct{}{}
	for _, roleCode := range roleCodes {
		roleCode = strings.TrimSpace(roleCode)
		if roleCode == "" {
			continue
		}
		if _, ok := seen[roleCode]; ok {
			continue
		}
		seen[roleCode] = struct{}{}
		normalized = append(normalized, roleCode)
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if len(normalized) > 0 {
			var count int64
			if err := tx.Model(&Role{}).Where("code IN ?", normalized).Count(&count).Error; err != nil {
				return err
			}
			if count != int64(len(normalized)) {
				return errors.New("role code does not exist")
			}
		}
		if err := tx.Where("user_id = ?", userId).Delete(&UserRole{}).Error; err != nil {
			return err
		}
		for _, roleCode := range normalized {
			userRole := UserRole{UserId: userId, RoleCode: roleCode, CreatedAt: now}
			if err := tx.Create(&userRole).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
