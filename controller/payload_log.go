package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetPayloadLogs returns a paginated, body-free list of ALL captured payload
// logs. Admin-only.
func GetPayloadLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	username := c.Query("username")
	modelName := c.Query("model_name")
	requestId := c.Query("request_id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	logs, total, err := model.GetPayloadLogs(0, username, modelName, requestId, startTimestamp, endTimestamp, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// GetSelfPayloadLogs returns the caller's OWN payload logs only. Any user.
func GetSelfPayloadLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	modelName := c.Query("model_name")
	requestId := c.Query("request_id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	logs, total, err := model.GetPayloadLogs(userId, "", modelName, requestId, startTimestamp, endTimestamp, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// GetPayloadLogDetail returns a single log with full bodies. Admin-only.
func GetPayloadLogDetail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	log, err := model.GetPayloadLogById(id, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, log)
}

// GetSelfPayloadLogDetail returns a single log with full bodies, but only if it
// belongs to the caller. Any user.
func GetSelfPayloadLogDetail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	log, err := model.GetPayloadLogById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, log)
}

// GetPayloadLogSwitchStatus reports the current platform-wide switch state.
// Readable by any authenticated user (transparency).
func GetPayloadLogSwitchStatus(c *gin.Context) {
	common.ApiSuccess(c, gin.H{"enabled": common.PayloadLogEnabled})
}

// SetPayloadLogSwitch flips the platform-wide switch and records who did it.
// Root only.
func SetPayloadLogSwitch(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid parameter")
		return
	}
	value := "false"
	if req.Enabled {
		value = "true"
	}
	if err := model.UpdateOption("PayloadLogEnabled", value); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordPayloadLogSwitchAudit(c.GetInt("id"), c.GetString("username"), req.Enabled)
	common.ApiSuccess(c, gin.H{"enabled": req.Enabled})
}

// GetPayloadLogSwitchAudits returns the switch change history (who turned it on
// or off, and when). Readable by any authenticated user (transparency).
func GetPayloadLogSwitchAudits(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	audits, total, err := model.GetPayloadLogSwitchAudits(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(audits)
	common.ApiSuccess(c, pageInfo)
}
