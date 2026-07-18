package controller

import (
	"net/http"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type extensionsAvailabilityGroup struct {
	Group        string                          `json:"group"`
	Records      []model.GroupAvailabilityRecord `json:"records"`
	SuccessRate  float64                         `json:"success_rate"`
	AvgUseTime   float64                         `json:"avg_use_time"`
	Status       string                          `json:"status"`
	Total        int                             `json:"total"`
	SuccessCount int                             `json:"success_count"`
}

func GetExtensionsAvailability(c *gin.Context) {
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	if !console_setting.IsAvailabilityMonitorVisible(isAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "availability monitor is not available",
		})
		return
	}

	userId := c.GetInt("id")
	userGroup, _ := model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)

	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		// Match GetUserGroups: only billing groups the user can select (skip "auto").
		if groupName == "auto" {
			continue
		}
		if _, ok := userUsableGroups[groupName]; !ok {
			continue
		}
		groupNames = append(groupNames, groupName)
	}
	sort.Strings(groupNames)

	groups := make([]extensionsAvailabilityGroup, 0, len(groupNames))
	for _, groupName := range groupNames {
		records, err := model.GetRecentGroupAvailabilityLogs(groupName, 100)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		okCount := 0
		successUseTimeSum := 0
		for _, record := range records {
			if record.Ok {
				okCount++
				successUseTimeSum += record.UseTime
			}
		}
		successRate, avgUseTime, status := console_setting.SummarizeAvailabilityRecords(
			okCount,
			len(records),
			successUseTimeSum,
		)
		groups = append(groups, extensionsAvailabilityGroup{
			Group:        groupName,
			Records:      records,
			SuccessRate:  successRate,
			AvgUseTime:   avgUseTime,
			Status:       status,
			Total:        len(records),
			SuccessCount: okCount,
		})
	}

	common.ApiSuccess(c, gin.H{
		"groups": groups,
	})
}
