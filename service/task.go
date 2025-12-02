package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func CoverTaskActionToModelName(platform constant.TaskPlatform, action string) string {
	return strings.ToLower(string(platform)) + "_" + strings.ToLower(action)
}

func GetTaskModelName(c *gin.Context, platform constant.TaskPlatform) string {
	action := GetTaskAction(c)
	return CoverTaskActionToModelName(platform, action)
}
func GetTaskAction(c *gin.Context) string {
	action := c.Param("action")
	if action == "" && strings.HasSuffix(c.Request.URL.Path, "/api/v1/generate") {
		action = strings.ToLower(constant.SunoActionMusic)
	}
	return action
}
