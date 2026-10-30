package controller

import (
	"errors"
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"net/http"
	"os"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func ExecuteGroupMigration(c *gin.Context) {
	if os.Getenv("GROUP_MIGRATION_SINGLE_NODE") != "true" {
		common.ApiErrorStatus(c, http.StatusConflict, common.NewMessage("Set GROUP_MIGRATION_SINGLE_NODE=true only after guaranteeing a single serving instance and stopping other business writers."))
		return
	}
	var submission model.GroupMigrationSubmission
	if err := c.ShouldBindJSON(&submission); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid migration request."))
		return
	}
	op, err := model.SubmitGroupMigration(c.Request.Context(), submission, c.GetInt("id"))
	respondGroupMigration(c, op, err)
}

func GetGroupMigration(c *gin.Context) {
	op, err := model.GetGroupMigration(c.Request.Context(), c.Param("id"))
	respondGroupMigration(c, op, err)
}

func ListGroupMigrations(c *gin.Context) {
	operations, err := model.ListGroupMigrations(c.Request.Context())
	if err != nil {
		common.ApiErrorStatus(c, http.StatusServiceUnavailable, common.NewMessage("Unable to load migration status. Please retry."))
		return
	}
	common.ApiSuccess(c, operations)
}

func ResumeGroupMigration(c *gin.Context) {
	op, err := model.ResumeGroupMigration(c.Request.Context(), c.Param("id"))
	respondGroupMigration(c, op, err)
}

func respondGroupMigration(c *gin.Context, op *model.GroupMigrationOperation, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Migration operation was not found."))
		return
	}
	if op != nil && op.ID != "" {
		if current, readErr := model.GetGroupMigration(c.Request.Context(), op.ID); readErr == nil {
			op = current
		}
		if c.Request.Method != http.MethodGet {
			model.RecordAuditLog(c, model.AuditLog{UserId: c.GetInt("id"), ActorRole: common.RoleRootUser, Category: model.AuditCategoryOperation, Action: "group_migration", Success: op.State == "completed", Other: model.AuditOther{Op: &model.AuditOperation{Action: "group_migration", Params: model.AuditFields{"operation_id": op.ID, "source": op.Source, "target": op.Target, "state": op.State, "counts": op.Counts}}}})
		}
		if err != nil && (op.State == "paused" || op.State == "committed") {
			op.Reason = "Unable to execute group migration. Check operation status before retrying."
			var safe *common.Message
			if errors.As(err, &safe) {
				op.Reason = safe.Error()
			}
		}
		common.ApiSuccess(c, op)
		return
	}
	if err != nil {
		message := common.NewMessage("Unable to execute group migration. Preview and try again.")
		var safe *common.Message
		if errors.As(err, &safe) {
			message = safe
		}
		common.ApiErrorStatus(c, http.StatusConflict, message)
		return
	}
	common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Migration operation was not found."))
}

func PreviewGroupMigration(c *gin.Context) {
	preview, err := model.PreviewGroupMigration(c.Request.Context(), c.Query("source"), c.Query("target"))
	if err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, common.NewMessage("Unable to inspect group references. Please try again."))
		return
	}
	common.ApiSuccess(c, preview)
}

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]any)
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)
	for groupName, _ := range ratio_setting.GetGroupRatioCopy() {
		// UserUsableGroups contains the groups that the user can use
		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]any{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  desc,
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]any{
			"ratio": "auto",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
