package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type getAPIIntegration struct {
	IntegrationID   string   `json:"integration_id"`
	PrincipalUserID int      `json:"principal_user_id"`
	Capabilities    []string `json:"capabilities"`
}

func GetAPIAuth(capability string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		defer recordGetAPIAudit(c, capability)
		user, identity, useAccessToken, err := authenticateDashboardRequest(c)
		if err != nil && !errors.Is(err, service.ErrAuthTokenInvalid) && !errors.Is(err, service.ErrAuthTokenExpired) && !errors.Is(err, service.ErrLoginSessionRevoked) && !errors.Is(err, gorm.ErrRecordNotFound) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"success": false, "code": "GETAPI_CREDENTIAL_UNAVAILABLE", "message": "Credential unavailable"})
			return
		}
		if err != nil || user == nil || user.Status != common.UserStatusEnabled || user.Role < common.RoleAdminUser || !validUserInfo(user.Username, user.Role) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_UNAUTHORIZED", "message": "Administrative authentication required"})
			return
		}
		var principal model.User
		if err := model.DB.Select("id", "role", "status").First(&principal, user.Id).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"success": false, "code": "GETAPI_CREDENTIAL_UNAVAILABLE", "message": "Credential unavailable"})
			return
		}
		if principal.Status != common.UserStatusEnabled || (principal.Role != common.RoleAdminUser && principal.Role != common.RoleRootUser) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_UNAUTHORIZED", "message": "Administrative authentication required"})
			return
		}
		user.Role = principal.Role
		setDashboardAuthContext(c, user, identity, useAccessToken)
		integration := getAPIIntegrationForPrincipal(principal.Id, capability)
		if integration == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "code": "GETAPI_CAPABILITY_DENIED", "message": "Integration capability required"})
			return
		}
		c.Set("getapi_integration_id", integration)
		c.Next()
	}
}

func getAPIIntegrationForPrincipal(principalID int, capability string) string {
	var rows []map[string]json.RawMessage
	if err := common.UnmarshalJsonStr(os.Getenv("GETAPI_INTEGRATIONS"), &rows); err != nil {
		return ""
	}
	principals := map[int]bool{}
	matched := ""
	for _, row := range rows {
		if len(row) != 3 || common.GetJsonType(row["integration_id"]) != "string" || common.GetJsonType(row["principal_user_id"]) != "number" || common.GetJsonType(row["capabilities"]) != "array" {
			return ""
		}
		var integration getAPIIntegration
		if common.Unmarshal(row["integration_id"], &integration.IntegrationID) != nil || common.Unmarshal(row["principal_user_id"], &integration.PrincipalUserID) != nil || common.Unmarshal(row["capabilities"], &integration.Capabilities) != nil {
			return ""
		}
		if integration.PrincipalUserID <= 0 || integration.IntegrationID == "" || len(integration.IntegrationID) > 128 || principals[integration.PrincipalUserID] {
			return ""
		}
		principals[integration.PrincipalUserID] = true
		for _, granted := range integration.Capabilities {
			if granted != "getapi.users.provision" && granted != "getapi.users.read-current" {
				return ""
			}
			if granted == capability && integration.PrincipalUserID == principalID {
				matched = integration.IntegrationID
			}
		}
	}
	return matched
}

func recordGetAPIAudit(c *gin.Context, action string) {
	model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), Username: c.GetString("username"), ActorRole: c.GetInt("role"), Category: model.AuditCategoryOperation, Action: action, Success: c.Writer.Status() < 400, Other: model.AuditOther{RootInfo: model.AuditFields{"integration_id": c.GetString("getapi_integration_id"), "external_account_id": c.GetString("getapi_external_account_id"), "target_user_id": c.GetInt("getapi_target_user_id")}}})
}
