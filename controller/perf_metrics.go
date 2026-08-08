package controller

import (
	"net/http"
	"strconv"
	"time"

	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model: modelName,
		Group: c.Query("group"),
		Hours: hours,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	result.Groups = filterActiveGroups(result.Groups)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetAdminModelPerfMetrics(c *gin.Context) {
	const maxRangeSeconds = int64(30 * 24 * 60 * 60)
	rawStart := c.Query("start_timestamp")
	rawEnd := c.Query("end_timestamp")
	if rawStart == "" || rawEnd == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "start_timestamp and end_timestamp are required"})
		return
	}

	startTs, startErr := strconv.ParseInt(rawStart, 10, 64)
	endTs, endErr := strconv.ParseInt(rawEnd, 10, 64)
	if startErr != nil || endErr != nil || startTs <= 0 || endTs <= startTs {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid performance metric time range"})
		return
	}
	if endTs > time.Now().Unix() {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "end_timestamp cannot be in the future"})
		return
	}
	if endTs-startTs > maxRangeSeconds {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "performance metric time range cannot exceed 30 days"})
		return
	}

	result, err := perfmetrics.QueryAdmin(startTs, endTs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func filterActiveGroups(groups []perfmetrics.GroupResult) []perfmetrics.GroupResult {
	activeRatios := ratio_setting.GetGroupRatioCopy()
	return lo.Filter(groups, func(g perfmetrics.GroupResult, _ int) bool {
		_, ok := activeRatios[g.Group]
		return ok || g.Group == "auto"
	})
}
