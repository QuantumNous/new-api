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

func TenantScopeFromContext(c *gin.Context) TenantScope {
	scope := TenantScope{
		TenantId: common.GetContextKeyInt(c, constant.ContextKeyTenantId),
		IsRoot:   c.GetInt("role") == common.RoleRootUser,
	}
	if scope.TenantId == 0 {
		scope.TenantId = 1
	}
	return scope
}

func (scope TenantScope) Apply(db *gorm.DB, tableAliasOrName string) *gorm.DB {
	if scope.IsRoot {
		return db
	}
	if scope.TenantId == 0 {
		scope.TenantId = 1
	}
	column := "tenant_id"
	if tableAliasOrName != "" {
		column = fmt.Sprintf("%s.tenant_id", tableAliasOrName)
	}
	return db.Where(column+" = ?", scope.TenantId)
}
