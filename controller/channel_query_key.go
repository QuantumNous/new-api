package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type QueryKeyReportRequest struct {
	Keys []string `json:"keys"`
}

type QueryKeyTestRequest struct {
	Key          string `json:"key"`
	Source       string `json:"source"`
	TargetID     int    `json:"target_id"`
	Model        string `json:"model"`
	EndpointType string `json:"endpoint_type"`
	Stream       bool   `json:"stream"`
}

func QueryChannelKeyReport(c *gin.Context) {
	request := QueryKeyReportRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}

	report, err := model.BuildChannelQueryKeyReport(request.Keys)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, report)
}

func QueryChannelKeyTest(c *gin.Context) {
	request := QueryKeyTestRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}

	key := strings.TrimSpace(request.Key)
	source := strings.TrimSpace(request.Source)
	if key == "" {
		common.ApiErrorMsg(c, "key不能为空")
		return
	}
	if request.TargetID <= 0 {
		common.ApiErrorMsg(c, "target_id不能为空")
		return
	}

	channel, err := buildQueryKeyTestChannel(source, request.TargetID, key)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	testUserID, err := resolveChannelTestUserID(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	testModel := strings.TrimSpace(request.Model)
	tik := time.Now()
	result := testChannel(channel, testUserID, testModel, request.EndpointType, request.Stream)
	milliseconds := time.Since(tik).Milliseconds()
	consumedTime := float64(milliseconds) / 1000.0
	if result.localErr != nil {
		resp := gin.H{
			"success": false,
			"message": result.localErr.Error(),
			"time":    consumedTime,
		}
		if result.newAPIError != nil {
			resp["error_code"] = result.newAPIError.GetErrorCode()
		}
		c.JSON(http.StatusOK, resp)
		return
	}
	if result.newAPIError != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":    false,
			"message":    result.newAPIError.Error(),
			"time":       consumedTime,
			"error_code": result.newAPIError.GetErrorCode(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"time":    consumedTime,
	})
}

func buildQueryKeyTestChannel(source string, targetID int, key string) (*model.Channel, error) {
	switch source {
	case model.QueryKeyReportSourceChannel:
		channel, err := model.GetChannelById(targetID, true)
		if err != nil {
			return nil, err
		}
		if !model.QueryKeyReportStoredKeyContains(channel.Key, key) {
			return nil, errors.New("key不属于该渠道")
		}
		testChannel := *channel
		testChannel.Key = key
		testChannel.Keys = nil
		testChannel.ChannelInfo = model.ChannelInfo{}
		return &testChannel, nil
	case model.QueryKeyReportSourcePreparation:
		var preparation model.ChannelPreparation
		if err := model.DB.First(&preparation, "id = ?", targetID).Error; err != nil {
			return nil, err
		}
		if !model.QueryKeyReportStoredKeyContains(preparation.Key, key) {
			return nil, errors.New("key不属于该备货渠道")
		}
		applyChannelPreparationDefaults(&preparation)
		testChannel := preparation.ToChannel()
		testChannel.Id = preparation.Id
		testChannel.Key = key
		testChannel.Keys = nil
		testChannel.ChannelInfo = model.ChannelInfo{}
		return testChannel, nil
	default:
		return nil, errors.New("source不支持")
	}
}
