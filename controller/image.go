package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetSavedImages(c *gin.Context) {
	requestId := c.Param("request_id")
	userId := c.GetInt("id")

	if requestId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "request_id is required"})
		return
	}

	images, err := model.GetSavedImagesByRequestID(userId, requestId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    images,
	})
}

func GetSavedImageFile(c *gin.Context) {
	requestId := c.Param("request_id")
	indexStr := c.Param("index")
	userId := c.GetInt("id")

	imageIndex, err := strconv.Atoi(indexStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid image index"})
		return
	}

	images, err := model.GetSavedImagesByRequestID(userId, requestId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	var target *model.SavedImage
	for _, img := range images {
		if img.ImageIndex == imageIndex {
			target = img
			break
		}
	}

	if target == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "image not found"})
		return
	}

	c.File(target.FilePath)
}
