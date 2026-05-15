package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type AITranslationSettingsRequest struct {
	Enabled        any    `json:"enabled"`
	BaseURL        string `json:"base_url"`
	APIKey         string `json:"api_key"`
	Model          string `json:"model"`
	TimeoutSeconds any    `json:"timeout_seconds"`
}

func UpdateAITranslationSettings(c *gin.Context) {
	var req AITranslationSettingsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}

	updates := map[string]string{
		"AITranslationEnabled":        common.Interface2String(req.Enabled),
		"AITranslationBaseURL":        strings.TrimSpace(req.BaseURL),
		"AITranslationModel":          strings.TrimSpace(req.Model),
		"AITranslationTimeoutSeconds": common.Interface2String(req.TimeoutSeconds),
	}
	if strings.TrimSpace(req.APIKey) != "" {
		updates["AITranslationAPIKey"] = strings.TrimSpace(req.APIKey)
	}

	for key, value := range updates {
		if err := model.UpdateOption(key, value); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func GenerateAITranslations(c *gin.Context) {
	sources := make([]service.AITranslationSource, 0, 8)

	collectSource := func(scope string, build func() any, paths []string) {
		start := time.Now()
		payload := build()
		sources = append(sources, service.AITranslationSource{Scope: scope, Payload: payload, Paths: paths})
		common.SysLog("AI translation source collected: scope=" + scope + ", elapsed=" + time.Since(start).String())
	}

	collectSource("status", func() any { return buildStatusResponse() }, statusTranslationPaths)
	collectSource("notice", func() any { return buildNoticeResponse() }, noticeTranslationPaths)
	collectSource("user_groups", func() any { return buildUserGroupsResponse("default") }, userGroupsTranslationPaths)
	collectSource("pricing", func() any { return buildPricingResponse("default") }, pricingTranslationPaths)

	start := time.Now()
	if plansResp, err := buildSubscriptionPlansResponse(); err == nil {
		sources = append(sources, service.AITranslationSource{Scope: "subscription_plans", Payload: plansResp, Paths: subscriptionPlansTranslationPaths})
		common.SysLog("AI translation source collected: scope=subscription_plans, elapsed=" + time.Since(start).String())
	} else {
		common.SysLog("AI translation source skipped: scope=subscription_plans, error=" + err.Error() + ", elapsed=" + time.Since(start).String())
	}

	start = time.Now()
	if rankingsResp, err := buildRankingsResponse("week"); err == nil {
		sources = append(sources, service.AITranslationSource{Scope: "rankings", Payload: rankingsResp, Paths: rankingsTranslationPaths})
		common.SysLog("AI translation source collected: scope=rankings, elapsed=" + time.Since(start).String())
	} else {
		common.SysLog("AI translation source skipped: scope=rankings, error=" + err.Error() + ", elapsed=" + time.Since(start).String())
	}

	start = time.Now()
	snapshot, err := service.GenerateAITranslationSnapshot(c.Request.Context(), sources)
	if err != nil {
		common.SysLog("AI translation snapshot failed: elapsed=" + time.Since(start).String() + ", error=" + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	common.SysLog("AI translation snapshot generated: elapsed=" + time.Since(start).String())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"updated_at": snapshot.UpdatedAt,
			"stats":      snapshot.Stats,
		},
	})
}
