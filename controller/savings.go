package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetUserSavingsSummary(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseSavingsTimeRange(c)
	if err != nil {
		respondSavingsBadRequest(c, err)
		return
	}
	effectiveEndTimestamp, err := service.NormalizeSavingsSummaryWindow(startTimestamp, endTimestamp)
	if err != nil {
		respondSavingsBadRequest(c, err)
		return
	}

	summary, err := service.GetUserSavingsSummary(c.GetInt("id"), startTimestamp, effectiveEndTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetUserSavingsTrend(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseSavingsTimeRange(c)
	if err != nil {
		respondSavingsBadRequest(c, err)
		return
	}
	granularity := c.Query("granularity")
	utcOffsetMinutes, err := strconv.Atoi(c.Query("utc_offset_minutes"))
	if err != nil {
		respondSavingsBadRequest(c, service.ErrSavingsUTCOffsetRequired)
		return
	}
	effectiveEndTimestamp, err := service.NormalizeSavingsTrendWindow(startTimestamp, endTimestamp, granularity, utcOffsetMinutes)
	if err != nil {
		respondSavingsBadRequest(c, err)
		return
	}

	trend, err := service.GetUserSavingsTrend(c.GetInt("id"), startTimestamp, effectiveEndTimestamp, granularity, utcOffsetMinutes)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, trend)
}

func parseSavingsTimeRange(c *gin.Context) (int64, int64, error) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil {
		return 0, 0, service.ErrSavingsTimeRangeRequired
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil {
		return 0, 0, service.ErrSavingsTimeRangeRequired
	}
	return startTimestamp, endTimestamp, nil
}

func respondSavingsBadRequest(c *gin.Context, err error) {
	messageKey := i18n.MsgInvalidParams
	switch {
	case errors.Is(err, service.ErrSavingsTimeRangeRequired):
		messageKey = i18n.MsgSavingsTimeRangeRequired
	case errors.Is(err, service.ErrSavingsUTCOffsetRequired):
		messageKey = i18n.MsgSavingsUTCOffsetRequired
	case errors.Is(err, service.ErrSavingsUTCOffsetInvalid):
		messageKey = i18n.MsgSavingsUTCOffsetInvalid
	case errors.Is(err, service.ErrSavingsEndAfterNow):
		messageKey = i18n.MsgSavingsEndAfterNow
	case errors.Is(err, service.ErrSavingsTimeRangeInvalid):
		messageKey = i18n.MsgSavingsTimeRangeInvalid
	case errors.Is(err, service.ErrSavingsTimeRangeTooLarge):
		messageKey = i18n.MsgSavingsTimeRangeTooLarge
	case errors.Is(err, service.ErrSavingsHourRangeTooLarge):
		messageKey = i18n.MsgSavingsHourRangeTooLarge
	case errors.Is(err, service.ErrSavingsGranularity):
		messageKey = i18n.MsgSavingsGranularityInvalid
	case errors.Is(err, service.ErrSavingsTooManyBuckets):
		messageKey = i18n.MsgSavingsTooManyBuckets
	}
	c.JSON(http.StatusBadRequest, gin.H{
		"success": false,
		"message": i18n.T(c, messageKey),
	})
}
