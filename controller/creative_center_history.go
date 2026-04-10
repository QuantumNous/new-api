package controller

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type CreativeCenterHistorySaveRequest struct {
	Tab       string          `json:"tab"`
	ModelName string          `json:"model_name"`
	Group     string          `json:"group"`
	Prompt    string          `json:"prompt"`
	Payload   json.RawMessage `json:"payload"`
}

func GetCreativeCenterHistory(c *gin.Context) {
	userId := c.GetInt("id")
	histories, err := model.ListCreativeCenterHistoriesByUser(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	result := make(map[string]any)
	for _, history := range histories {
		var payload any
		if history.Payload != "" {
			if err := common.UnmarshalJsonStr(string(history.Payload), &payload); err != nil {
				payload = nil
			}
		}
		result[history.Tab] = gin.H{
			"id":         history.ID,
			"tab":        history.Tab,
			"model_name": history.ModelName,
			"group":      history.Group,
			"prompt":     history.Prompt,
			"payload":    payload,
			"created_at": history.CreatedAt,
			"updated_at": history.UpdatedAt,
		}
	}

	common.ApiSuccess(c, result)
}

func SaveCreativeCenterHistory(c *gin.Context) {
	userId := c.GetInt("id")
	var req CreativeCenterHistorySaveRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ValidateCreativeCenterTab(req.Tab); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Payload) == 0 {
		common.ApiError(c, fmt.Errorf("payload is required"))
		return
	}

	history, err := model.UpsertCreativeCenterHistory(
		userId,
		req.Tab,
		req.ModelName,
		req.Group,
		req.Prompt,
		req.Payload,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":         history.ID,
		"updated_at": history.UpdatedAt,
	})
}

func DeleteCreativeCenterHistory(c *gin.Context) {
	userId := c.GetInt("id")
	tab := c.Param("tab")
	if err := model.DeleteCreativeCenterHistory(userId, tab); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
