package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ManualPushFeishuDailyStats(c *gin.Context) {
	if shouldUseNewReport() {
		result, err := service.ManualRunUsageReport(model.ReportPeriodDaily)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, result)
		return
	}
	common.ApiSuccess(c, service.ManualPushFeishuStats("daily"))
}

func ManualPushFeishuWeeklyStats(c *gin.Context) {
	if shouldUseNewReport() {
		result, err := service.ManualRunUsageReport(model.ReportPeriodWeekly)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, result)
		return
	}
	common.ApiSuccess(c, service.ManualPushFeishuStats("weekly"))
}

func ManualPushFeishuMonthlyStats(c *gin.Context) {
	if shouldUseNewReport() {
		result, err := service.ManualRunUsageReport(model.ReportPeriodMonthly)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, result)
		return
	}
	common.ApiSuccess(c, service.ManualPushFeishuStats("monthly"))
}

type runUsageReportRequest struct {
	PeriodType    string `json:"period_type"`
	Date          string `json:"date"`
	SyncBase      *bool  `json:"sync_base"`
	AdminPushTask *bool  `json:"admin_push_task"`
}

func RunFeishuUsageReport(c *gin.Context) {
	var req runUsageReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PeriodType != model.ReportPeriodDaily && req.PeriodType != model.ReportPeriodWeekly && req.PeriodType != model.ReportPeriodMonthly {
		common.ApiErrorMsg(c, "period_type must be daily, weekly or monthly")
		return
	}
	target := time.Now()
	if req.Date != "" {
		parsed, err := time.ParseInLocation("2006-01-02", req.Date, time.Local)
		if err != nil {
			common.ApiErrorMsg(c, "date must use YYYY-MM-DD")
			return
		}
		target = parsed
	} else {
		switch req.PeriodType {
		case model.ReportPeriodDaily:
			target = target.AddDate(0, 0, -1)
		case model.ReportPeriodWeekly:
			target = target.AddDate(0, 0, -7)
		case model.ReportPeriodMonthly:
			target = target.AddDate(0, -1, 0)
		}
	}
	syncBase := true
	if req.SyncBase != nil {
		syncBase = *req.SyncBase
	}
	adminPushTask := false
	if req.AdminPushTask != nil {
		adminPushTask = *req.AdminPushTask
	}
	rp := service.BuildReportPeriodForDate(req.PeriodType, target)
	result, err := service.RunUsageReportFullPipelineForPeriod(rp, syncBase, adminPushTask)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func shouldUseNewReport() bool {
	return service.IsUsageReportEnabled()
}
