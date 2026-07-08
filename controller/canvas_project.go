package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 画布项目服务端持久化(/api/canvas/projects,UserAuth)。
// 服务端为准,浏览器 IndexedDB 仅作缓存;version/updated_at 乐观并发,冲突返回 409。

// 单个项目 JSON 上限,防止大 base64 混入项目数据(素材应走素材库 OBS)
const canvasProjectMaxDataBytes = 8 * 1024 * 1024

type canvasProjectUpsertRequest struct {
	Title     string `json:"title"`
	Data      string `json:"data"`
	Version   int    `json:"version"`
	UpdatedAt int64  `json:"updated_at"`
}

func canvasProjectValid(projectId string) bool {
	if projectId == "" || len(projectId) > 64 {
		return false
	}
	for _, r := range projectId {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

func ListCanvasProjects(c *gin.Context) {
	userId := c.GetInt("id")
	projects, err := model.GetCanvasProjectsByUser(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": projects})
}

func GetCanvasProjectDetail(c *gin.Context) {
	userId := c.GetInt("id")
	projectId := c.Param("project_id")
	project, err := model.GetCanvasProject(userId, projectId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "项目不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": project})
}

func UpsertCanvasProjectHandler(c *gin.Context) {
	userId := c.GetInt("id")
	projectId := c.Param("project_id")
	if !canvasProjectValid(projectId) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "非法的项目 ID"})
		return
	}
	var req canvasProjectUpsertRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}
	if req.Data == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目数据不能为空"})
		return
	}
	if len(req.Data) > canvasProjectMaxDataBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "项目数据过大,请将素材保存到素材库而非内嵌项目 JSON"})
		return
	}
	project, err := model.UpsertCanvasProject(userId, projectId, req.Title, req.Data, req.Version, req.UpdatedAt)
	if err != nil {
		if errors.Is(err, model.ErrCanvasProjectConflict) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "项目存在更新的服务端版本", "data": project})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": project})
}

func DeleteCanvasProjectHandler(c *gin.Context) {
	userId := c.GetInt("id")
	projectId := c.Param("project_id")
	if err := model.DeleteCanvasProject(userId, projectId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
