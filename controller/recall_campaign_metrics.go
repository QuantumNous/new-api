package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetRecallMetricUsers(c *gin.Context) {
	query, entry, ok := parseRecallMetricHTTPRequest(c)
	if !ok {
		return
	}
	if !ensureRecallMetricCampaignExists(c, query.CampaignID) {
		return
	}
	if token := strings.TrimSpace(c.Query("snapshot")); token != "" {
		snapshot, err := service.VerifyRecallMetricSnapshotToken(token, query, entry.RowGrain, time.Now())
		if err != nil {
			writeRecallMetricHTTPError(c, err)
			return
		}
		query.Snapshot = snapshot
	}
	if token := strings.TrimSpace(c.Query("cursor")); token != "" {
		if query.Snapshot.AsOf == 0 {
			writeRecallMetricHTTPError(c, service.ErrRecallMetricStaleSnapshot)
			return
		}
		cursor, err := service.VerifyRecallMetricCursorToken(token, query, entry.RowGrain, time.Now())
		if err != nil {
			writeRecallMetricHTTPError(c, err)
			return
		}
		query.Cursor = cursor
	}
	page, err := service.QueryRecallMetric(c.Request.Context(), query, time.Now())
	if err != nil {
		writeRecallMetricHTTPError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": page})
}

func ExportRecallMetricUsers(c *gin.Context) {
	query, entry, ok := parseRecallMetricHTTPRequest(c)
	if !ok {
		return
	}
	if !ensureRecallMetricCampaignExists(c, query.CampaignID) {
		return
	}
	token := strings.TrimSpace(c.Query("snapshot"))
	if token == "" {
		writeRecallMetricHTTPError(c, service.ErrRecallMetricStaleSnapshot)
		return
	}
	snapshot, err := service.VerifyRecallMetricSnapshotToken(token, query, entry.RowGrain, time.Now())
	if err != nil {
		writeRecallMetricHTTPError(c, err)
		return
	}
	query.Snapshot = snapshot
	query.Cursor = model.RecallMetricCursor{}
	var out bytes.Buffer
	result, err := service.ExportRecallMetricCSVWithLimits(c.Request.Context(), &out, query, time.Now(), service.DefaultRecallMetricExportLimits)
	if err != nil {
		writeRecallMetricHTTPError(c, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", recallMetricCSVFilename(query.CampaignID, query.Metric)))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	if result.Truncated {
		c.Header("X-Recall-Metric-Truncated", "true")
	}
	c.Status(http.StatusOK)
	_, _ = c.Writer.Write(out.Bytes())
}

func parseRecallMetricHTTPRequest(c *gin.Context) (model.RecallMetricQuery, model.RecallMetricRegistryEntry, bool) {
	id, err := recallPathID(c, "id")
	if err != nil {
		writeRecallMetricHTTPError(c, fmt.Errorf("%w: invalid campaign id", model.ErrRecallMetricBadRequest))
		return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
	}
	metric := model.RecallMetricKey(strings.TrimSpace(c.Query("metric")))
	entry, ok := model.RecallMetricEntry(metric)
	if !ok {
		writeRecallMetricHTTPError(c, fmt.Errorf("%w: unsupported metric", model.ErrRecallMetricBadRequest))
		return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
	}
	allowed := map[string]bool{
		"metric":           true,
		"q":                true,
		"search":           true,
		"limit":            true,
		"stage_no":         true,
		"state":            true,
		"conversion_kind":  true,
		"payment_category": true,
		"currency":         true,
		"snapshot":         true,
		"cursor":           true,
	}
	for name := range c.Request.URL.Query() {
		if !allowed[name] {
			writeRecallMetricHTTPError(c, fmt.Errorf("%w: unknown query parameter %s", model.ErrRecallMetricBadRequest, name))
			return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
		}
	}
	limit := 50
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit <= 0 || limit > 500 {
			writeRecallMetricHTTPError(c, fmt.Errorf("%w: invalid limit", model.ErrRecallMetricBadRequest))
			return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
		}
	}
	var stageNo *int
	if raw := strings.TrimSpace(c.Query("stage_no")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			writeRecallMetricHTTPError(c, fmt.Errorf("%w: invalid stage_no", model.ErrRecallMetricBadRequest))
			return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
		}
		stageNo = &parsed
	}
	search := c.Query("q")
	if legacy := c.Query("search"); strings.TrimSpace(legacy) != "" {
		if strings.TrimSpace(search) != "" && strings.TrimSpace(search) != strings.TrimSpace(legacy) {
			writeRecallMetricHTTPError(c, fmt.Errorf("%w: q and search disagree", model.ErrRecallMetricBadRequest))
			return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
		}
		search = legacy
	}
	query := model.RecallMetricQuery{
		CampaignID:      id,
		Metric:          metric,
		Search:          search,
		StageNo:         stageNo,
		State:           c.Query("state"),
		ConversionKind:  c.Query("conversion_kind"),
		PaymentCategory: c.Query("payment_category"),
		Currency:        c.Query("currency"),
		Limit:           limit,
	}
	if _, err := model.RecallMetricFilterHash(query); err != nil {
		writeRecallMetricHTTPError(c, err)
		return model.RecallMetricQuery{}, model.RecallMetricRegistryEntry{}, false
	}
	return query, entry, true
}

func ensureRecallMetricCampaignExists(c *gin.Context, campaignID int64) bool {
	_, err := model.GetRecallCampaignByIDWithContext(c.Request.Context(), campaignID)
	if err == nil {
		return true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "recall campaign not found"})
		return false
	}
	writeRecallMetricHTTPError(c, err)
	return false
}

func writeRecallMetricHTTPError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, model.ErrRecallMetricBadRequest):
		status = http.StatusBadRequest
	case errors.Is(err, service.ErrRecallMetricStaleSnapshot), errors.Is(err, model.ErrRecallMetricRetry):
		status = http.StatusConflict
	}
	c.JSON(status, gin.H{"success": false, "message": recallMetricClientMessage(err)})
}

func recallMetricClientMessage(err error) string {
	switch {
	case errors.Is(err, service.ErrRecallMetricStaleSnapshot):
		return "recall metric snapshot is stale"
	case errors.Is(err, model.ErrRecallMetricRetry):
		return "recall metric is not ready"
	case errors.Is(err, model.ErrRecallMetricBadRequest):
		return err.Error()
	default:
		return "recall metric request failed"
	}
}

func recallMetricCSVFilename(campaignID int64, metric model.RecallMetricKey) string {
	metricPart := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return '-'
	}, strings.ToLower(string(metric)))
	if strings.Trim(metricPart, "-_") == "" {
		metricPart = "metric"
	}
	return fmt.Sprintf("recall-campaign-%d-%s.csv", campaignID, metricPart)
}
