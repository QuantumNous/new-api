package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func CreatePlaygroundCanvasProject(c *gin.Context) {
	var body struct {
		TemplateId int            `json:"template_id"`
		Title      string         `json:"title"`
		Prompt     string         `json:"prompt"`
		Values     map[string]any `json:"values"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.TemplateId <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid template_id"})
		return
	}
	project, err := service.CreatePlaygroundCanvasProject(c.GetInt("id"), body.TemplateId, body.Title, body.Prompt, body.Values)
	if err != nil {
		playgroundCanvasError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "", "data": project})
}

func ListPlaygroundCanvasProjects(c *gin.Context) {
	projects, err := service.ListPlaygroundCanvasProjects(c.GetInt("id"))
	if err != nil {
		playgroundCanvasError(c, err)
		return
	}
	common.ApiSuccess(c, projects)
}

func GetPlaygroundCanvasProject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "project not found"})
		return
	}
	project, err := service.GetPlaygroundCanvasProject(c.GetInt("id"), id)
	if err != nil {
		playgroundCanvasError(c, err)
		return
	}
	common.ApiSuccess(c, project)
}

func UpdatePlaygroundCanvasProject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "project not found"})
		return
	}
	var body struct {
		Revision        int    `json:"revision"`
		SnapshotVersion int    `json:"snapshot_version"`
		Title           string `json:"title"`
		Snapshot        any    `json:"snapshot"`
	}
	if err = c.ShouldBindJSON(&body); err != nil || body.Snapshot == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid canvas project"})
		return
	}
	project, err := service.UpdatePlaygroundCanvasProject(c.GetInt("id"), id, body.Revision, body.SnapshotVersion, body.Title, body.Snapshot)
	if err != nil {
		playgroundCanvasError(c, err)
		return
	}
	common.ApiSuccess(c, project)
}

func DeletePlaygroundCanvasProject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "project not found"})
		return
	}
	if err = model.DeletePlaygroundCanvasProject(id, c.GetInt("id")); err != nil {
		playgroundCanvasError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func playgroundCanvasError(c *gin.Context, err error) {
	var conflict *service.PlaygroundCanvasConflict
	switch {
	case errors.As(err, &conflict):
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": conflict.Error(), "data": gin.H{"current_revision": conflict.CurrentRevision}})
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "project not found"})
	case errors.Is(err, service.ErrPlaygroundCanvasSnapshotTooLarge):
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, service.ErrPlaygroundCanvasUnsupportedSnapshot):
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
	}
}
