package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetRecallEmailTranslationTask(c *gin.Context) {
	campaignID, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	taskID, err := recallPathID(c, "task_id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := runtime.Campaigns.GetEmailTranslationTask(c.Request.Context(), campaignID, taskID)
	if err != nil {
		recallTranslationTaskError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func GetLatestRecallEmailTranslationTask(c *gin.Context) {
	campaignID, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runtime, err := recallControllerRuntime()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := runtime.Campaigns.GetLatestEmailTranslationTask(c.Request.Context(), campaignID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if _, campaignErr := model.GetRecallCampaignByIDWithContext(c.Request.Context(), campaignID); campaignErr != nil {
				if errors.Is(campaignErr, gorm.ErrRecordNotFound) {
					recallTranslationTaskError(c, err)
					return
				}
				common.ApiError(c, campaignErr)
				return
			}
			common.ApiSuccess(c, nil)
			return
		}
		recallTranslationTaskError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func recallAccepted(c *gin.Context, data service.RecallTranslationTaskResponse) {
	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

func recallTranslationTaskError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "recall translation task not found"})
		return
	}
	common.ApiError(c, err)
}
