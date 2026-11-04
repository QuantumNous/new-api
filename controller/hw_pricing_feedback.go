package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type hwPricingFeedbackRequest struct {
	Kind      string `json:"kind"`
	Model     string `json:"model"`
	Message   string `json:"message"`
	SourceURL string `json:"source_url"`
	Email     string `json:"email"`
	Lang      string `json:"lang"`
	// Website is the honeypot: a person never sees it, a bot fills it.
	Website string `json:"website"`
}

// HwPricingFeedback stores one public report from /pricing and mails the first
// report of a model and kind to the owner. A filled honeypot answers like a
// stored report and stores nothing.
func HwPricingFeedback(c *gin.Context) {
	var request hwPricingFeedbackRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "invalid request")
		return
	}
	if request.Website != "" {
		common.ApiSuccess(c, gin.H{"stored": true})
		return
	}
	row := model.HwPricingFeedback{
		Kind: request.Kind, Model: request.Model, Message: request.Message,
		SourceURL: request.SourceURL, Email: request.Email, Lang: request.Lang,
	}
	if err := model.HwNormalizePricingFeedback(&row); err != nil {
		common.ApiErrorMsg(c, "invalid request")
		return
	}
	now := common.GetTimestamp()
	day := "hw:pf:store:" + time.Unix(now, 0).UTC().Format("2006-01-02")
	if stored, err := model.HwAssistantBumpCounter(model.DB, day, now); err != nil || stored > model.HwPricingFeedbackStoredPerDay {
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "too many requests"})
		return
	}
	if err := model.HwStorePricingFeedback(model.DB, &row, now); err != nil {
		common.ApiError(c, err)
		return
	}
	if !row.Duplicate {
		if err := service.HwMailPricingFeedback(row, now); err != nil {
			common.SysError(common.LogText("pricing feedback mail failed: id=%d err=%v", row.ID, err))
		}
	}
	common.ApiSuccess(c, gin.H{"stored": true})
}

// HwAdminFlushPricingFeedback files the bundled card now instead of on the
// hour (daily round, live check). The daily card limit still applies.
func HwAdminFlushPricingFeedback(c *gin.Context) {
	if !hwRequireAdmin(c) {
		return
	}
	card, err := service.HwBundlePricingFeedback(c.Request.Context(), service.HwBureauCardConfigFromEnv(), common.GetTimestamp())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"card": card})
}
