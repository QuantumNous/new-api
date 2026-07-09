package controller

import (
	"net/http"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetImageGenerationContent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.Status(http.StatusNotFound)
		return
	}

	record, err := model.GetImageGenerationByID(id)
	if err != nil || record == nil {
		c.Status(http.StatusNotFound)
		return
	}

	role := c.GetInt("role")
	userID := c.GetInt("id")
	if role < common.RoleAdminUser && record.UserId != userID {
		c.Status(http.StatusForbidden)
		return
	}
	if record.Status != model.ImageGenerationStatusSuccess || record.FilePath == "" {
		c.Status(http.StatusGone)
		return
	}

	absolutePath := service.GetImageGenerationAbsolutePath(record)
	if absolutePath == "" {
		c.Status(http.StatusGone)
		return
	}
	if _, err := os.Stat(absolutePath); err != nil {
		c.Status(http.StatusGone)
		return
	}

	if record.MimeType != "" {
		c.Header("Content-Type", record.MimeType)
	}
	c.Header("Cache-Control", "private, max-age=3600")
	c.File(absolutePath)
}
