package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListDrawingTemplates(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	items, err := model.ListDrawingTemplates(c.GetInt("id"))
	if err != nil {
		drawingError(c, 500, "Unable to load prompt templates")
		return
	}
	c.JSON(http.StatusOK, items)
}

func SaveDrawingTemplate(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 100000)
	var input struct {
		Name   string `json:"name"`
		Prompt string `json:"prompt"`
	}
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		drawingError(c, 400, "Invalid prompt template")
		return
	}
	item, err := model.SaveDrawingTemplate(c.GetInt("id"), c.Param("id"), input.Name, input.Prompt)
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		drawingError(c, 404, "Prompt template not found")
	case errors.Is(err, model.ErrDrawingTemplateLimit), errors.Is(err, model.ErrInvalidDrawingTemplate):
		drawingError(c, 400, err.Error())
	case err != nil:
		drawingError(c, 500, "Unable to save prompt template")
	default:
		c.JSON(http.StatusOK, item)
	}
}

func DeleteDrawingTemplate(c *gin.Context) {
	err := model.DeleteDrawingTemplate(c.GetInt("id"), c.Param("id"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		drawingError(c, 404, "Prompt template not found")
		return
	}
	if err != nil {
		drawingError(c, 500, "Unable to delete prompt template")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
