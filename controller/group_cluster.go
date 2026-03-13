package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetGroupClusters 返回所有类型为 'group_cluster' 的预填充分组，供用户端令牌创建时快捷选择。
func GetGroupClusters(c *gin.Context) {
	groups, err := model.GetAllPrefillGroups("group_cluster")
	if err != nil {
		common.SysError("failed to get group clusters: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取分组群失败，请稍后重试",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groups,
	})
}
