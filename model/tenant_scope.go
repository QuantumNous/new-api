package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TenantScope struct {
	TenantId int
	IsRoot   bool
}

func normalizeTenantId(tenantId int) int {
	if tenantId == 0 {
		return 1
	}
	return tenantId
}

func TenantScopeFromContext(c *gin.Context) TenantScope {
	scope := TenantScope{
		TenantId: common.GetContextKeyInt(c, constant.ContextKeyTenantId),
		IsRoot:   c.GetInt("role") == common.RoleRootUser,
	}
	scope.TenantId = normalizeTenantId(scope.TenantId)
	return scope
}

func (scope TenantScope) AllowsTenant(tenantId int) bool {
	if scope.IsRoot {
		return true
	}
	return normalizeTenantId(scope.TenantId) == normalizeTenantId(tenantId)
}

func (scope TenantScope) Apply(db *gorm.DB, tableAliasOrName string) *gorm.DB {
	if scope.IsRoot {
		return db
	}
	scope.TenantId = normalizeTenantId(scope.TenantId)
	column := "tenant_id"
	if tableAliasOrName != "" {
		column = fmt.Sprintf("%s.tenant_id", tableAliasOrName)
	}
	return db.Where(column+" = ?", scope.TenantId)
}
