package controller

import (
	"net/http"
	"one-api/model"
	"one-api/setting"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	username := c.GetString("username")
	userGroup, _ = model.GetUserGroup(userId, false)

	// 遍历所有分组及其比率
	for groupName, ratio := range setting.GetGroupRatioCopy() {
		// 获取用户可用的分组
		userUsableGroups := setting.GetUserUsableGroups(userGroup)

		// 如果不是超级管理员(role < 100)，只能看到包含自己用户名的分组
		if userRole < 100 {
			if !strings.Contains(groupName, username) {
				continue
			}
		}

		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]interface{}{
				"ratio": ratio,
				"desc":  desc,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
