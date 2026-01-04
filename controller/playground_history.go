package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type PlaygroundHistoryRequest struct {
	Title    string          `json:"title"`
	Messages json.RawMessage `json:"messages"` // Pass through as raw JSON
	Model    string          `json:"model"`
	Group    string          `json:"group"`
}

func GetPlaygroundHistories(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	histories, total, err := model.GetPlaygroundHistories(userId, page, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    histories,
		"total":   total,
	})
}

func GetPlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))

	history, err := model.GetPlaygroundHistory(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    history,
	})
}

func CreatePlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	var req PlaygroundHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Default title if empty
	if req.Title == "" {
		req.Title = "New Chat"
	}

	history := &model.PlaygroundHistory{
		UserId:    userId,
		Title:     req.Title,
		Messages:  string(req.Messages),
		ModelName: req.Model,
		Group:     req.Group,
	}

	if err := history.Create(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    history,
	})
}

func UpdatePlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	var req PlaygroundHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	history, err := model.GetPlaygroundHistory(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if req.Title != "" {
		history.Title = req.Title
	}
	if len(req.Messages) > 0 {
		history.Messages = string(req.Messages)
	}
	if req.Model != "" {
		history.ModelName = req.Model
	}
	if req.Group != "" {
		history.Group = req.Group
	}

	if err := history.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    history,
	})
}

func DeletePlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))

	history, err := model.GetPlaygroundHistory(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if err := history.Delete(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
