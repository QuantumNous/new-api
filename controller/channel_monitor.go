package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type ChannelMonitorData struct {
	ModelName   string `json:"model_name"`
	CurrentRPM  int64  `json:"current_rpm"`
	CurrentTPM  int64  `json:"current_tpm"`
	CurrentRPD  int64  `json:"current_rpd"`
	LimitRPM    int    `json:"limit_rpm"`
	LimitTPM    int    `json:"limit_tpm"`
	LimitRPD    int    `json:"limit_rpd"`
	UsageTokens int    `json:"usage_tokens"` // Optional: could be implemented if we track usage separately
}

func GetChannelMonitorData(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	rateLimitSettings := channel.GetRateLimitSettings()
	models := channel.GetModels()
	data := make([]ChannelMonitorData, 0)

	ctx := context.Background()
	rdb := common.RDB

	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}

		// Get limits
		rpm := channel.GetRateLimitRPM()
		tpm := channel.GetRateLimitTPM()
		rpd := channel.GetRateLimitRPD()
		if limit, ok := rateLimitSettings[modelName]; ok {
			rpm = limit.RPM
			tpm = limit.TPM
			rpd = limit.RPD
		}

		// Get current usage from Redis
		var currentRPM, currentTPM, currentRPD int64
		if common.RedisEnabled {
			// RPM
			rpmKey := fmt.Sprintf("%s%d:%s", service.ChannelRPMPrefix, channel.Id, modelName)
			currentRPM, _ = rdb.LLen(ctx, rpmKey).Result()

			// TPM
			tpmKey := fmt.Sprintf("%s%d:%s", service.ChannelTPMPrefix, channel.Id, modelName)
			currentTPMVal, _ := rdb.Get(ctx, tpmKey).Int64()
			currentTPM = currentTPMVal

			// RPD
			rpdKey := fmt.Sprintf("%s%d:%s", service.ChannelRPDPrefix, channel.Id, modelName)
			currentRPDVal, _ := rdb.Get(ctx, rpdKey).Int64()
			currentRPD = currentRPDVal
		}

		data = append(data, ChannelMonitorData{
			ModelName:  modelName,
			CurrentRPM: currentRPM,
			CurrentTPM: currentTPM,
			CurrentRPD: currentRPD,
			LimitRPM:   rpm,
			LimitTPM:   tpm,
			LimitRPD:   rpd,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
